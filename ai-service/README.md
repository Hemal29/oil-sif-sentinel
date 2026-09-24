# AI Service — OIL SIF Sentinel (Phase 7 SIF Precursor AI engine)

> "Heuristic prototype output for system integration testing; not a
> production safety prediction model." Must NOT be interpreted as official
> OIL SIF methodology. Rule codes use the `SIF-PROTOTYPE-*` namespace and
> are NOT official OIL Life-Saving Rule codes.

Layered deterministic pipeline (no randomness, no API key, stdlib only):

```text
Report -> screening -> deterministic trigger rules -> heuristic risk score
  -> route (AUTO_CLOSE / UNCERTAIN / PRIORITY / ABSTAIN)
  -> rule-based extraction (escalated routes) -> validation / repair
  -> assessment  (+ clarification questions when ABSTAIN)
```

## Run

```bash
cd ai-service
AI_SERVICE_PORT=8000 python3 src/main.py
curl http://localhost:8000/health
```

Optional: `SIF_EXTRACTION_PROVIDER=rule-based` (default). `local-7b` and
`hosted` are reserved names that fail loudly until a real model is wired —
never faked.

## Endpoints

- `GET /health` -> `{status, service, modelName, modelVersion, engineVersion, taxonomyVersion}`
- `GET /v1/taxonomy` -> versioned prototype rule taxonomy (codes + labels)
- `POST /v1/reports/assess` with `{record_id, text, source?, reported_at?,
  metadata?}` (+ optional `Idempotency-Key` header) -> layered assessment
  contract (see `src/schemas/assessment.py`). Never touches MySQL.
- `POST /analyze` with `{reportId, text, language}` -> frozen legacy
  contract (see `src/schemas/contract.py`), derived from the same engine
  for backward compatibility.

## Layout

```text
src/
  triage/       screening.py, rules.py (versioned taxonomy), risk.py
                (heuristic 0..1 score), router.py, clarification.py
  extraction/   extractor.py (provider abstraction), validator.py, repair.py
  schemas/      assessment.py (strict layered contract), contract.py (legacy)
  inference/    assess.py (pipeline), pipeline.py (legacy adapter)
```

## Test (no pytest needed) + eval dataset

```bash
python3 -m unittest discover -s tests -v   # 35 unit tests
python3 eval/run.py                         # 12-case development dataset
```
