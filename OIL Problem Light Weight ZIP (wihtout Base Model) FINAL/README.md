# OIL Problem AI Module

Dual-stage AI microservice built with **FastAPI**, **DeBERTa-v3**, and **Qwen2.5-7B (QLoRA)** for HSE Serious Injury & Fatality (SIF) detection, Life-Saving Rule (LSR) extraction, and structured incident analysis.

---

## 🏗️ Architecture Overview

1. **Stage 1 Fast-Lane (DeBERTa Classifier):** Performs rapid triage and classification on raw incident descriptions.
2. **Stage 2 LLM Extraction Engine (Qwen2.5-7B QLoRA):** Generates structured JSON matching IOGP Life-Saving Rules and safety taxonomy.
3. **Validator & Normalizer:** Cleans markdown code fences and normalizes extracted rule strings to canonical IOGP titles.

---

## 🚀 Quickstart (Local Development)

### 1. Environment Setup
Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt