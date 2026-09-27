// engine.js - browser port of the FastAPI backend.
// Same state machine, RBAC, triage rules, AI capability boundary, metrics, and
// audit log as backend/app/*, running entirely client-side so the app deploys
// as a static site (Vercel) with no server. The Python backend in /backend
// remains the reference implementation.

// ---------------- states ----------------
export const Blocker = {
  NO_REFILLS: "no_refills_remaining",
  PROVIDER_APPROVAL: "provider_approval_required",
  VISIT_REQUIRED: "visit_required",
  INFO_MISSING: "info_missing",
  CLINICAL_REVIEW: "clinical_review_required",
  INSURANCE_PA: "insurance_pa_required",
  UNKNOWN: "unknown",
  NONE: "none",
};

export const State = {
  INTAKE: "intake", TRIAGED: "triaged", AWAITING_PROVIDER: "awaiting_provider",
  AWAITING_PATIENT: "awaiting_patient", AWAITING_INSURANCE: "awaiting_insurance",
  READY_TO_FILL: "ready_to_fill", RESOLVED: "resolved", DENIED: "denied",
  NEEDS_HUMAN: "needs_human",
};

const BLOCKER_NEXT_ACTION = {
  [Blocker.NO_REFILLS]: "request_provider_approval",
  [Blocker.PROVIDER_APPROVAL]: "request_provider_approval",
  [Blocker.CLINICAL_REVIEW]: "request_provider_approval",
  [Blocker.VISIT_REQUIRED]: "request_patient_visit",
  [Blocker.INFO_MISSING]: "request_patient_info",
  [Blocker.INSURANCE_PA]: "submit_prior_auth",
  [Blocker.UNKNOWN]: "escalate",
};

const CLINICAL_BLOCKERS = new Set([
  Blocker.NO_REFILLS, Blocker.PROVIDER_APPROVAL, Blocker.CLINICAL_REVIEW, Blocker.VISIT_REQUIRED,
]);

const ALLOWED_TRANSITIONS = {
  [State.INTAKE]: new Set([State.TRIAGED, State.NEEDS_HUMAN]),
  [State.TRIAGED]: new Set([State.AWAITING_PROVIDER, State.AWAITING_PATIENT, State.AWAITING_INSURANCE, State.NEEDS_HUMAN, State.RESOLVED]),
  [State.AWAITING_PROVIDER]: new Set([State.READY_TO_FILL, State.AWAITING_PATIENT, State.NEEDS_HUMAN, State.DENIED]),
  [State.AWAITING_PATIENT]: new Set([State.TRIAGED, State.AWAITING_PROVIDER, State.NEEDS_HUMAN]),
  [State.AWAITING_INSURANCE]: new Set([State.READY_TO_FILL, State.NEEDS_HUMAN]),
  [State.READY_TO_FILL]: new Set([State.RESOLVED]),
  [State.NEEDS_HUMAN]: new Set([State.TRIAGED, State.AWAITING_PROVIDER, State.AWAITING_PATIENT, State.AWAITING_INSURANCE, State.READY_TO_FILL, State.RESOLVED]),
  [State.RESOLVED]: new Set(),
  [State.DENIED]: new Set(),
};

function canTransition(a, b) {
  if (a === b) return true;
  const s = ALLOWED_TRANSITIONS[a];
  return s ? s.has(b) : false;
}

function priorityFor(daysLeft) {
  if (daysLeft == null) return "normal";
  if (daysLeft <= 1) return "urgent";
  if (daysLeft <= 5) return "high";
  return "normal";
}

// ---------------- rbac ----------------
const PERMISSIONS = {
  triage: new Set(["tech", "pharmacist", "admin", "system"]),
  request_provider_approval: new Set(["tech", "pharmacist", "admin"]),
  provider_decision: new Set(["provider"]),          // clinical gate: provider only
  submit_prior_auth: new Set(["tech", "pharmacist", "admin"]),
  insurance_decision: new Set(["tech", "pharmacist", "admin"]),
  request_patient_info: new Set(["tech", "pharmacist", "admin"]),
  request_patient_visit: new Set(["tech", "pharmacist", "admin"]),
  mark_resolved: new Set(["pharmacist", "admin"]),
  escalate: new Set(["tech", "pharmacist", "provider", "admin"]),
};
function can(role, action) {
  const s = PERMISSIONS[action];
  return s ? s.has(role) : false;
}

// ---------------- ai policy (allowlist) ----------------
const AI_ALLOWED = ["READ_REFILL_CONTEXT", "CLASSIFY_REQUEST", "GENERATE_SUMMARY", "RECOMMEND_ACTION", "CREATE_DRAFT_MESSAGE"];
const AI_DENIED = ["PRESCRIBE", "CHANGE_MEDICATION", "DELETE_PATIENT", "APPROVE_RENEWAL", "ADVANCE_STATE"];

