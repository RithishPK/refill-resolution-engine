"""Orchestration core: understand -> decide -> act -> verify -> new state.

Every state change flows through here so guardrails (RBAC, legal transitions,
the clinical gate) are enforced in ONE place and every change is audit-logged.
"""
from datetime import datetime, timezone
from . import rbac, brain
from .models import Event, priority_for
from .store import store
from .states import State, Blocker, CLINICAL_BLOCKERS, can_transition


class ActionError(Exception):
    pass


def _log(case, actor, action, detail, frm, to):
    store.add_event(Event(case_id=case.id, actor=actor, action=action,
                          detail=detail, from_state=frm, to_state=to))


def do_action(case, action: str, role: str, payload: dict):
    if not rbac.can(role, action):
        raise ActionError(f"Role '{role}' is not permitted to '{action}'.")

    payload = payload or {}
    frm = case.state
    to = frm
    detail = ""

    if action == "triage":
        r = brain.analyze(case)
        case.blocker = r["blocker"]
        case.confidence = r["confidence"]
        case.recommended_action = r["recommended_action"]
        case.draft = r["draft"]
        case.reasoning = r["reasoning"]
        case.summary = brain.summarize(case)
        case.priority = priority_for(case.days_left)
        is_clinical = Blocker(case.blocker) in CLINICAL_BLOCKERS
        case.assigned_role = "provider" if is_clinical else "tech"
        # guardrail: low confidence never auto-advances - it stops for a human
        to = State.NEEDS_HUMAN.value if case.confidence < 0.5 else State.TRIAGED.value
        detail = f"{case.blocker} @ {int(case.confidence * 100)}% -> {case.recommended_action}"

    elif action == "request_provider_approval":
        to = State.AWAITING_PROVIDER.value
        detail = "Provider approval requested (draft sent for sign-off)."

    elif action == "provider_decision":
        # CLINICAL GATE - only reachable by provider role (enforced above).
        decision = payload.get("decision", "approve")
        if decision == "approve":
            to, detail = State.READY_TO_FILL.value, "Provider approved renewal."
        elif decision == "deny":
            to, detail = State.DENIED.value, "Provider declined the renewal; case closed without a fill."
        elif decision == "visit":
            to, detail = State.AWAITING_PATIENT.value, "Provider requires a visit first."
        else:
            raise ActionError("decision must be approve | deny | visit")

    elif action == "submit_prior_auth":
        to, detail = State.AWAITING_INSURANCE.value, "Prior authorization submitted to PBM."

    elif action == "insurance_decision":
        approved = payload.get("approved", True)
        to = State.READY_TO_FILL.value if approved else State.NEEDS_HUMAN.value
        detail = "PBM approved." if approved else "PBM denied - escalating for appeal/alternative."

    elif action == "request_patient_info":
        to, detail = State.AWAITING_PATIENT.value, "Requested missing info from patient."

    elif action == "request_patient_visit":
        to, detail = State.AWAITING_PATIENT.value, "Asked patient to schedule a visit."

    elif action == "mark_resolved":
        # VERIFICATION: a human confirms the fill actually happened.
        to, detail = State.RESOLVED.value, payload.get("note", "Fill confirmed - refill complete.")

    elif action == "escalate":
        to, detail = State.NEEDS_HUMAN.value, payload.get("note", "Escalated to a human.")

    else:
        raise ActionError(f"Unknown action '{action}'.")

    if not can_transition(frm, to):
        raise ActionError(f"Illegal transition {frm} -> {to}.")

    case.state = to
    case.touches += 1
    if to == State.RESOLVED.value and case.resolved_at is None:
        case.resolved_at = datetime.now(timezone.utc)

    _log(case, role, action, detail, frm, to)
    return case
