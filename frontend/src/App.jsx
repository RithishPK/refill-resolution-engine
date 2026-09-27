import React, { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import MetricsBar from "./components/MetricsBar.jsx";
import Queue from "./components/Queue.jsx";
import CaseDetail from "./components/CaseDetail.jsx";
import TrustPage from "./components/TrustPage.jsx";
import { QueueSkeleton, DetailSkeleton } from "./components/Skeletons.jsx";

const ROLES = ["tech", "pharmacist", "provider", "admin"];

export default function App() {
  const [role, setRole] = useState("tech");
  const [view, setView] = useState("console");
  const [cases, setCases] = useState(null);        // null => loading (skeleton)
  const [metrics, setMetrics] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    const [cs, m] = await Promise.all([api.listCases(), api.metrics()]);
    setCases(cs);
    setMetrics(m);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const select = async (id) => {
    setSelectedId(id);
    setLoadingDetail(true);
    try { setDetail(await api.getCase(id)); }
    finally { setLoadingDetail(false); }
  };

  const runAction = async (action, payload) => {
    setErr("");
    try {
      await api.act(selectedId, action, role, payload);
      await refresh();
      setDetail(await api.getCase(selectedId));
    } catch (e) { setErr(e.message); }
  };

  const reset = async () => {
    await api.reset();
    setSelectedId(null); setDetail(null); setCases(null);
    await refresh();
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="wordmark">RX/RE</span>
          <div className="brand-text">
            <div className="brand-name">Refill Resolution Engine</div>
            <div className="brand-sub">Stuck-refill console for pharmacy and practice staff</div>
          </div>
        </div>
        <nav className="nav">
          <button className={`navlink ${view === "console" ? "on" : ""}`} onClick={() => setView("console")}>Console</button>
          <button className={`navlink ${view === "trust" ? "on" : ""}`} onClick={() => setView("trust")}>Trust &amp; data</button>
          <span className="sep" />
          <label className="rolepick">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button className="btn" onClick={reset}>Reset</button>
        </nav>
      </header>

      {view === "trust" ? (
        <TrustPage />
      ) : (
        <>
          <MetricsBar m={metrics} />
          {err && <div className="error-banner">{err}</div>}
          <main className="grid">
            {cases === null ? <QueueSkeleton /> :
              <Queue cases={cases} selectedId={selectedId} onSelect={select} />}
            {loadingDetail ? <DetailSkeleton /> :
              detail ? <CaseDetail detail={detail} role={role} onAction={runAction} /> :
              <section className="empty">Select a refill to see why it is stuck and what to do next.</section>}
          </main>
        </>
      )}
    </div>
  );
}