// ---------------- brain (deterministic triage) ----------------
const KEYWORDS = {
  [Blocker.NO_REFILLS]: ["no refills", "0 refills", "refills: 0", "out of refills", "no refill left", "refills remaining: 0"],
  [Blocker.PROVIDER_APPROVAL]: ["needs approval", "provider approval", "new rx", "reauthorize", "renew", "re-authorization"],
  [Blocker.VISIT_REQUIRED]: ["needs to be seen", "office visit", "follow-up", "hasn't been seen", "annual visit", "overdue for", "check-in required"],
  [Blocker.INFO_MISSING]: ["missing", "unclear", "which dose", "unreadable", "clarify", "illegible", "incomplete"],
  [Blocker.CLINICAL_REVIEW]: ["review condition", "recent labs", "bp reading", "monitor", "clinical review", "a1c", "lab results"],
  [Blocker.INSURANCE_PA]: ["prior auth", "pa required", "not covered", "step therapy", "formulary", "insurance denied", "pbm"],
};

const BLOCKER_PHRASE = {
  [Blocker.NO_REFILLS]: "no refills remaining",
  [Blocker.PROVIDER_APPROVAL]: "provider approval required",
  [Blocker.VISIT_REQUIRED]: "a visit is required before renewal",
  [Blocker.INFO_MISSING]: "prescription details are unclear",
  [Blocker.CLINICAL_REVIEW]: "a clinical review is required",
  [Blocker.INSURANCE_PA]: "prior authorization is required",
  [Blocker.UNKNOWN]: "the reason is unclear and needs human triage",
};

function classify(raw) {
  const text = (raw || "").toLowerCase();
  const scores = {}, matched = {};
  for (const [blocker, kws] of Object.entries(KEYWORDS)) {
    const hits = kws.filter((k) => text.includes(k));
    if (hits.length) { scores[blocker] = hits.length; matched[blocker] = hits; }
  }
  const keys = Object.keys(scores);
  if (!keys.length) {
    return { blocker: Blocker.UNKNOWN, confidence: 0.35,
      reasoning: "No clear signal in the inbound request. Reason unclear, routing to a human to triage instead of guessing." };
  }
  const blocker = keys.reduce((a, b) => (scores[b] > scores[a] ? b : a));
  const top = scores[blocker];
  const cleanWin = Object.values(scores).filter((s) => s === top).length === 1;
  const confidence = Math.min(0.95, 0.5 + 0.13 * top + (cleanWin ? 0.12 : 0));
  const cues = matched[blocker].slice(0, 3).map((c) => `"${c}"`).join(", ");
  const reasoning = `Detected ${blocker.replace(/_/g, " ")} from cues ${cues} in the inbound request.`;
  return { blocker, confidence: Math.round(confidence * 100) / 100, reasoning };
}

function buildDraft(blocker, c) {
  const { medication: med, patient_name: pt } = c;
  if ([Blocker.NO_REFILLS, Blocker.PROVIDER_APPROVAL, Blocker.CLINICAL_REVIEW].includes(blocker))
    return `To provider: Refill authorization requested for ${pt}, ${med}. No refills remaining on file. Please approve renewal, request a visit, or decline. [Draft, review before sending.]`;
  if (blocker === Blocker.VISIT_REQUIRED)
    return `To patient (${pt}): Your ${med} refill needs a quick check-in with your provider before it can be renewed. Here are the next available slots... [Draft, review before sending.]`;
  if (blocker === Blocker.INFO_MISSING)
    return `To pharmacy: The ${med} request for ${pt} is missing details needed to proceed (dose or quantity unclear). Requesting clarification. [Draft.]`;
  if (blocker === Blocker.INSURANCE_PA)
    return `Prior authorization draft for ${pt}, ${med}: clinical justification, diagnosis code, and prior therapy history pre-filled for provider sign-off. [Draft.]`;
  return "No draft generated. Escalating to a human.";
}

function summarize(c) {
  const phrase = BLOCKER_PHRASE[c.blocker] || "review required";
  const left = c.days_left != null ? ` Patient has about ${c.days_left} day(s) of medication left.` : "";
  return `Refill requested via ${c.channel} for ${c.medication}: ${phrase}.${left} Awaiting the responsible party; clinical decision stays with the provider.`;
}

function analyze(c) {
  const r = classify(c.raw_request);
  const action = BLOCKER_NEXT_ACTION[r.blocker] || "escalate";
  return { ...r, recommended_action: action, draft: buildDraft(r.blocker, c) };
}

