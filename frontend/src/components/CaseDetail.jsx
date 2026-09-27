import React from "react";

const ACTION_LABEL = {
  request_provider_approval: "Send provider approval request",
  request_patient_visit: "Ask patient to book a visit",
  request_patient_info: "Request missing info",
  submit_prior_auth: "Submit prior authorization",
};

function actionsFor(c) {
  switch (c.state) {
    case "intake":
      return [{ action: "triage", label: "Triage with AI", primary: true }];
    case "triaged":
    case "needs_human":
      return [
        { action: c.recommended_action, label: ACTION_LABEL[c.recommended_action] || "Take next action", primary: true },
        { action: "escalate", label: "Escalate to human" },
      ].filter((a) => a.action);
    case "awaiting_provider":
      return [
        { action: "provider_decision", label: "Approve renewal", payload: { decision: "approve" }, primary: true, clinical: true },
        { action: "provider_decision", label: "Request visit", payload: { decision: "visit" }, clinical: true },
        { action: "provider_decision", label: "Decline", payload: { decision: "deny" }, danger: true, clinical: true },
      ];
    case "awaiting_patient":
      return [
        { action: "request_provider_approval", label: "Info received, send to provider", primary: true },
        { action: "escalate", label: "Escalate to human" },
      ];
    case "awaiting_insurance":
      return [
        { action: "insurance_decision", label: "PBM approved", payload: { approved: true }, primary: true },
        { action: "insurance_decision", label: "PBM denied", payload: { approved: false }, danger: true },
      ];
    case "ready_to_fill":
      return [{ action: "mark_resolved", label: "Confirm fill, resolve", primary: true }];
    default:
      return [];
  }
}

export default function CaseDetail({ detail, role, onAction }) {
  const { case: c, events, checklist } = detail;
  const acts = actionsFor(c);

  return (
    <section className="detail">
      <div className="detail-head">
        <div>
          <div className="dh-name">{c.patient_name}<span className="ref">{c.patient_ref}</span></div>
          <div className="med">{c.medication} · {c.channel}
            {c.days_left != null && <span className="days"> · {c.days_left}d of medication left</span>}
          </div>
        </div>
        <div className="dh-right">
          <span className={`prio p-${c.priority}`}>{c.priority}</span>
          <span className={`state-label s-${c.state}`}>{c.state.replace(/_/g, " ")}</span>
        </div>
      </div>

      {c.summary && (
        <div className="block">
          <div className="block-label">Summary for provider</div>
          <p className="summary">{c.summary}</p>
        </div>
      )}

      <div className="block">
        <div className="block-label">Inbound request</div>
        <p className="raw">{c.raw_request}</p>
      </div>

      {c.blocker !== "none" && (
        <div className="block ai">
          <div className="block-label row">
            AI assessment
            {c.confidence > 0 && (
              <span className={`conf-badge ${c.confidence < 0.5 ? "low" : ""}`}>
                {Math.round(c.confidence * 100)}% confidence
              </span>
            )}
          </div>
          <div className="kv"><span>Why it is stuck</span><b>{c.blocker === "unknown" ? "reason unclear, needs human triage" : c.blocker.replace(/_/g, " ")}</b></div>
          <div className="kv"><span>Reasoning</span><b>{c.reasoning}</b></div>
          <div className="kv"><span>Recommended</span><b>{ACTION_LABEL[c.recommended_action] || c.recommended_action}</b></div>
          {c.draft && (
            <div className="draft">
              <div className="block-label">Drafted message, review before sending</div>
              <textarea defaultValue={c.draft} rows={3} />
            </div>
          )}
        </div>
      )}

      {checklist && checklist.length > 0 && (
        <div className="block">
          <div className="block-label">Information the system has</div>
          <div className="checklist">
            {checklist.map((i, k) => (
              <div key={k} className="ci">
                <span className={`mark ${i.status}`} />
                <span className="ci-label">{i.label}</span>
                <span className={`ci-status ${i.status}`}>{i.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="actions">
        {acts.length === 0 && (
          <span className="done">{c.state === "denied"
            ? "Provider declined the renewal. Case closed without a fill."
            : "This refill is resolved. Nothing left to do."}</span>
        )}
        {acts.map((a, i) => (
          <button
            key={i}
            className={`act ${a.primary ? "primary" : a.danger ? "danger" : ""}`}
            onClick={() => onAction(a.action, a.payload || {})}>
            {a.label}
            {a.clinical && <span className="gate">provider only</span>}
          </button>
        ))}
      </div>

      <div className="timeline">
        <div className="block-label">Audit trail</div>
        <ul>
          {[...events].reverse().map((e) => (
            <li key={e.id}>
              <span className="tl-dot" />
              <div className="tl-body">
                <div className="tl-top">
                  <b>{e.action.replace(/_/g, " ")}</b>
                  <span className="actor">{e.actor}</span>
                </div>
                {e.detail && <div className="tl-detail">{e.detail}</div>}
                {e.from_state && <div className="tl-trans">{e.from_state} to {e.to_state}</div>}
                <div className="tl-ts">{new Date(e.ts).toLocaleString()}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
