"""Seed a vivid, varied queue so the demo tells a story on first load."""
from datetime import datetime, timedelta, timezone
from .store import store
from .models import Case, Event, priority_for
from .states import State

SEED = [
    dict(patient_name="Maria Gomez", patient_ref="PT-4821", medication="Lisinopril 10mg",
         channel="portal", days_left=3,
         raw_request="Refill request via app. Pharmacy note: 0 refills remaining, needs provider approval to renew."),
    dict(patient_name="James Okafor", patient_ref="PT-1190", medication="Metformin 500mg",
         channel="fax", days_left=12,
         raw_request="Faxed refill. Patient hasn't been seen in 14 months, annual visit / follow-up required before renewal."),
    dict(patient_name="Ana Petrova", patient_ref="PT-7734", medication="Atorvastatin 20mg",
         channel="phone", days_left=0,
         raw_request="Called in. Handwriting on original script illegible, which dose is unclear, need to clarify before filling."),
    dict(patient_name="David Kim", patient_ref="PT-3055", medication="Adderall XR 20mg",
         channel="portal", days_left=4,
         raw_request="Prior auth required. PBM says step therapy / not covered without documentation. Controlled substance."),
    dict(patient_name="Priya Nair", patient_ref="PT-6612", medication="Levothyroxine 75mcg",
         channel="erx", days_left=9,
         raw_request="Provider wants recent labs / clinical review (TSH) before authorizing continued refills."),
    dict(patient_name="Tom Becker", patient_ref="PT-2048", medication="Amlodipine 5mg",
         channel="portal", days_left=1,
         raw_request="Refill request. Note is garbled, no clear reason captured from the intake system."),
]


def seed(reset: bool = False) -> None:
    if reset:
        store.reset()
    if store.list_cases():
        return
    for row in SEED:
        row["priority"] = priority_for(row.get("days_left"))
        c = store.add_case(Case(**row))
        store.add_event(Event(case_id=c.id, actor="system", action="intake",
                              detail=f"Received via {c.channel}", from_state="", to_state=State.INTAKE.value))
    # one pre-resolved case so metrics have something to show on load
    done = Case(patient_name="Ellen Ruiz", patient_ref="PT-9001", medication="Sertraline 50mg",
                channel="portal", days_left=6, priority="normal",
                raw_request="0 refills remaining, needs provider approval.",
                blocker="no_refills_remaining", state=State.RESOLVED.value, confidence=0.83,
                recommended_action="request_provider_approval", touches=2,
                created_at=datetime.now(timezone.utc) - timedelta(hours=3),
                resolved_at=datetime.now(timezone.utc) - timedelta(hours=1))
    store.add_case(done)
