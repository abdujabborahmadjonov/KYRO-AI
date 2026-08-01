import type { PatientContext } from "../lib/api";

/** Full-width patient banner: who, what, when, and the care team at a glance. */
export function ChartPanel({ ctx }: { ctx: PatientContext | null }) {
  if (!ctx) {
    return (
      <section className="card patient-banner">
        <p className="muted">Loading patient from the EHR…</p>
      </section>
    );
  }

  const scheduled = ctx.procedureDate
    ? new Date(ctx.procedureDate).toLocaleString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  return (
    <section className="card patient-banner">
      <div className="patient-id">
        <div className="avatar">{ctx.firstName.charAt(0)}</div>
        <div>
          <strong>{ctx.name}</strong>
          <span className="muted">
            {ctx.ageYears !== null ? `age ${ctx.ageYears}` : ""}
            {ctx.condition ? ` · ${ctx.condition}` : ""}
          </span>
        </div>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile">
          <dt>Procedure</dt>
          <dd>{ctx.procedure}</dd>
        </div>
        <div className="stat-tile">
          <dt>Scheduled</dt>
          <dd>{scheduled}</dd>
        </div>
        <div className="stat-tile">
          <dt>Care team</dt>
          <dd className="team-chips">
            {ctx.careTeam.length
              ? ctx.careTeam.map((m) => (
                  <span key={m.name} className="team-chip" title={m.role}>
                    🩺 {m.name}
                  </span>
                ))
              : "—"}
          </dd>
        </div>
      </div>
    </section>
  );
}
