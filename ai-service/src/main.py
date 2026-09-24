"""OIL SIF Sentinel — SIF Precursor AI engine (Phase 7).

Stdlib only (http.server + json + re): no framework, no API keys.

  GET  /health               -> service + model identity
  GET  /v1/taxonomy          -> versioned rule taxonomy (codes + labels)
  POST /analyze              -> legacy frozen contract (backward compatible)
  POST /v1/reports/assess    -> layered SIF assessment contract

"Heuristic prototype output for system integration testing; not a
production safety prediction model." Must NOT be interpreted as official
OIL SIF methodology.

The service never touches MySQL — only Node.js does.
"""

import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models.registry import PIPELINES, DEFAULT_MODEL  # noqa: E402
from schemas.contract import (  # noqa: E402
    MODEL_NAME,
    MODEL_VERSION,
    validate_request as validate_legacy_request,
)
from schemas.assessment import validate_request as validate_assess_request  # noqa: E402
from inference.assess import assess_report  # noqa: E402
from triage.rules import RULES, TAXONOMY_VERSION  # noqa: E402

MAX_BODY_BYTES = 1024 * 1024  # 1 MB; reports are short text

# Minimal in-memory idempotency cache: Idempotency-Key -> response payload.
# Best-effort only (process-local); safe fallback is to recompute.
IDEMPOTENCY_CACHE = {}
IDEMPOTENCY_MAX_ENTRIES = 500


class Handler(BaseHTTPRequestHandler):
    server_version = "SIFEngine/1.0"

    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY_BYTES:
            return None, (413 if length > MAX_BODY_BYTES else 400,
                          {"error": "invalid or oversized body"})
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return None, (400, {"error": "malformed JSON"})
        return payload, None

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {
                "status": "ok",
                "service": "oil-sif-ai-service",
                "modelName": MODEL_NAME,
                "modelVersion": MODEL_VERSION,
                "engineVersion": "sif-engine-1.0.0",
                "taxonomyVersion": TAXONOMY_VERSION,
            })
        elif self.path == "/v1/taxonomy":
            self._send(200, {
                "taxonomyVersion": TAXONOMY_VERSION,
                "note": "Prototype taxonomy for triage research; NOT official OIL Life-Saving Rules.",
                "rules": [
                    {"code": r["code"], "label": r["label"],
                     "hazardEnergy": r["hazard_energy"], "barriers": r["barriers"]}
                    for r in RULES
                ],
            })
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path == "/analyze":
            self._handle_legacy()
        elif self.path == "/v1/reports/assess":
            self._handle_assess()
        else:
            self._send(404, {"error": "not found"})

    def _handle_legacy(self):
        payload, err = self._read_json()
        if err:
            self._send(*err)
            return
        try:
            report_id, text, language = validate_legacy_request(payload)
        except ValueError as exc:
            self._send(422, {"error": str(exc)})
            return
        try:
            # Report text is untrusted input data only — never instructions.
            result = PIPELINES[DEFAULT_MODEL](report_id, text, language)
        except Exception:  # never leak tracebacks to clients
            traceback.print_exc()
            self._send(500, {"error": "inference failed"})
            return
        self._send(200, result)

    def _handle_assess(self):
        payload, err = self._read_json()
        if err:
            self._send(*err)
            return
        try:
            record_id, text, metadata = validate_assess_request(payload)
        except ValueError as exc:
            self._send(422, {"error": str(exc)})
            return
        idem_key = self.headers.get("Idempotency-Key")
        if idem_key and idem_key in IDEMPOTENCY_CACHE:
            self._send(200, IDEMPOTENCY_CACHE[idem_key])
            return
        try:
            # Report text is untrusted input data only — never instructions.
            result = assess_report(record_id, text, metadata)
        except Exception:  # never leak tracebacks to clients
            traceback.print_exc()
            self._send(500, {"error": "inference failed"})
            return
        if idem_key:
            if len(IDEMPOTENCY_CACHE) >= IDEMPOTENCY_MAX_ENTRIES:
                IDEMPOTENCY_CACHE.pop(next(iter(IDEMPOTENCY_CACHE)))
            IDEMPOTENCY_CACHE[idem_key] = result
        self._send(200, result)

    def log_message(self, fmt, *args):  # quieter structured logs
        sys.stderr.write("[ai-service] %s\n" % (fmt % args))


def main():
    port = int(os.environ.get("AI_SERVICE_PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"[ai-service] listening on :{port} "
          f"(model={MODEL_NAME} v{MODEL_VERSION}, engine=sif-engine-1.0.0)", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
