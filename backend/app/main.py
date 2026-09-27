from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .store import store
from .models import Case, Event, priority_for
from .orchestrator import do_action, ActionError
from .metrics import compute
from .context import completeness
from .ai_policy import policy
from .seed import seed

app = FastAPI(title="Refill Resolution Engine")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

seed()  # populate the in-memory store at startup


@app.get("/api/cases")
def list_cases(state: str | None = None):
    return store.list_cases(state)


@app.get("/api/cases/{case_id}")
def get_case(case_id: int):
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(404, "case not found")
    return {
        "case": case,
        "events": store.events_for(case_id),
        "checklist": completeness(case),
    }


@app.post("/api/cases")
def create_case(payload: dict):
    days_left = payload.get("days_left")
    case = Case(
        patient_name=payload.get("patient_name", "New Patient"),
        patient_ref=payload.get("patient_ref", "PT-0000"),
        medication=payload.get("medication", "Unknown med"),
        raw_request=payload.get("raw_request", ""),
        channel=payload.get("channel", "portal"),
        days_left=days_left,
        priority=priority_for(days_left),
    )
    store.add_case(case)
    store.add_event(Event(case_id=case.id, actor="system", action="intake",
                          detail=f"Received via {case.channel}", from_state="", to_state="intake"))
    return case


@app.post("/api/cases/{case_id}/action")
def act(case_id: int, body: dict, x_role: str = Header(default="tech")):
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(404, "case not found")
    try:
        case = do_action(case, body.get("action"), x_role, body.get("payload", {}))
    except ActionError as e:
        raise HTTPException(400, str(e))
    return case


@app.get("/api/metrics")
def metrics():
    return compute()


@app.get("/api/ai-policy")
def ai_policy():
    return policy()


@app.post("/api/reset")
def reset():
    seed(reset=True)
    return {"ok": True}
