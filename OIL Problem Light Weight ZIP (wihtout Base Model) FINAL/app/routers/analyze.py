import time
from datetime import datetime, timezone
from fastapi import APIRouter, Header, HTTPException
from typing import Optional

from app.schemas.payload import (
    ReportAssessRequest,
    ReportAssessmentResponse,
    Triage,
    ExtractionMeta,
    Assessment,
    Asset,
    Barrier,
    RuleBasedSignal,
)
from app.core.inference import engine
from app.core.fastlane import fastlane_screen
from app.core.adjudicate import adjudicate

router = APIRouter()


def _coerce_barriers(items):
    if not isinstance(items, list):
        return []
    out = []
    for item in items:
        if isinstance(item, Barrier):
            out.append(item)
        elif isinstance(item, str):
            out.append(Barrier(type="procedural", name=item.strip().lower().replace(" ", "_")))
        elif isinstance(item, dict):
            try:
                out.append(Barrier(**item))
            except Exception:
                out.append(Barrier(type="procedural", name=str(item.get("name", "barrier"))))
    return out


def _coerce_assets(items):
    if not isinstance(items, list):
        return []
    out = []
    for item in items:
        if isinstance(item, Asset):
            out.append(item)
        elif isinstance(item, str):
            out.append(Asset(span=item, type="other_asset"))
        elif isinstance(item, dict):
            try:
                out.append(Asset(span=str(item.get("span", "")), type=str(item.get("type", "other_asset"))))
            except Exception:
                out.append(Asset(span=str(item), type="other_asset"))
    return out


@router.post("/v1/reports/assess", response_model=ReportAssessmentResponse)
async def assess_report(
    payload: ReportAssessRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key")
):
    start_time = time.time()
    received_at = datetime.now(timezone.utc).isoformat()

    try:
        # 1. Feed ONLY the raw text into your AI inference engine
        raw_output = engine.generate_incident_json(payload.text)

        processed_at = datetime.now(timezone.utc).isoformat()
        processing_ms = int((time.time() - start_time) * 1000)

        # 1b. Deterministic fast-lane screen, then adjudicate against the LLM
        #     verdict. Critical isolation / electrical-exposure findings always
        #     win and can never be AUTO_CLOSEd or downgraded to NON-SIF.
        fast = fastlane_screen(payload.text)

        raw_assets = raw_output.get("assets")
        if not isinstance(raw_assets, list):
            raw_assets = []

        raw_barriers = raw_output.get("barriers_failed")
        if not isinstance(raw_barriers, list):
            raw_barriers = []

        decision = adjudicate(fast, raw_output, _coerce_barriers(raw_barriers))

        assessment_obj = Assessment(
            sif_potential=decision["sif_potential"],
            primary_rule=decision["primary_rule"],
            secondary_rules=decision["secondary_rules"],
            hazard_energy=decision["hazard_energy"],
            event_status=decision["event_status"],
            barriers_failed=decision["barriers"],
            assets=_coerce_assets(raw_assets),
            rationale=decision["rationale"],
        )

        # 3. Construct the contract response wrapper
        return ReportAssessmentResponse(
            schema_version="1.0.0",
            record_id=payload.record_id,
            metadata=payload.metadata,
            received_at=received_at,
            processed_at=processed_at,
            processing_ms=processing_ms,
            triage=Triage(
                route=decision["route"],
                requires_human_review=decision["requires_human_review"],
                escalated_to_extraction=True,
                risk_score=decision["risk_score"],
                rule_based_signal=RuleBasedSignal(
                    triggered=fast["triggered"],
                    matched_rules=fast["codes"],
                ),
            ),
            assessment=assessment_obj,
            extraction=ExtractionMeta(status="ok", model_version="stage2-v1"),
            clarification_request=None
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "code": "internal_error",
                    "message": str(e),
                    "record_id": payload.record_id
                }
            }
        )