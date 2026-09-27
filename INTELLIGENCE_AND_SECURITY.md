# Refill Resolution Engine: Intelligence and Security Design

This document covers the two evaluation tracks that are decided on paper as much as
in code: **Design the intelligence** (Track 02) and the **Security and trust**
dimension of Track 01. Every claim here points at a real file in the repo, so it
doubles as an interview walkthrough. File references are in `backend/app/`.

The system answers six questions about any refill at any moment:

1. What is happening? (`state`)
2. Why is it stuck? (`blocker`, `reasoning`)
3. Who needs to act? (`assigned_role`, RBAC)
4. What should they do? (`recommended_action`, `draft`)
5. Did it actually happen? (the verification step)
6. What is the new state? (the transition, written to the audit log)

---

## Part A: Designing the intelligence

### 1. The core model: a stuck refill is a state machine

A refill that needs provider intervention is not a status field that flips from
pending to done. It is a case that moves through a small set of well-defined states,
with branches. We model that explicitly in `states.py`.

**States:** `intake`, `triaged`, `awaiting_provider`, `awaiting_patient`,
`awaiting_insurance`, `ready_to_fill`, `resolved`, `needs_human`.

**Blockers** (why a case is stuck): `no_refills_remaining`,
`provider_approval_required`, `visit_required`, `info_missing`,
`clinical_review_required`, `insurance_pa_required`.

The state machine defines which transitions are legal (`ALLOWED_TRANSITIONS`). A case
cannot jump from `intake` straight to `resolved`, and once a case is `resolved` no
further transitions are allowed. This single map is a guardrail: any attempt to move
a case along a path the machine does not permit is refused before anything changes.

Why this matters for the judges: it is the difference between a collection of screens
and a system. The state, not the screen, is the unit of work.

### 2. Where AI is used, and where it is deliberately not

The brief asks for AI judgment, meaning judgment about where AI belongs. Our rule:
AI reads, classifies, summarizes, recommends, and drafts. It never decides state and
never makes a clinical call. The boundary is enforced structurally in `brain.py`,
which has no function that mutates a case or advances clinical state.

| Task | Handled by | Why |
|---|---|---|
| Classify why a refill is stuck | AI (with rule fallback) | Messy free text, fax notes, portal messages need interpretation |
| Recommend the next administrative action | AI over a fixed action set | Maps a blocker to the right next step |
| Draft the provider message / prior-auth / patient note | AI | Saves staff time; a human edits and sends |
| Summarize the case for a provider | AI | One sentence instead of four messages |
| Legal state transitions | Deterministic (`states.py`) | Safety-critical, must be predictable |
| Access decisions | Deterministic (`rbac.py`) | Security, must be auditable |
| Approve or deny a renewal (clinical) | Human provider only | A clinical decision, never automated |

A chatbot bolted onto the workflow would fail this test. The AI here sits inside a
controlled loop, not on top of it.

### 3. The decision loop (orchestration)

`orchestrator.py` is the one and only path that changes a case. Concentrating every
transition in one function means the guardrails, RBAC checks, and audit logging live
in exactly one place and cannot be bypassed. The loop:

```
intake -> triage (AI classifies) -> triaged
       -> staff sends the recommended action -> awaiting_provider / patient / insurance
       -> the responsible party responds (human) -> ready_to_fill
       -> a human verifies the fill happened -> resolved
```

Each step writes an `Event` with the actor, the action, and the from and to states.
The orchestrator never trusts the AI to advance the case: triage sets the
recommendation, but a human action is what actually moves the case forward.

### 4. Context and memory

Continuity comes from two structures in `models.py`. The `Case` carries the current
picture: blocker, confidence, reasoning, recommended action, draft, assigned role,
and a running `touches` count. The append-only `Event` log carries the full history.
Together they let the system answer "why is this still stuck" at any time without
losing what happened earlier. Memory here is durable case state plus an immutable
timeline, not a chat transcript.

### 5. Uncertainty, missing and contradictory information

The system is built to stop rather than guess. In `orchestrator.py`, if triage
produces a confidence below 0.5 (for example, a garbled intake note with no clear
signal), the case is routed to `needs_human` instead of being auto-advanced. The
classifier in `brain.py` labels an unreadable request `unknown` with a low confidence
and an honest reason, rather than inventing a specific blocker. This is the "uncertainty and
failure" behaviour the rubric asks for: when the input is incomplete or contradictory,
the correct action is to escalate, not to act.

### 6. Human in the loop

The clinical decision is gated to the provider role. In `rbac.py`, `provider_decision`
is permitted only for `provider` and `admin`. A pharmacy tech physically cannot approve
a renewal: the orchestrator rejects the action before any state change. The final
`mark_resolved` is also a human step, restricted to a pharmacist or admin, because a
human confirms the fill actually happened. AI proposes; a licensed human disposes.

### 7. Guardrails and verification

Three independent guardrails protect every action:

- **Access:** RBAC checks the role against the action (`rbac.can`).
- **Legality:** the state machine checks the transition (`can_transition`).
- **Confidence:** low-confidence triage diverts to `needs_human`.

Verification is a first-class step, not an assumption. A case reaches `ready_to_fill`
only after the provider approves, and reaches `resolved` only after a human confirms
the fill. A declined renewal moves to a separate closed state, `denied`, and never to
`resolved`, so `resolved` always means a verified fill and denied cases never inflate the
resolution metrics. The system distinguishes "we asked" from "it happened."

