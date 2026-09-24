"""Evidence extraction: every evidence string MUST be an exact substring of
the original report text (original casing preserved). Nothing is fabricated:
a rule only fires when one of its phrases is found verbatim in the text.
"""

from preprocessing.text import find_span


def extract_evidence(text, matched_rules):
    """Collect deduplicated exact-match spans for all fired rules."""
    evidence = []
    for rule, phrase in matched_rules:
        span = find_span(text, phrase)
        if span and span not in evidence:
            evidence.append(span)
    return evidence


def extract_entities(text, fired_rules):
    """Naive entity buckets derived only from fired prototype rules."""
    entities = {"equipment": [], "hazards": [], "barriers": [], "activities": []}
    for rule in fired_rules:
        if rule["hazard"] and rule["hazard"] not in entities["hazards"]:
            entities["hazards"].append(rule["hazard"])
        if rule["barrierFailure"] and rule["barrierFailure"] not in entities["barriers"]:
            entities["barriers"].append(rule["barrierFailure"])
        if rule["activity"] and rule["activity"] not in entities["activities"]:
            entities["activities"].append(rule["activity"])
    return entities
