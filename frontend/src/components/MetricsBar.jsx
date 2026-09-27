import React from "react";

export default function MetricsBar({ m }) {
  const cell = (label, value, sub, tone) => (
    <div className="stat">
      <div className={`stat-value ${tone || ""}`}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
  if (!m) return <div className="metrics"><div className="sk sk-line" style={{ height: 40 }} /></div>;
  return (
    <div className="metrics">
      {cell("Touches / refill", m.avg_touches, `${m.touch_reduction_pct}% below illustrative baseline`)}
      {cell("Median resolution", `${m.median_resolution_hrs}h`, "provider-intervention cases")}
      {cell("Open", m.open_cases, "in the queue")}
      {cell("Urgent", m.urgent_open, "runs out soon", m.urgent_open > 0 ? "urgent" : "")}
      {cell("Needs human", m.needs_human, "low confidence")}
      {cell("Auto-drafted", `${m.pct_auto_drafted}%`, "messages pre-written")}
      {cell("Resolved", m.resolved_cases, "verified complete")}
    </div>
  );
}
