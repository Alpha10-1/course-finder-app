import { describe, expect, it } from "vitest";
import { getCourseSelectionRound, getPickableForRound, isRoundComplete } from "./applySelection";

const course = (id, institution) => ({ id, institution, courseName: `${id} @ ${institution}` });
const allOpen = () => true;

describe("round 1", () => {
  const pool = ["A", "B", "C", "D", "E", "F", "G"].map((inst) => course(`${inst}1`, inst));

  it("offers courses at open institutions not chosen yet", () => {
    const pickable = getPickableForRound(pool, 1, { A: { 1: pool[0] } }, (inst) => inst !== "B");
    expect(pickable.map((c) => c.institution)).toEqual(["C", "D", "E", "F", "G"]);
  });

  it("completes at six institutions", () => {
    const five = Object.fromEntries(pool.slice(0, 5).map((c) => [c.institution, { 1: c }]));
    expect(isRoundComplete(pool, 1, five, allOpen)).toBe(false);
    const six = { ...five, F: { 1: pool[5] } };
    expect(isRoundComplete(pool, 1, six, allOpen)).toBe(true);
  });

  it("completes early once no open institution is left", () => {
    const sels = { A: { 1: pool[0] } };
    expect(isRoundComplete(pool, 1, sels, (inst) => inst === "A")).toBe(true);
  });
});

describe("rounds 2 and 3", () => {
  const pool = [course("a1", "A"), course("a2", "A"), course("a3", "A"), course("b1", "B"), course("c1", "C")];
  const round1 = { A: { 1: pool[0] }, B: { 1: pool[3] } };

  it("only offers unused courses at already-chosen institutions", () => {
    expect(getPickableForRound(pool, 2, round1, allOpen).map((c) => c.id)).toEqual(["a2", "a3"]);
  });

  it("skips institutions with nothing left to offer", () => {
    // B only had one course, so a 2nd choice at A alone completes round 2
    expect(isRoundComplete(pool, 2, round1, allOpen)).toBe(false);
    const round2 = { ...round1, A: { ...round1.A, 2: pool[1] } };
    expect(isRoundComplete(pool, 2, round2, allOpen)).toBe(true);
  });

  it("keeps closed institutions pickable once chosen", () => {
    expect(getPickableForRound(pool, 2, round1, () => false).map((c) => c.id)).toEqual(["a2", "a3"]);
  });
});

describe("getCourseSelectionRound", () => {
  const sels = { A: { 1: { id: "a1" }, 2: { id: "a2" } }, B: { 1: { id: "b1" } } };

  it("finds the round a course was picked in", () => {
    expect(getCourseSelectionRound(sels, { id: "a2" })).toBe(2);
    expect(getCourseSelectionRound(sels, { id: "b1" })).toBe(1);
    expect(getCourseSelectionRound(sels, { id: "zz" })).toBeNull();
  });
});
