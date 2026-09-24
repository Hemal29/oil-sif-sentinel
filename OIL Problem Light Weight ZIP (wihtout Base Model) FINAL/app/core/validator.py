import json
import re
from typing import Dict, Any

# Canonical IOGP Life-Saving Rules Mapping (sifeval taxonomy alignment)
IOGP_RULE_MAP = {
    "bypassing_controls": "Bypassing Safety Controls",
    "bypassing_safety_controls": "Bypassing Safety Controls",
    "confined_space": "Confined Space",
    "driving": "Driving",
    "energy_isolation": "Energy Isolation",
    "hot_work": "Hot Work",
    "line_of_fire": "Line of Fire",
    "mechanical_lifting": "Safe Mechanical Lifting",
    "safe_mechanical_lifting": "Safe Mechanical Lifting",
    "work_authorisation": "Work Authorisation",
    "work_authorization": "Work Authorisation",
    "working_at_height": "Working at Height",
    "other_hazard": "Other Hazard",
    "none": "None",
    "insufficient_information": "Insufficient Information"
}

def normalize_iogp_rule(rule_str: str) -> str:
    """Normalizes snake_case LLM outputs to canonical IOGP Life-Saving Rule titles."""
    if not rule_str:
        return "None"
    clean_str = rule_str.strip().lower().replace("-", "_").replace(" ", "_")
    return IOGP_RULE_MAP.get(clean_str, rule_str.strip().title())

def parse_and_validate_llm_json(raw_llm_output: str) -> Dict[str, Any]:
    """Strips markdown fences, validates JSON structure, and normalizes extracted rules."""
    # Strip markdown code blocks (e.g. ```json ... ```)
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw_llm_output.strip(), flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
    
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse model output into valid JSON: {str(e)}\nRaw Output: {raw_llm_output}")
        
    # Standardize primary and secondary Life-Saving Rules
    if "primary_rule" in data and isinstance(data["primary_rule"], str):
        data["primary_rule"] = normalize_iogp_rule(data["primary_rule"])
        
    if "secondary_rules" in data and isinstance(data["secondary_rules"], list):
        data["secondary_rules"] = [normalize_iogp_rule(r) for r in data["secondary_rules"] if isinstance(r, str)]
        
    return data