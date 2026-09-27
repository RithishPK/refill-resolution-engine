"""The intelligence layer.

Design choice you can defend: the core classifier is deterministic (rules), so the
live demo never breaks and every decision is explainable. An LLM is an OPTIONAL
enhancer (set ANTHROPIC_API_KEY + USE_LLM=1), never a hard dependency.

Every function here is bound to one allowlisted AI capability (see ai_policy.py).
The AI can read, classify, summarize, recommend and draft. It has no code path to
prescribe, change a medication, approve a renewal, or advance state.
"""
import os
from .states import Blocker, BLOCKER_NEXT_ACTION
from .ai_policy import ai_capability

KEYWORDS = {
    Blocker.NO_REFILLS.value: ["no refills", "0 refills", "refills: 0", "out of refills", "no refill left", "refills remaining: 0"],
    Blocker.PROVIDER_APPROVAL.value: ["needs approval", "provider approval", "new rx", "reauthorize", "renew", "re-authorization"],
    Blocker.VISIT_REQUIRED.value: ["needs to be seen", "office visit", "follow-up", "hasn't been seen", "annual visit", "overdue for", "check-in required"],
    Blocker.INFO_MISSING.value: ["missing", "unclear", "which dose", "unreadable", "clarify", "illegible", "incomplete"],
    Blocker.CLINICAL_REVIEW.value: ["review condition", "recent labs", "bp reading", "monitor", "clinical review", "a1c", "lab results"],
    Blocker.INSURANCE_PA.value: ["prior auth", "pa required", "not covered", "step therapy", "formulary", "insurance denied", "pbm"],
}

BLOCKER_PHRASE = {
    Blocker.NO_REFILLS.value: "no refills remaining",
    Blocker.PROVIDER_APPROVAL.value: "provider approval required",
    Blocker.VISIT_REQUIRED.value: "a visit is required before renewal",
    Blocker.INFO_MISSING.value: "prescription details are unclear",
    Blocker.CLINICAL_REVIEW.value: "a clinical review is required",
    Blocker.INSURANCE_PA.value: "prior authorization is required",
    Blocker.UNKNOWN.value: "the reason is unclear and needs human triage",
}


@ai_capability("CLASSIFY_REQUEST")
def classify(raw: str) -> dict:
    text = (raw or "").lower()
    scores, matched = {}, {}
    for blocker, kws in KEYWORDS.items():
        hits = [k for k in kws if k in text]
        if hits:
            scores[blocker] = len(hits)
            matched[blocker] = hits
    if not scores:
        return {
            "blocker": Blocker.UNKNOWN.value,
            "confidence": 0.35,
            "reasoning": "No clear signal in the inbound request. Reason unclear, routing to a human to triage instead of guessing.",
        }
    blocker = max(scores, key=scores.get)
    top = scores[blocker]
    clean_win = sum(1 for s in scores.values() if s == top) == 1
    confidence = round(min(0.95, 0.5 + 0.13 * top + (0.12 if clean_win else 0.0)), 2)
    cues = ", ".join(f'"{c}"' for c in matched[blocker][:3])
    reasoning = f"Detected {blocker.replace('_', ' ')} from cues {cues} in the inbound request."
    return {"blocker": blocker, "confidence": confidence, "reasoning": reasoning}


@ai_capability("CREATE_DRAFT_MESSAGE")
def build_draft(blocker: str, case) -> str:
    med, pt = case.medication, case.patient_name
    if blocker in (Blocker.NO_REFILLS.value, Blocker.PROVIDER_APPROVAL.value, Blocker.CLINICAL_REVIEW.value):
        return (f"To provider: Refill authorization requested for {pt}, {med}. "
                f"No refills remaining on file. Please approve renewal, request a visit, "
                f"or decline. [Draft, review before sending.]")
    if blocker == Blocker.VISIT_REQUIRED.value:
        return (f"To patient ({pt}): Your {med} refill needs a quick check-in with your "
                f"provider before it can be renewed. Here are the next available slots... "
                f"[Draft, review before sending.]")
    if blocker == Blocker.INFO_MISSING.value:
        return (f"To pharmacy: The {med} request for {pt} is missing details needed to "
                f"proceed (dose or quantity unclear). Requesting clarification. [Draft.]")
    if blocker == Blocker.INSURANCE_PA.value:
        return (f"Prior authorization draft for {pt}, {med}: clinical justification, "
                f"diagnosis code, and prior therapy history pre-filled for provider sign-off. [Draft.]")
    return "No draft generated. Escalating to a human."


@ai_capability("GENERATE_SUMMARY")
def summarize(case) -> str:
    phrase = BLOCKER_PHRASE.get(case.blocker, "review required")
    left = ""
    if case.days_left is not None:
        left = f" Patient has about {case.days_left} day(s) of medication left."
    return (f"Refill requested via {case.channel} for {case.medication}: {phrase}.{left} "
            f"Awaiting the responsible party; clinical decision stays with the provider.")


@ai_capability("RECOMMEND_ACTION")
def analyze(case) -> dict:
    c = classify(case.raw_request)
    blocker = c["blocker"]
    action = BLOCKER_NEXT_ACTION.get(Blocker(blocker), "escalate")
    draft = build_draft(blocker, case)
    result = {**c, "recommended_action": action, "draft": draft}
    if os.getenv("ANTHROPIC_API_KEY") and os.getenv("USE_LLM") == "1":
        try:
            result = _llm_enhance(case, result)
        except Exception:
            pass  # graceful degradation: rules-based result still stands
    return result


def redact(text: str, case) -> str:
    """Minimal de-identification: strip the direct identifiers we hold before any
    text leaves for an external model. Production would use a full PHI de-id service."""
    out = text or ""
    if case.patient_name:
        out = out.replace(case.patient_name, "[PATIENT]")
    if case.patient_ref:
        out = out.replace(case.patient_ref, "[REF]")
    return out


def _llm_enhance(case, base: dict) -> dict:
    """Optional. Sharpen reasoning + draft via an LLM, returning strict JSON.
    Falls back silently to the rules result on any error (see analyze)."""
    import json, anthropic
    client = anthropic.Anthropic()
    prompt = (
        "You are a triage assistant for a pharmacy refill workflow. "
        "Given the inbound request, return ONLY JSON with keys: blocker, confidence "
        "(0-1), reasoning (one sentence), draft (a short message to the responsible "
        "party). Do not make clinical approval decisions, only classify and draft.\n\n"
        f"Allowed blockers: {[b.value for b in Blocker if b.value != 'none']}\n"
        f"Inbound ({case.channel}): {redact(case.raw_request, case)}"
    )
    msg = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    data = json.loads(text.strip().strip("`").replace("json", "", 1))
    return {**base, **{k: data[k] for k in ("blocker", "confidence", "reasoning", "draft") if k in data}}
