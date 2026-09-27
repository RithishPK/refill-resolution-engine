"""Completeness check: what the system has vs what it still needs to resolve
the case. Deterministic derivation from the blocker - answers 'what is missing.'"""
from .states import Blocker

# Everything an intake gives us is considered present; the blocker tells us
# which additional element is the one still missing.
BASE_PRESENT = ["Patient identity", "Medication", "Pharmacy", "Prescription history"]

MISSING_BY_BLOCKER = {
    Blocker.NO_REFILLS.value: ["Provider authorization"],
    Blocker.PROVIDER_APPROVAL.value: ["Provider authorization"],
    Blocker.CLINICAL_REVIEW.value: ["Provider authorization", "Recent clinical review"],
    Blocker.VISIT_REQUIRED.value: ["Provider authorization", "Recent visit"],
    Blocker.INFO_MISSING.value: ["Complete prescription details"],
    Blocker.INSURANCE_PA.value: ["Insurance clearance"],
    Blocker.UNKNOWN.value: ["Reason for the block"],
}


def completeness(case) -> list[dict]:
    missing = MISSING_BY_BLOCKER.get(case.blocker, [])
    items = [{"label": p, "status": "present"} for p in BASE_PRESENT]
    items += [{"label": m, "status": "missing"} for m in missing]
    return items
