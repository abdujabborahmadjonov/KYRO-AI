/**
 * Stedi eligibility check (270/271, test mode) → plain-language coverage
 * summary for the parent. Falls back to a mock 271 without a key.
 */
import type { PatientContext } from "./context.js";

export interface CoverageSummary {
  planName: string;
  covered: boolean;
  copay: string;
  deductibleRemaining: string;
  plainLanguage: string;
  source: "stedi-test" | "mock";
}

export async function checkCoverage(ctx: PatientContext | null): Promise<CoverageSummary> {
  const key = process.env.STEDI_TEST_API_KEY;
  const procedure = ctx?.procedure ?? "the scheduled procedure";

  if (key) {
    try {
      const res = await fetch(
        "https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3",
        {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Key ${key}` },
          body: JSON.stringify({
            controlNumber: "123456789",
            tradingPartnerServiceId: "STEDI_TEST",
            provider: { organizationName: "BraveTales Demo Clinic", npi: "1999999984" },
            subscriber: {
              firstName: "Jordan",
              lastName: "Rivera",
              dateOfBirth: "19900101",
              memberId: "STEDI0001",
            },
            dependents: ctx
              ? [{ firstName: ctx.firstName, lastName: ctx.name.split(" ").pop() ?? "", dateOfBirth: "20200101" }]
              : [],
            encounter: { serviceTypeCodes: ["30"] },
          }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          planInformation?: { planNumber?: string };
          planStatus?: { statusCode?: string; status?: string }[];
          benefitsInformation?: { code?: string; name?: string; benefitAmount?: string; timeQualifier?: string }[];
        };
        const active = data.planStatus?.some((s) => s.statusCode === "1") ?? true;
        const copayInfo = data.benefitsInformation?.find((b) => b.code === "B");
        const copay = copayInfo?.benefitAmount ? `$${copayInfo.benefitAmount}` : "$40";
        return {
          planName: data.planInformation?.planNumber ?? "Health Plan (test)",
          covered: active,
          copay,
          deductibleRemaining: "$0",
          plainLanguage: active
            ? `Good news — your plan covers ${procedure}. Expect a ${copay} copay at the visit; your deductible is already met.`
            : `We couldn't confirm active coverage for ${procedure}. Please call the number on your insurance card before the visit.`,
          source: "stedi-test",
        };
      }
    } catch {
      // fall through to mock
    }
  }

  return {
    planName: "Acme Family Health PPO (demo)",
    covered: true,
    copay: "$40",
    deductibleRemaining: "$0",
    plainLanguage: `Good news — your plan covers ${procedure}. Expect a $40 copay at the visit; your deductible is already met. No prior authorization is needed for this service.`,
    source: "mock",
  };
}
