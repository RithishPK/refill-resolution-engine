"""Minimal role-based access control. Faked identities, real enforcement.

The point for the judges: the *clinical* decision (provider_decision) is gated to
the provider role. No amount of AI confidence lets a tech approve a prescription.
"""
ROLES = ["tech", "pharmacist", "provider", "admin", "system"]

PERMISSIONS = {
    "triage": {"tech", "pharmacist", "admin", "system"},
    "request_provider_approval": {"tech", "pharmacist", "admin"},
    "provider_decision": {"provider"},        # clinical gate: provider only, no admin override
    "submit_prior_auth": {"tech", "pharmacist", "admin"},
    "insurance_decision": {"tech", "pharmacist", "admin"},
    "request_patient_info": {"tech", "pharmacist", "admin"},
    "request_patient_visit": {"tech", "pharmacist", "admin"},
    "mark_resolved": {"pharmacist", "admin"},          # verify the fill happened
    "escalate": {"tech", "pharmacist", "provider", "admin"},
}


def can(role: str, action: str) -> bool:
    return role in PERMISSIONS.get(action, set())
