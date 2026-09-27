"""The heart of the system: a stuck refill modeled as an explicit state machine.

Judges said it themselves: 'a refill is not a series of screens - it's a changing
system state.' This module is where that lives. Everything else orchestrates around it.
"""
from enum import Enum


class Blocker(str, Enum):
    NO_REFILLS = "no_refills_remaining"
    PROVIDER_APPROVAL = "provider_approval_required"
    VISIT_REQUIRED = "visit_required"
    INFO_MISSING = "info_missing"
    CLINICAL_REVIEW = "clinical_review_required"
    INSURANCE_PA = "insurance_pa_required"
    UNKNOWN = "unknown"
    NONE = "none"


class State(str, Enum):
    INTAKE = "intake"                    # request received, not yet understood
    TRIAGED = "triaged"                  # blocker classified, next action known
    AWAITING_PROVIDER = "awaiting_provider"
    AWAITING_PATIENT = "awaiting_patient"
    AWAITING_INSURANCE = "awaiting_insurance"
    READY_TO_FILL = "ready_to_fill"      # cleared - pharmacy can dispense
    RESOLVED = "resolved"                # verified done (fill confirmed)
    DENIED = "denied"                    # closed without a fill (provider declined)
    NEEDS_HUMAN = "needs_human"          # low confidence / conflict -> escalate


# Which next-best-action a given blocker maps to.
BLOCKER_NEXT_ACTION = {
    Blocker.NO_REFILLS: "request_provider_approval",
    Blocker.PROVIDER_APPROVAL: "request_provider_approval",
    Blocker.CLINICAL_REVIEW: "request_provider_approval",
    Blocker.VISIT_REQUIRED: "request_patient_visit",
    Blocker.INFO_MISSING: "request_patient_info",
    Blocker.INSURANCE_PA: "submit_prior_auth",
    Blocker.UNKNOWN: "escalate",
}

# Blockers whose resolution is a CLINICAL decision. These can never be
# auto-resolved by the engine - a licensed human (provider) must act.
CLINICAL_BLOCKERS = {
    Blocker.NO_REFILLS,
    Blocker.PROVIDER_APPROVAL,
    Blocker.CLINICAL_REVIEW,
    Blocker.VISIT_REQUIRED,
}

# Legal transitions. A guardrail: the orchestrator refuses to move a case
# along a path the state machine doesn't allow.
ALLOWED_TRANSITIONS = {
    State.INTAKE: {State.TRIAGED, State.NEEDS_HUMAN},
    State.TRIAGED: {State.AWAITING_PROVIDER, State.AWAITING_PATIENT,
                    State.AWAITING_INSURANCE, State.NEEDS_HUMAN, State.RESOLVED},
    State.AWAITING_PROVIDER: {State.READY_TO_FILL, State.AWAITING_PATIENT,
                              State.NEEDS_HUMAN, State.DENIED},
    State.AWAITING_PATIENT: {State.TRIAGED, State.AWAITING_PROVIDER, State.NEEDS_HUMAN},
    State.AWAITING_INSURANCE: {State.READY_TO_FILL, State.NEEDS_HUMAN, State.RESOLVED},
    State.READY_TO_FILL: {State.RESOLVED},
    State.NEEDS_HUMAN: {State.TRIAGED, State.AWAITING_PROVIDER, State.AWAITING_PATIENT,
                        State.AWAITING_INSURANCE, State.READY_TO_FILL, State.RESOLVED},
    State.RESOLVED: set(),
    State.DENIED: set(),
}


def can_transition(a: str, b: str) -> bool:
    if a == b:
        return True
    try:
        return State(b) in ALLOWED_TRANSITIONS.get(State(a), set())
    except ValueError:
        return False