### 8. Explainability

Nothing the system does is a black box. Every case shows its `reasoning` (why this
blocker) and a `confidence` score, and every action appends an audit event with the
actor and the transition. A supervisor can read the timeline top to bottom and see who
did what, when, and why the case is where it is.

---

## Part B: Security and trust

The system handles protected health information (PHI) and takes sensitive actions, so
security is designed in, not bolted on. The threat model in one line: prevent
unauthorized access to patient data, prevent unauthorized or unsafe actions, and make
every sensitive action attributable.

### 1. Role-based access control

Access is decided per action in `rbac.py`. Different roles can take different actions,
and the clinical action is fenced off.

| Action | tech | pharmacist | provider | admin |
|---|:---:|:---:|:---:|:---:|
| triage | yes | yes | | yes |
| request_provider_approval | yes | yes | | yes |
| submit_prior_auth | yes | yes | | yes |
| insurance_decision | yes | yes | | yes |
| request_patient_info / visit | yes | yes | | yes |
| **provider_decision (clinical)** | | | **yes** | |
| mark_resolved (verify fill) | | yes | | yes |
| escalate | yes | yes | yes | yes |

The clinical action is provider-only. There is no silent admin override: an
administrative override, if ever required, would be a separate and explicitly audited
workflow, not admin quietly acting as a prescriber. In production each row would also be
scoped by tenant and by assignment, so practice staff see only their practice's cases and
a pharmacy sees only pharmacy-relevant data.

### 2. The AI capability allowlist

This is the strongest part of the security story. The AI service is confined to a
small set of read and draft capabilities and is denied every sensitive action by
construction, because `brain.py` contains no code path to perform them.

**Granted to the AI:** `READ_REFILL_CONTEXT`, `CLASSIFY_REQUEST`, `GENERATE_SUMMARY`,
`RECOMMEND_ACTION`, `CREATE_DRAFT_MESSAGE`.

**Denied to the AI:** `PRESCRIBE`, `CHANGE_MEDICATION`, `DELETE_PATIENT`,
`APPROVE_RENEWAL`, `ADVANCE_STATE`.

The AI can suggest and draft. It cannot prescribe, change a medication, delete a
record, approve a renewal, or move a case forward. Those flow only through the
orchestrator, behind RBAC and the human-in-the-loop gate.

### 3. Audit logging

Every action is recorded as an immutable event answering who, what, when, and result,
with the state transition attached (`Event` in `models.py`). Example: provider,
approved renewal, 10:15, case moved awaiting_provider to ready_to_fill. The log is
append-only, which is what makes it trustworthy for later review.

### 4. Data protection

The production posture, stated plainly so it can be defended:

- **In transit:** TLS on every connection.
- **At rest:** encryption of the datastore; field-level encryption for the most
  sensitive PHI.
- **Secrets and keys:** held in a managed secrets store, not in code or environment
  files committed to the repo; keys rotated on a schedule.
- **Least privilege:** every component, human or service, gets the minimum access it
  needs. The AI service is the clearest example (see the allowlist above).

### 5. PHI and the language model

The LLM is optional and off by default (`brain.py` runs a deterministic classifier
unless `ANTHROPIC_API_KEY` and `USE_LLM` are both set). Before any text is sent to a
model, the prototype strips the direct identifiers it holds (patient name and reference)
via a redaction step in `brain.py`; production would add a full PHI de-identification
service, and the model provider would be covered by a Business Associate Agreement (BAA). Because the deterministic path is always present,
a model outage or a policy decision to disable the model degrades quality gracefully
and never breaks triage.

### 6. Reliability and scale

The API is stateless, so it scales horizontally behind a load balancer. External
dependencies (EHR, pharmacy network, PBM) are the parts most likely to fail, so the
design isolates them behind an integration layer with retries and a dead-letter path,
and a case waiting on a failed dependency simply stays in its `awaiting_*` state and is
visible in the queue rather than lost. The single-writer orchestrator keeps state
changes consistent under concurrency.

### 7. Observability

Beyond the per-case timeline, the metrics layer (`metrics.py`) reports the health of
the whole queue: open versus resolved counts, how many cases are stuck in
`needs_human`, average touches per refill against a baseline, median resolution time,
and the share of messages auto-drafted. An operator can see not just why one refill is
stuck but where the whole pipeline is slowing down.

---

## Part C: Scope, and what we deliberately left out

Product judgment is scored on what we chose not to build in 24 hours.

**Built:** refill intake, blocker detection, the workflow state machine, AI
classification and drafting, next-action recommendation, the human approval gate, task
routing by role, an audit trail, the staff dashboard, and the value metrics.

**Deliberately deferred:** real EHR and Surescripts integration, a live pharmacy
network, real insurance and PBM claims, real patient medical records, single sign-on
and multi-tenant isolation, and any autonomous clinical decision. Each is mocked or
stubbed with an interface that a real system could connect to later. None is needed to
prove the core loop works.

---

## How this maps to the code

| Concern | File |
|---|---|
| State machine, blockers, legal transitions | `states.py` |
| The single mutation path, guardrails, audit | `orchestrator.py` |
| AI: classify, recommend, draft (LLM optional) | `brain.py` |
| Roles and permissions, the clinical gate | `rbac.py` |
| Case and Event (audit log) data model | `models.py` |
| In-memory repository (swap for a real DB) | `store.py` |
| Measurable value | `metrics.py` |
| API surface | `main.py` |
