# Refill Resolution Engine

A staff command center that takes a **stuck prescription refill**, understands *why*
it's stuck, coordinates the right next action, keeps a human in the loop for anything
clinical, verifies the work actually happened, and reports measurable value.

> Built for the 24-hour hackathon: "Closing the Prescription Refill Gap."
> B2B — the user is the **pharmacy tech / practice staff**, not the patient.

---

## The one idea

A refill isn't a screen — it's a **changing system state**. This project models it as
an explicit state machine and wraps an orchestration layer around it:

```
understand → what's missing → what's blocking → who/what resolves it
          → act → VERIFY it happened → new state
```

Everything else (UI, AI, metrics, RBAC) hangs off that loop.

---

## Run it

**Backend** (any Python 3.10+, including 3.14 — no database, no ORM):
```bash
cd backend
pip install -r requirements.txt          # just fastapi + uvicorn
uvicorn app.main:app --reload --port 8000
```
Windows venv (optional): `python -m venv .venv` then `.venv\Scripts\activate`
(the `source .../activate` form is bash-only; on Windows CMD use the `Scripts` path).
Data lives in an in-memory store — restart the server to reset, or hit `POST /api/reset`.

**Frontend** (Node 18+):
```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Open the app, and try this demo path (switch roles with the top-right selector):
1. Pick **Maria Gomez** → **Triage with AI** (watch it classify the blocker + draft a message).
2. **Send provider approval request** → state goes to *awaiting provider*.
3. As **tech**, click **Approve renewal** → blocked (clinical gate). Switch role to **provider** → it works.
4. Switch to **pharmacist** → **Confirm fill → resolve** (this is the *verification* step).
5. Watch the metrics bar (touches/refill, resolution time) update. Try **Tom Becker** (garbled request) → it routes to *Needs human* instead of guessing.

Set `ANTHROPIC_API_KEY` and `USE_LLM=1` to turn on the optional LLM enhancer; without them
the deterministic classifier runs and the demo still works.

---

## How it maps to the three evaluation tracks

### 01 — Build the product (Product · Engineering · Cybersecurity)
- **Problem framing:** we don't digitize the existing fax/phone dance — we make the
  *stuck state itself* the unit of work.
- **Architecture:** React (Vite) SPA → FastAPI → in-memory store. One `orchestrator`
  is the only path that mutates state, so guardrails live in one place. (`backend/app/`)
- **Experience:** a queue where every case shows *what's happening and what's next*.
- **Security & trust:** role-based access (`rbac.py`), the clinical decision gated to
  the provider role, an append-only audit log, and de-identified patient refs — never
  raw PHI — in event logs. LLM is optional and would run under a BAA / de-identified
  input in production. *(Say this out loud — most teams skip security entirely.)*
- **Reliability:** the LLM has a deterministic fallback (`brain.analyze`), so a
  third-party outage never breaks triage.
- **Observability:** the audit trail answers "why is this stuck and what happened."

### 02 — Design the intelligence (Systems · AI · Decisioning)
- **Systems thinking:** `states.py` — canonical blockers, states, and *legal transitions*.
- **AI judgment:** AI classifies messy input, recommends the next action, and drafts the
  message. It never makes the clinical call. Low confidence (<0.5) → routes to a human
  instead of acting.
- **Human-in-the-loop:** `provider_decision` is RBAC-gated; `mark_resolved` is a human
  verifying the fill happened.
- **Guardrails & verification:** illegal transitions are refused; resolution requires an
  explicit human confirmation step.
- **Explainability:** every case carries `reasoning` + a confidence score; every action
  writes an audit event.

### 03 — Strategize the funnel (Marketing · Sales · Customer Success)
See `GTM.md` (draft in your next work session). Core thesis to defend:
- **ICP:** chronic-care-heavy physician groups / practices (high refill volume, they own
  the provider-intervention bottleneck, staff hours are measurable). Pharmacies are the
  wedge/channel.
- **Value metric:** touches per refill ↓, time-to-resolution ↓, staff hours saved,
  fewer patient "where's my meds" calls — all already computed in `metrics.py`.
- **Funnel:** the product *instruments its own value* (metrics bar) → land one clinic on
  a pilot → prove hours saved → expand by provider seat. Pricing: per-provider/month or
  per-resolved-case.

---

## File map
```
backend/app/
  states.py        # state machine: blockers, states, legal transitions  ← the spine
  orchestrator.py  # the only path that changes state; enforces guardrails
  brain.py         # intelligence: classify + recommend + draft + summarize (LLM optional)
  ai_policy.py     # enforced AI capability allowlist (granted vs denied)
  context.py       # what info is present vs missing per case
  rbac.py          # roles + permissions; the clinical gate
  metrics.py       # measurable value
  store.py         # in-memory repository (the seam to swap in a real DB)
  models.py        # Case + Event dataclasses (+ audit log)
  seed.py          # a vivid, varied demo queue
  main.py          # FastAPI routes
frontend/src/
  App.jsx          # role switcher, metrics, queue + detail
  components/       # MetricsBar, Queue, CaseDetail (AI panel + actions + timeline)
```

## What we deliberately left out (product judgment)
Real Surescripts/EHR/PBM integrations (mocked via seed + channels), a patient-facing app
(status only), real identity/SSO (faked roles), multi-tenant isolation. All are "next,"
none are needed to prove the core loop.
