// NSFAS financial criteria, as published for recent application cycles
// (checked October 2026). NSFAS can change these yearly — keep them in step
// with nsfas.org.za. Dates are deliberately not hardcoded: they change every
// cycle and official announcements have disagreed.

export const NSFAS_URL = "https://www.nsfas.org.za";
export const NSFAS_INCOME_LIMIT = 350000;
export const NSFAS_DISABILITY_INCOME_LIMIT = 600000;

export const INCOME_BANDS = [
  { value: "under350", label: "R350,000 a year or less" },
  { value: "350to600", label: "Between R350,000 and R600,000" },
  { value: "over600", label: "More than R600,000" },
  { value: "unsure", label: "I'm not sure" },
];

/**
 * A rough check of NSFAS's *financial* criteria only (academic results and
 * citizenship are checked by NSFAS itself).
 *
 * @param {{sassaGrant?: boolean, disability?: boolean, incomeBand?: string}} answers
 * @returns {"likely"|"unlikely"|"unknown"}
 */
export function checkNsfasFinancialEligibility({ sassaGrant, disability, incomeBand }) {
  if (sassaGrant) return "likely"; // SASSA grant recipients meet the financial criteria
  if (incomeBand === "under350") return "likely";
  if (incomeBand === "350to600") return disability ? "likely" : "unlikely";
  if (incomeBand === "over600") return "unlikely";
  return "unknown";
}
