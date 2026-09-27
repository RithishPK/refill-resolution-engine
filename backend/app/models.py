from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Case:
    """One stuck refill = one case with a lifecycle state."""
    patient_name: str
    patient_ref: str                 # de-identified reference, never raw PHI in logs
    medication: str
    raw_request: str                 # messy inbound text (fax/portal/phone note)
    channel: str = "portal"          # erx | fax | portal | phone
    days_left: Optional[int] = None  # days of medication the patient has left
    priority: str = "normal"         # urgent | high | normal  (derived from days_left)
    blocker: str = "none"
    state: str = "intake"
    confidence: float = 0.0
    recommended_action: str = ""
    draft: str = ""                  # AI-drafted message, human edits before send
    summary: str = ""                # AI one-line case summary for the provider
    reasoning: str = ""              # explainability: why the engine decided this
    assigned_role: str = ""
    touches: int = 0                 # hand-offs so far (the metric we drive down)
    id: Optional[int] = None
    created_at: datetime = field(default_factory=_now)
    resolved_at: Optional[datetime] = None


@dataclass
class Event:
    """Append-only audit log entry - observability for 'why is this stuck.'"""
    case_id: int
    actor: str = "system"            # system | tech | pharmacist | provider | admin
    action: str = ""
    detail: str = ""
    from_state: str = ""
    to_state: str = ""
    id: Optional[int] = None
    ts: datetime = field(default_factory=_now)


def priority_for(days_left: Optional[int]) -> str:
    """Urgency from how soon the patient runs out. Deterministic, not AI."""
    if days_left is None:
        return "normal"
    if days_left <= 1:
        return "urgent"
    if days_left <= 5:
        return "high"
    return "normal"
