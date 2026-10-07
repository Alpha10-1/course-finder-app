import { describe, expect, it } from "vitest";
import { checkNsfasFinancialEligibility } from "./funding";

describe("checkNsfasFinancialEligibility", () => {
  it("SASSA grant recipients meet the financial criteria regardless of income", () => {
    expect(checkNsfasFinancialEligibility({ sassaGrant: true, incomeBand: "over600" })).toBe("likely");
  });

  it("uses the R350,000 household income limit", () => {
    expect(checkNsfasFinancialEligibility({ incomeBand: "under350" })).toBe("likely");
    expect(checkNsfasFinancialEligibility({ incomeBand: "350to600" })).toBe("unlikely");
    expect(checkNsfasFinancialEligibility({ incomeBand: "over600" })).toBe("unlikely");
  });

  it("uses the R600,000 limit for learners living with a disability", () => {
    expect(checkNsfasFinancialEligibility({ disability: true, incomeBand: "350to600" })).toBe("likely");
    expect(checkNsfasFinancialEligibility({ disability: true, incomeBand: "over600" })).toBe("unlikely");
  });

  it("can't say without an income answer", () => {
    expect(checkNsfasFinancialEligibility({})).toBe("unknown");
    expect(checkNsfasFinancialEligibility({ incomeBand: "unsure" })).toBe("unknown");
  });
});
