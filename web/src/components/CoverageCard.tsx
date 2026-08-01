import { useEffect, useState } from "react";
import { api, type CoverageSummary } from "../lib/api";

export function CoverageCard() {
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.coverage().then(setCoverage).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="card">
      <h2>
        👪 For the Parent{" "}
        {coverage && <span className={`pill ${coverage.source === "stedi-test" ? "medplum" : "mock"}`}>{coverage.source === "stedi-test" ? "Stedi test" : "mock 271"}</span>}
      </h2>
      {error && <p className="muted">{error}</p>}
      {!coverage && !error && <p className="muted">Checking eligibility…</p>}
      {coverage && (
        <>
          <p className="coverage-plain">{coverage.plainLanguage}</p>
          <dl className="chart">
            <div>
              <dt>Plan</dt>
              <dd>{coverage.planName}</dd>
            </div>
            <div>
              <dt>Copay</dt>
              <dd>{coverage.copay}</dd>
            </div>
            <div>
              <dt>Deductible left</dt>
              <dd>{coverage.deductibleRemaining}</dd>
            </div>
          </dl>
        </>
      )}
    </div>
  );
}
