import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function TrustPage() {
  const [policy, setPolicy] = useState(null);
  useEffect(() => { api.aiPolicy().then(setPolicy).catch(() => {}); }, []);

  return (
    <div className="trust">
      <div className="notice">
        Prototype notice: this is a 24-hour hackathon build. Data shown is synthetic. No
        real patient records, pharmacy networks, or insurance systems are connected.
      </div>

      <section className="tsec">
        <h3>How we handle sensitive data</h3>
        <p>
          The system is designed for protected health information (PHI). Access is decided
          per action by role. Practice staff, pharmacists, providers, and administrators
          each see and do only what their role permits, and the clinical decision to
          approve or decline a renewal is restricted to a provider. Every sensitive action
          is written to an append-only audit log recording who acted, what they did, when,
          and the resulting state change.
        </p>
      </section>

      <section className="tsec">
        <h3>What the AI can and cannot do</h3>
        <p>
          The AI service is confined to a fixed allowlist of read and drafting
          capabilities. It cannot prescribe, change a medication, approve a renewal, delete
          a record, or advance a case on its own. This boundary is enforced in code, not
          just stated in a policy.
        </p>
        {policy && (
          <div className="policy">
            <div className="pcol">
              <div className="pcol-head allow">Granted to AI</div>
              <ul>{policy.allowed.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="pcol">
              <div className="pcol-head deny">Denied to AI</div>
              <ul>{policy.denied.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
        )}
      </section>

      <section className="tsec">
        <h3>Data protection posture</h3>
        <p>
          In production: TLS for data in transit, encryption at rest for the datastore,
          secrets and keys held in a managed store outside the codebase, and least-privilege
          access for every human and service. direct identifiers are stripped before any
          text is sent to a language model, and in production the model provider operates
          under a Business Associate Agreement. Because the classifier has a deterministic fallback, disabling the model
          degrades quality gracefully and never stops the workflow.
        </p>
      </section>

      <section className="tsec">
        <h3>Data retention and your rights</h3>
        <p>
          Case and audit records are retained for the period required to operate the service
          and meet healthcare record-keeping obligations, then archived or purged on a defined
          schedule. Customers may request export or deletion of their data. This prototype
          keeps data in memory only and clears it on restart.
        </p>
      </section>

      <section className="tsec">
        <h3>Terms of use</h3>
        <p>
          This software supports administrative coordination of prescription refills. It does
          not provide medical advice and does not make clinical decisions. Authorized
          healthcare professionals remain responsible for all prescribing decisions. The
          service is provided for evaluation during the hackathon without warranty.
        </p>
      </section>
    </div>
  );
}