// ---------------- context (completeness) ----------------
const BASE_PRESENT = ["Patient identity", "Medication", "Pharmacy", "Prescription history"];
const MISSING_BY_BLOCKER = {
  [Blocker.NO_REFILLS]: ["Provider authorization"],
  [Blocker.PROVIDER_APPROVAL]: ["Provider authorization"],
  [Blocker.CLINICAL_REVIEW]: ["Provider authorization", "Recent clinical review"],
  [Blocker.VISIT_REQUIRED]: ["Provider authorization", "Recent visit"],
  [Blocker.INFO_MISSING]: ["Complete prescription details"],
  [Blocker.INSURANCE_PA]: ["Insurance clearance"],
  [Blocker.UNKNOWN]: ["Reason for the block"],
};
function completeness(c) {
  const missing = MISSING_BY_BLOCKER[c.blocker] || [];
  return [
    ...BASE_PRESENT.map((p) => ({ label: p, status: "present" })),
    ...missing.map((m) => ({ label: m, status: "missing" })),
  ];
}

// ---------------- store (in-memory) ----------------
let cases = {}, events = [], cid = 0, eid = 0;
const nowISO = () => new Date().toISOString();

function addCase(c) { cid += 1; c.id = cid; cases[c.id] = c; return c; }
function addEvent(e) { eid += 1; e.id = eid; events.push(e); return e; }
function eventsFor(id) { return events.filter((e) => e.case_id === id); }
function newCase(o) {
  return { patient_name: "", patient_ref: "", medication: "", raw_request: "", channel: "portal",
    days_left: null, priority: "normal", blocker: "none", state: "intake", confidence: 0,
    recommended_action: "", draft: "", summary: "", reasoning: "", assigned_role: "", touches: 0,
    id: null, created_at: nowISO(), resolved_at: null, ...o };
}

// ---------------- seed ----------------
const SEED = [
  { patient_name: "Maria Gomez", patient_ref: "PT-4821", medication: "Lisinopril 10mg", channel: "portal", days_left: 3, raw_request: "Refill request via app. Pharmacy note: 0 refills remaining, needs provider approval to renew." },
  { patient_name: "James Okafor", patient_ref: "PT-1190", medication: "Metformin 500mg", channel: "fax", days_left: 12, raw_request: "Faxed refill. Patient hasn't been seen in 14 months, annual visit / follow-up required before renewal." },
  { patient_name: "Ana Petrova", patient_ref: "PT-7734", medication: "Atorvastatin 20mg", channel: "phone", days_left: 0, raw_request: "Called in. Handwriting on original script illegible, which dose is unclear, need to clarify before filling." },
  { patient_name: "David Kim", patient_ref: "PT-3055", medication: "Adderall XR 20mg", channel: "portal", days_left: 4, raw_request: "Prior auth required. PBM says step therapy / not covered without documentation. Controlled substance." },
  { patient_name: "Priya Nair", patient_ref: "PT-6612", medication: "Levothyroxine 75mcg", channel: "erx", days_left: 9, raw_request: "Provider wants recent labs / clinical review (TSH) before authorizing continued refills." },
  { patient_name: "Tom Becker", patient_ref: "PT-2048", medication: "Amlodipine 5mg", channel: "portal", days_left: 1, raw_request: "Refill request. Note is garbled, no clear reason captured from the intake system." },
];

function seed() {
  cases = {}; events = []; cid = 0; eid = 0;
  for (const row of SEED) {
    const c = addCase(newCase({ ...row, priority: priorityFor(row.days_left) }));
    addEvent({ case_id: c.id, actor: "system", action: "intake", detail: `Received via ${c.channel}`, from_state: "", to_state: State.INTAKE, ts: nowISO() });
  }
  const done = addCase(newCase({
    patient_name: "Ellen Ruiz", patient_ref: "PT-9001", medication: "Sertraline 50mg", channel: "portal",
    days_left: 6, priority: "normal", raw_request: "0 refills remaining, needs provider approval.",
    blocker: "no_refills_remaining", state: State.RESOLVED, confidence: 0.83,
    recommended_action: "request_provider_approval", touches: 2,
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  }));
  void done;
}

// ---------------- orchestrator ----------------
function log(c, actor, action, detail, frm, to) {
  addEvent({ case_id: c.id, actor, action, detail, from_state: frm, to_state: to, ts: nowISO() });
}

