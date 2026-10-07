import { describe, expect, it, vi } from "vitest";

// Only the pure date logic is tested here; keep the Firebase app uninitialised.
vi.mock("../firebase", () => ({ db: {} }));

import {
  facultySettingsKey,
  getCourseApplicationStatus,
  getCourseDisplayStatus,
  getInstitutionApplicationStatus,
} from "./institutionStatus";

// Local-time dates, so these hold whatever timezone the tests run in.
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h);

describe("getInstitutionApplicationStatus", () => {
  it("is open when no window is configured", () => {
    expect(getInstitutionApplicationStatus(undefined)).toBe("open");
    expect(getInstitutionApplicationStatus({ openDate: null, closeDate: null })).toBe("open");
  });

  it("is closed before the open date", () => {
    expect(getInstitutionApplicationStatus({ openDate: "2026-04-01" }, at(2026, 3, 15))).toBe("closed");
    expect(getInstitutionApplicationStatus({ openDate: "2026-04-01" }, at(2026, 4, 2))).toBe("open");
  });

  it("treats the close date as inclusive", () => {
    const window = { openDate: "2026-04-01", closeDate: "2026-09-30" };
    expect(getInstitutionApplicationStatus(window, at(2026, 9, 30, 18))).toBe("open");
    expect(getInstitutionApplicationStatus(window, at(2026, 10, 1, 9))).toBe("closed");
  });

  it("ignores unparseable dates", () => {
    expect(getInstitutionApplicationStatus({ closeDate: "not a date" }, at(2030, 1, 1))).toBe("open");
  });
});

describe("course-level status", () => {
  const institutionSettings = { "University X": { openDate: "2026-04-01", closeDate: "2026-09-30" } };
  const facultySettings = {
    [facultySettingsKey("University X", "Health Sciences")]: { openDate: "2026-04-01", closeDate: "2026-06-30" },
    [facultySettingsKey("University X", "Humanities")]: { openDate: null, closeDate: null },
  };
  const course = (faculty) => ({ institution: "University X", faculty });

  it("uses the faculty's own window when it has one", () => {
    expect(getCourseApplicationStatus(course("Health Sciences"), institutionSettings, facultySettings, at(2026, 7, 15))).toBe("closed");
  });

  it("falls back to the institution window when the faculty has no dates", () => {
    expect(getCourseApplicationStatus(course("Humanities"), institutionSettings, facultySettings, at(2026, 7, 15))).toBe("open");
    expect(getCourseApplicationStatus(course("Engineering"), institutionSettings, facultySettings, at(2026, 7, 15))).toBe("open");
  });

  it("flags courses closing within two weeks", () => {
    expect(getCourseDisplayStatus(course("Engineering"), institutionSettings, facultySettings, at(2026, 9, 20))).toBe("closing-soon");
    expect(getCourseDisplayStatus(course("Engineering"), institutionSettings, facultySettings, at(2026, 8, 1))).toBe("open");
    expect(getCourseDisplayStatus(course("Engineering"), institutionSettings, facultySettings, at(2026, 10, 5))).toBe("closed");
  });
});
