import React from "react";

export function QueueSkeleton() {
  return (
    <section className="queue">
      <div className="queue-head">Refill queue</div>
      <ul>
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="qcard">
            <div className="sk sk-line w60" />
            <div className="sk sk-line w40" />
            <div className="sk sk-line w30" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DetailSkeleton() {
  return (
    <section className="detail">
      <div className="sk sk-line w40" style={{ height: 18 }} />
      <div className="sk sk-block" style={{ height: 60 }} />
      <div className="sk sk-block" style={{ height: 120 }} />
      <div className="sk sk-block" style={{ height: 90 }} />
    </section>
  );
}
