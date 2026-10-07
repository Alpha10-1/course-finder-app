import { describe, expect, it } from "vitest";
import { toggleShortlistEntry } from "./shortlist";

const course = { id: "c1", courseName: "BSc", institution: "UJ", faculty: "Science", minAPS: 30, keySubjects: [] };

describe("toggleShortlistEntry", () => {
  it("adds a compact entry without undefined fields", () => {
    expect(toggleShortlistEntry([], course)).toEqual([{ id: "c1", courseName: "BSc", institution: "UJ" }]);
    expect(toggleShortlistEntry([], { ...course, campus: "Soweto" })[0].campus).toBe("Soweto");
  });

  it("removes a course that's already on the list", () => {
    const list = [{ id: "c0", courseName: "BA", institution: "UJ" }, { id: "c1", courseName: "BSc", institution: "UJ" }];
    expect(toggleShortlistEntry(list, course)).toEqual([list[0]]);
  });

  it("doesn't change the list it was given", () => {
    const list = [];
    toggleShortlistEntry(list, course);
    expect(list).toEqual([]);
  });
});
