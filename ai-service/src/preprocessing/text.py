"""Text preprocessing: input is untrusted data, never instructions.

Only normalization for matching; the original text is never modified here
(the caller keeps the pristine copy for evidence extraction).
"""

import re

_WS_RUN = re.compile(r"\s+")


def normalize(text):
    """Lowercase + collapse whitespace for matching/comparison."""
    return _WS_RUN.sub(" ", text.lower()).strip()


def find_span(text, phrase):
    """Return the exact original-case substring of the first
    case-insensitive occurrence of phrase in text, else None."""
    match = re.search(re.escape(phrase), text, flags=re.IGNORECASE)
    return match.group(0) if match else None
