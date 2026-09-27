import React from "react";

const BLOCKER_LABEL = {
  no_refills_remaining: "No refills left",
  provider_approval_required: "Provider approval",
  visit_required: "Visit required",
  info_missing: "Info missing",
  clinical_review_required: "Clinical review",
  insurance_pa_required: "Prior auth",
  unknown: "Reason unclear",
  none: "Untriaged",
};

const PRIO_RANK = { urgent: 0, high: 1, normal: 2 };
const STATE_RANK = { intake: 0, needs_human: 1, triaged: 2, awaiting_provider: 3,
  awaiting_patient: 3, awaiting_insurance: 3, ready_to_fill: 4, resolved: 5, denied: 5 };

export default function Queue({ cases, selectedId, onSelect }) {
  const sorted = [...cases].sort((a, b) =>
    (STATE_RANK[a.state] ?? 9) - (STATE_RANK[b.state] ?? 9) ||
    (PRIO_RANK[a.priority] ?? 9) - (PRIO_RANK[b.priority] ?? 9)
  );

  return (
    <section className="queue">
      <div className="queue-head">Refill queue<span className="count">{cases.length}</span></div>
      <ul>
        {sorted.map((c) => (
          <li key={c.id}
              className={`qcard ${c.id === selectedId ? "active" : ""}`}
              onClick={() => onSelect(c.id)}>
            <div className="qtop">
              <span className="qname">{c.patient_name}</span>
              <span className={`state-label s-${c.state}`}>{c.state.replace(/_/g, " ")}</span>
            </div>
            <div className="qmed">{c.medication}<span className="chan">{c.channel}</span></div>
            <div className="qbtm">
              <span className={`prio p-${c.priority}`}>{c.priority}</span>
              <span className="blocker">{BLOCKER_LABEL[c.blocker] || c.blocker}</span>
              {c.confidence > 0 && <span className="conf">{Math.round(c.confidence * 100)}%</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
