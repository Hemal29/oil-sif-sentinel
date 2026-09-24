"""Clarification questions for ABSTAIN route.

Questions are generated only from missing information dimensions relevant
to the (weakly) hinted hazard — never irrelevant, never fabricated facts.
Each question maps to a dimension the HSE reviewer needs: height, isolation,
permit, protection, exposure, atmosphere, ignition, load, traffic, substance.
"""

from triage.rules import BY_CODE

DIMENSION_QUESTIONS = {
    "SIF-PROTOTYPE-WORKING-AT-HEIGHT": [
        "What was the working height?",
        "Was fall protection (harness/lanyard) being used?",
        "Was the platform secured and was the edge protected?",
        "Was the worker exposed to an unprotected edge?",
    ],
    "SIF-PROTOTYPE-ENERGY-ISOLATION": [
        "Was the equipment isolated and de-energized before work?",
        "Was lockout/tagout applied and verified?",
        "What energy source was involved (electrical/mechanical/pressure)?",
    ],
    "SIF-PROTOTYPE-ELECTRICAL-EXPOSURE": [
        "What electrical equipment was involved?",
        "Was the circuit de-energized and tested dead?",
        "Was the worker qualified for electrical work?",
    ],
    "SIF-PROTOTYPE-LINE-OF-FIRE": [
        "Where was the worker positioned relative to the load/energy path?",
        "Was an exclusion zone established?",
        "What object or energy could have struck the worker?",
    ],
    "SIF-PROTOTYPE-HOT-WORK": [
        "Was a hot work permit issued?",
        "Was a fire watch present with extinguishers?",
        "Were flammables removed or shielded nearby?",
    ],
    "SIF-PROTOTYPE-CONFINED-SPACE": [
        "Was a confined space entry permit issued?",
        "Was gas testing done before and during entry?",
        "Was a standby attendant posted outside?",
    ],
    "SIF-PROTOTYPE-BYPASSING-CONTROLS": [
        "Which safeguard or interlock was bypassed?",
        "Why was it bypassed and who authorized it?",
        "Was the equipment returned to safe state afterwards?",
    ],
    "SIF-PROTOTYPE-MECHANICAL-LIFTING": [
        "What was being lifted and what equipment was used?",
        "Was anyone positioned under or near the suspended load?",
        "Was the rigging inspected and rated for the load?",
    ],
    "SIF-PROTOTYPE-DRIVING": [
        "What vehicle was involved and where?",
        "Was a spotter/banksman present during reversing?",
        "What was the speed and road condition?",
    ],
    "SIF-PROTOTYPE-PRESSURE-RELEASE": [
        "Was the line depressurized and drained before breaking?",
        "Was a line break permit issued?",
        "What fluid/gas was in the line?",
    ],
    "SIF-PROTOTYPE-CHEMICAL-EXPOSURE": [
        "Which chemical was involved?",
        "Was respiratory/personal protection used?",
        "Were workers evacuated or decontaminated?",
    ],
    "SIF-PROTOTYPE-FIRE-EXPLOSION": [
        "What ignited and what fuel was present?",
        "Were gas detectors/alarms working?",
        "Was anyone injured or exposed to smoke/heat?",
    ],
}

GENERIC_QUESTIONS = [
    "What activity was being performed when this happened?",
    "Where exactly did it happen (unit/area/equipment)?",
    "Who was exposed and how close were they to the hazard?",
    "What barriers or controls were in place at the time?",
]


def build_clarification(reason, matched_rules, limit=4):
    """Return {reason, suggestedQuestions} for ABSTAIN route."""
    questions = []
    for match in matched_rules:
        for question in DIMENSION_QUESTIONS.get(match["code"], []):
            if question not in questions:
                questions.append(question)
            if len(questions) >= limit:
                break
        if len(questions) >= limit:
            break
    for question in GENERIC_QUESTIONS:
        if len(questions) >= limit:
            break
        if question not in questions:
            questions.append(question)
    return {"reason": reason, "suggestedQuestions": questions[:limit]}