function doAction(c, action, role, payload) {
  if (!can(role, action)) throw new Error(`Role '${role}' is not permitted to '${action}'.`);
  payload = payload || {};
  const frm = c.state;
  let to = frm, detail = "";

  if (action === "triage") {
    const r = analyze(c);
    c.blocker = r.blocker; c.confidence = r.confidence;
    c.recommended_action = r.recommended_action; c.draft = r.draft; c.reasoning = r.reasoning;
    c.summary = summarize(c); c.priority = priorityFor(c.days_left);
    c.assigned_role = CLINICAL_BLOCKERS.has(c.blocker) ? "provider" : "tech";
    to = c.confidence < 0.5 ? State.NEEDS_HUMAN : State.TRIAGED;
    detail = `${c.blocker} @ ${Math.round(c.confidence * 100)}% -> ${c.recommended_action}`;
  } else if (action === "request_provider_approval") {
    to = State.AWAITING_PROVIDER; detail = "Provider approval requested (draft sent for sign-off).";
  } else if (action === "provider_decision") {
    const d = payload.decision || "approve";
    if (d === "approve") { to = State.READY_TO_FILL; detail = "Provider approved renewal."; }
    else if (d === "deny") { to = State.DENIED; detail = "Provider declined the renewal; case closed without a fill."; }
    else if (d === "visit") { to = State.AWAITING_PATIENT; detail = "Provider requires a visit first."; }
    else throw new Error("decision must be approve | deny | visit");
  } else if (action === "submit_prior_auth") {
    to = State.AWAITING_INSURANCE; detail = "Prior authorization submitted to PBM.";
  } else if (action === "insurance_decision") {
    const ok = payload.approved !== false;
    to = ok ? State.READY_TO_FILL : State.NEEDS_HUMAN;
    detail = ok ? "PBM approved." : "PBM denied - escalating for appeal/alternative.";
  } else if (action === "request_patient_info") {
    to = State.AWAITING_PATIENT; detail = "Requested missing info from patient.";
  } else if (action === "request_patient_visit") {
    to = State.AWAITING_PATIENT; detail = "Asked patient to schedule a visit.";
  } else if (action === "mark_resolved") {
    to = State.RESOLVED; detail = payload.note || "Fill confirmed - refill complete.";
  } else if (action === "escalate") {
    to = State.NEEDS_HUMAN; detail = payload.note || "Escalated to a human.";
  } else {
    throw new Error(`Unknown action '${action}'.`);
  }

  if (!canTransition(frm, to)) throw new Error(`Illegal transition ${frm} -> ${to}.`);
  c.state = to; c.touches += 1;
  if (to === State.RESOLVED && !c.resolved_at) c.resolved_at = nowISO();
  log(c, role, action, detail, frm, to);
  return c;
}

// ---------------- metrics ----------------
const BASELINE_TOUCHES = 6.0;
const CLOSED = new Set([State.RESOLVED, State.DENIED]);
function computeMetrics() {
  const all = Object.values(cases);
  const total = all.length;
  const resolved = all.filter((c) => c.state === State.RESOLVED);
  const denied = all.filter((c) => c.state === State.DENIED);
  const open = all.filter((c) => !CLOSED.has(c.state));
  const avg = resolved.length ? Math.round((resolved.reduce((s, c) => s + c.touches, 0) / resolved.length) * 10) / 10 : 0;
  const durs = resolved.filter((c) => c.resolved_at).map((c) => (new Date(c.resolved_at) - new Date(c.created_at)) / 3600000).sort((a, b) => a - b);
  const median = durs.length ? Math.round(durs[Math.floor(durs.length / 2)] * 10) / 10 : 0;
  const autoDrafted = all.filter((c) => c.draft).length;
  return {
    open_cases: open.length,
    urgent_open: open.filter((c) => c.priority === "urgent").length,
    resolved_cases: resolved.length,
    denied_cases: denied.length,
    needs_human: all.filter((c) => c.state === State.NEEDS_HUMAN).length,
    avg_touches: avg,
    baseline_touches: BASELINE_TOUCHES,
    touch_reduction_pct: resolved.length ? Math.round((100 * (BASELINE_TOUCHES - avg)) / BASELINE_TOUCHES) : 0,
    median_resolution_hrs: median,
    pct_auto_drafted: total ? Math.round((100 * autoDrafted) / total) : 0,
  };
}

// ---------------- public surface (mirrors the API) ----------------
seed();
export function listCases() { return Object.values(cases); }
export function getCase(id) {
  const c = cases[id];
  if (!c) throw new Error("case not found");
  return { case: c, events: eventsFor(id), checklist: completeness(c) };
}
export function metrics() { return computeMetrics(); }
export function aiPolicy() { return { allowed: [...AI_ALLOWED].sort(), denied: [...AI_DENIED].sort() }; }
export function act(id, action, role, payload = {}) {
  const c = cases[id];
  if (!c) throw new Error("case not found");
  return doAction(c, action, role, payload);
}
export function addCaseApi(body) {
  const days = body.days_left ?? null;
  const c = addCase(newCase({
    patient_name: body.patient_name || "New Patient", patient_ref: body.patient_ref || "PT-0000",
    medication: body.medication || "Unknown med", raw_request: body.raw_request || "",
    channel: body.channel || "portal", days_left: days, priority: priorityFor(days),
  }));
  addEvent({ case_id: c.id, actor: "system", action: "intake", detail: `Received via ${c.channel}`, from_state: "", to_state: "intake", ts: nowISO() });
  return c;
}
export function reset() { seed(); return { ok: true }; }
