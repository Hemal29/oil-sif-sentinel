import torch
import warnings
warnings.filterwarnings("ignore", category=UserWarning)
from typing import Dict, Any
from transformers import (
    AutoTokenizer, 
    AutoModelForSequenceClassification, 
    AutoModelForCausalLM, 
    BitsAndBytesConfig
)
from peft import PeftModel
from app.core.config import settings
from app.core.validator import parse_and_validate_llm_json

class AIInferenceEngine:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        self.stage1_tokenizer = None
        self.stage1_model = None
        
        self.stage2_tokenizer = None
        self.stage2_model = None
        self.is_ready = False

    def load_models(self):
        """Loads Stage 1 and Stage 2 models into memory during service startup."""
        print("⚡ [Stage 1] Loading DeBERTa Triage Model...")
        self.stage1_tokenizer = AutoTokenizer.from_pretrained(settings.STAGE1_MODEL_PATH)
        self.stage1_model = AutoModelForSequenceClassification.from_pretrained(
            settings.STAGE1_MODEL_PATH,
            ignore_mismatched_sizes=True
        ).to(self.device)
        self.stage1_model.eval()

        print(f"⚡ [Stage 2] Loading {settings.STAGE2_BASE_MODEL} Base Model (4-bit NF4)...")
        
        # CPU offloading flag goes INSIDE BitsAndBytesConfig
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
            llm_int8_enable_fp32_cpu_offload=True,  # Correct placement
        )
        
        self.stage2_tokenizer = AutoTokenizer.from_pretrained(
            settings.STAGE2_BASE_MODEL, 
            trust_remote_code=True
        )
        if self.stage2_tokenizer.pad_token is None:
            self.stage2_tokenizer.pad_token = self.stage2_tokenizer.eos_token

        base_llm = AutoModelForCausalLM.from_pretrained(
            settings.STAGE2_BASE_MODEL,
            quantization_config=bnb_config,
            torch_dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True
        )

        print("⚡ [Stage 2] Attaching Fine-Tuned QLoRA Adapter...")
        self.stage2_model = PeftModel.from_pretrained(
            base_llm, 
            settings.STAGE2_ADAPTER_PATH,
            low_cpu_mem_usage=True
        )
        self.stage2_model.eval()
        self.is_ready = True
        print("✅ Dual-stage AI Inference Engine initialized successfully!")

    def classify_fast_lane(self, text: str) -> Dict[str, Any]:
        """Stage 1: Fast-lane triage check."""
        inputs = self.stage1_tokenizer(
            text, 
            return_tensors="pt", 
            truncation=True, 
            max_length=512
        ).to(self.device)
        
        with torch.no_grad():
            outputs = self.stage1_model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1)
            pred_class = torch.argmax(probs, dim=-1).item()
            
        return {
            "class_id": pred_class,
            "confidence": float(probs[0][pred_class].item())
        }

    def generate_incident_json(self, text: str) -> Dict[str, Any]:
        """Stage 2: Generates structured JSON extraction."""
        system_prompt = (
            "You are an expert HSE Safety Officer. Extract structured safety analysis "
            "from the incident description and output ONLY valid JSON matching the schema."
        )
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Analyze this incident: {text}"}
        ]
        
        prompt_text = self.stage2_tokenizer.apply_chat_template(
            messages, 
            tokenize=False, 
            add_generation_prompt=True
        )
        
        inputs = self.stage2_tokenizer(
            prompt_text, 
            return_tensors="pt"
        ).to(self.device)
        
        with torch.no_grad():
            output_tokens = self.stage2_model.generate(
                **inputs,
                max_new_tokens=384,
                temperature=0.1,
                top_p=0.9,
                do_sample=False,
                pad_token_id=self.stage2_tokenizer.pad_token_id
            )
            
        generated_tokens = output_tokens[0][inputs.input_ids.shape[1]:]
        raw_output = self.stage2_tokenizer.decode(generated_tokens, skip_special_tokens=True)
        
        return parse_and_validate_llm_json(raw_output)

engine = AIInferenceEngine()