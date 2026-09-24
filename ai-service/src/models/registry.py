"""Model registry: maps model names to inference pipelines.

Only the prototype pipeline exists in Step 5. A real ML/transformer model
can be plugged in later behind the same interface.
"""

from inference.pipeline import run_prototype

PIPELINES = {
    "prototype": run_prototype,
}

DEFAULT_MODEL = "prototype"
