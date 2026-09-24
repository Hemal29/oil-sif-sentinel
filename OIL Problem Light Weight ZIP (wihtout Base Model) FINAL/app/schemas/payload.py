from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

# --- INPUT REQUEST MODEL ---

class ReportAssessRequest(BaseModel):
    record_id: str = Field(..., example="hse-2026-0091501", min_length=1, max_length=200)
    text: str = Field(..., example="Fitter began opening pump seal P-214B...", min_length=1, max_length=8000)
    source: Optional[str] = Field(default=None)
    reported_at: Optional[str] = Field(default=None)
    metadata: Optional[Dict[str, Any]] = Field(default=None)

# --- ASSESSMENT SUB-MODELS (MODEL OUTPUTS) ---

class Barrier(BaseModel):
    type: str = Field(default="procedural")
    name: str = Field(default="isolation_not_applied")

class Asset(BaseModel):
    span: str
    type: str = Field(default="other_asset")

class Assessment(BaseModel):
    sif_potential: str = Field(default="no")
    primary_rule: str = Field(default="none")
    secondary_rules: List[str] = Field(default_factory=list)
    hazard_energy: str = Field(default="none_identified")
    event_status: str = Field(default="unclear")
    barriers_failed: List[Barrier] = Field(default_factory=list)
    assets: List[Asset] = Field(default_factory=list)
    rationale: str = Field(default="")

# --- TRIAGE & EXTRACTION WRAPPERS ---

class RuleBasedSignal(BaseModel):
    triggered: bool = False
    matched_rules: List[str] = Field(default_factory=list)

class Triage(BaseModel):
    route: str = Field(default="priority")
    requires_human_review: bool = True
    escalated_to_extraction: bool = True
    risk_score: float = Field(default=0.94)
    rule_based_signal: RuleBasedSignal = Field(default_factory=RuleBasedSignal)

class ExtractionMeta(BaseModel):
    status: str = Field(default="ok")
    model_version: Optional[str] = Field(default="stage2-v1")
    repair_attempts: Optional[int] = Field(default=1)
    failure_reason: Optional[str] = Field(default=None)

class ClarificationRequest(BaseModel):
    reason: str
    suggested_questions: List[str]

# --- FINAL RESPONSE CONTRACT MODEL ---

class ReportAssessmentResponse(BaseModel):
    schema_version: str = Field(default="1.0.0")
    record_id: str
    metadata: Optional[Dict[str, Any]] = None
    received_at: str
    processed_at: str
    processing_ms: int
    triage: Triage
    assessment: Assessment
    extraction: ExtractionMeta
    clarification_request: Optional[ClarificationRequest] = None