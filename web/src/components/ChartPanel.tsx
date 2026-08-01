import type { PatientContext } from "../lib/api";

export function ChartPanel({ ctx }: { ctx: PatientContext | null }) {
  if (!ctx) {
    return (
      <div className="card">
        <h2>📋 The Chart</h2>
        <p className="muted">Loading patient from the EHR…</p>
      </div>
    );
  }
  return (
    <div className="card">
      <h2>
        📋 The Chart <span className={`pill ${ctx.fhirMode}`}>{ctx.fhirMode === "medplum" ? "Medplum" : "mock FHIR"}</span>
      </h2>
      <dl className="chart">
        <div>
          <dt>Patient</dt>
          <dd>
            {ctx.name}
            {ctx.ageYears !== null && <span className="muted"> · age {ctx.ageYears}</span>}
          </dd>
        </div>
        <div>
          <dt>Procedure</dt>
          <dd>{ctx.procedure}</dd>
        </div>
        {ctx.procedureDate && (
          <div>
            <dt>Scheduled</dt>
            <dd>{new Date(ctx.procedureDate).toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</dd>
          </div>
        )}
        {ctx.condition && (
          <div>
            <dt>Condition</dt>
            <dd>{ctx.condition}</dd>
          </div>
        )}
        <div>
          <dt>Care team</dt>
          <dd>
            {ctx.careTeam.length
              ? ctx.careTeam.map((m) => (
                  <div key={m.name}>
                    {m.name} <span className="muted">· {m.role}</span>
                  </div>
                ))
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
