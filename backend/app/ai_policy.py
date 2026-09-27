"""AI capability allowlist - enforced, not just documented.

The AI service may only read, classify, summarize, recommend, and draft. It is
denied every state-changing or clinical capability. Any AI function must declare
its capability via @ai_capability; declaring one that is not on the allowlist
fails at import time, so an unsafe AI action cannot even be defined.
"""
from functools import wraps

AI_ALLOWED = frozenset({
    "READ_REFILL_CONTEXT",
    "CLASSIFY_REQUEST",
    "GENERATE_SUMMARY",
    "RECOMMEND_ACTION",
    "CREATE_DRAFT_MESSAGE",
})

AI_DENIED = frozenset({
    "PRESCRIBE",
    "CHANGE_MEDICATION",
    "DELETE_PATIENT",
    "APPROVE_RENEWAL",
    "ADVANCE_STATE",
})


class AICapabilityError(Exception):
    pass


def ai_capability(capability: str):
    """Decorator: binds an AI function to a single allowlisted capability.
    Raises at import if the capability is denied or unknown."""
    if capability not in AI_ALLOWED:
        raise AICapabilityError(
            f"AI capability '{capability}' is not on the allowlist. "
            f"Denied or unknown capabilities cannot be granted to the AI service."
        )

    def deco(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            return fn(*args, **kwargs)
        wrapper.ai_capability = capability
        return wrapper
    return deco


def policy() -> dict:
    """Exposed to the UI's Trust page so the boundary is visible to a buyer."""
    return {"allowed": sorted(AI_ALLOWED), "denied": sorted(AI_DENIED)}
