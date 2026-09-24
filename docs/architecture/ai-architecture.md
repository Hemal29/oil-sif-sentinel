# AI Architecture (Step 5: orchestration + integration prototype)

> "The current AI implementation is a prototype integration layer and must
> not be interpreted as an official OIL SIF prediction methodology."

## Flow

Report (MySQL) -> POST /api/v1/analysis/reports/:id -> analysis.controller
-> analysis.service.js -> load report -> HTTP -> Python AI service
-> Zod-validate response -> resolve Life-Saving Rule code -> persist
AIAnalysis (MySQL) -> advance NEW -> ANALYZED -> return to client.

Python NEVER touches MySQL. The client NEVER supplies analysis text; the
report description in MySQL is the source of truth and is never modified.

## Frozen contract

Request (Node -> Python): `{ reportId: string, text: string, language: string | null }`

Response (Python -> Node): `{ sifPotential: bool, confidence: 0..1,
activity?, hazard?, barrierFailure?, consequence?, lifeSavingRuleCode?,
priority: LOW|MEDIUM|HIGH|CRITICAL, evidence: [exact substrings of text],
extractedEntities: {equipment, hazards, barriers, activities},
modelName, modelVersion }`

## Node validation (before any persistence)

- Zod strict schema (confidence 0..1, priority enum, non-empty model fields).
- Evidence: every item must be a substring of the original description
  (case/whitespace-normalized); sifPotential=true requires >= 1 evidence.
- `lifeSavingRuleCode` resolved against LifeSavingRule table; unknown -> NULL.
  Rules are never auto-created.
- Malformed/invalid AI data -> analysis FAILED, safe 502 API error, nothing
  malformed reaches MySQL.

## Lifecycle / persistence

- PENDING row ensured before the Python call (previous COMPLETED payload kept
  until a new response validates); validated success -> COMPLETED + report
  NEW -> ANALYZED in one transaction; any failure -> FAILED (payload kept).
- One Report -> one AIAnalysis row; re-analysis updates in place, no duplicates.
- UNDER_REVIEW / ANALYZED / CLOSED statuses are never moved backwards or
  reopened by analysis.

## Errors

AI_SERVICE_UNAVAILABLE (503) / AI_SERVICE_TIMEOUT (504, 30s default) /
AI_SERVICE_BAD_RESPONSE (502: 4xx/5xx/malformed JSON) /
AI_RESPONSE_VALIDATION_FAILED (502) / REPORT_NOT_FOUND (404) /
REPORT_DESCRIPTION_EMPTY (422). No stack traces, secrets, or paths leak.

## Python layout (stdlib only, no framework, no API keys)

- preprocessing/text.py — normalization + exact-span search
- rules/prototype_rules.py — PROTO-* keyword rules (NOT official methodology)
- extraction/evidence.py — exact-substring evidence + entity buckets
- inference/pipeline.py — highest-confidence rule wins; no match -> LOW/False
- models/registry.py — model-name -> pipeline map (plug real ML in later)
- schemas/contract.py — frozen contract + request validation
- main.py — GET /health, POST /analyze (1 MB cap, no tracebacks to clients)

## Env

AI_SERVICE_URL (default http://localhost:8000), AI_TIMEOUT_MS (default 30000).
Backend:5002, AI:8000, MySQL:3306, DB oil_sif_sentinel.
