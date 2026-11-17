import { describe, expect, it } from "vitest";
import {
  BLANK_OPPORTUNITY, ageOn, cleanWorkProfile, matchOpportunity, opportunitiesForLearner, validateOpportunity,
} from "./opportunities";
import { STARTER_FREE_COURSES, validateFreeCourse, visibleFreeCourses } from "./freeCourses";

const NOW = new Date("2026-11-17T08:00:00Z");
const listing = (extra = {}) => ({
  ...BLANK_OPPORTUNITY, title: "Retail learnership", organisation: "Shop", applyUrl: "https://example.com/apply",
  source: "Company careers page", published: true, ...extra,
});
const PROFILE = {
  education: "matric", province: "Gauteng", dateOfBirth: "2007-03-10",
  saCitizen: true, hasDriversLicence: false, unemployed: true, disability: false,
};
const MARKS = [{ subject: "English Home Language", mark: 65 }, { subject: "Mathematical Literacy", mark: 72 }];

describe("ageOn", () => {
  it("counts whole years, birthday inclusive", () => {
    expect(ageOn("2007-11-17", "2026-11-17")).toBe(19);
    expect(ageOn("2007-11-18", "2026-11-17")).toBe(18);
    expect(ageOn("not a date", "2026-11-17")).toBeNull();
  });
});

describe("matchOpportunity", () => {
  it("passes a listing whose every requirement the learner meets, and says why", () => {
    const result = matchOpportunity(listing({
      minEducation: "matric", ageMin: 18, ageMax: 35, provinces: ["Gauteng"], saCitizenOnly: true, unemployedOnly: true,
      requiredSubjects: [{ subject: "English", minMark: 50 }],
    }), PROFILE, MARKS, NOW);
    expect(result.qualifies).toBe(true);
    expect(result.met).toEqual([
      "Matric (Grade 12) or higher", "English 50%+", "Aged 18–35", "Lives in Gauteng", "South African citizen", "Currently unemployed",
    ]);
  });

  it("fails on anything the learner doesn't meet", () => {
    expect(matchOpportunity(listing({ driversLicence: true }), PROFILE, MARKS, NOW).missing).toEqual(["Driver's licence"]);
    expect(matchOpportunity(listing({ minEducation: "diploma" }), PROFILE, MARKS, NOW).qualifies).toBe(false);
    expect(matchOpportunity(listing({ requiredSubjects: [{ subject: "Mathematics", minMark: 50 }], minEducation: "matric" }), PROFILE, MARKS, NOW)
      .missing).toEqual(["Mathematics 50%+"]);
    expect(matchOpportunity(listing({ ageMax: 18 }), PROFILE, MARKS, NOW).missing).toEqual(["Aged 18 or younger"]);
    expect(matchOpportunity(listing({ provinces: ["Limpopo"] }), PROFILE, MARKS, NOW).qualifies).toBe(false);
  });

  it("never passes a requirement the profile doesn't answer", () => {
    const result = matchOpportunity(listing({ saCitizenOnly: true, ageMin: 18 }), {}, [], NOW);
    expect(result.qualifies).toBe(false);
    expect(result.unknown).toEqual(["your date of birth", "whether you're a South African citizen"]);
  });

  it("hides listings that have closed", () => {
    const result = matchOpportunity(listing({ closeDate: "2026-11-16" }), PROFILE, MARKS, NOW);
    expect(result).toMatchObject({ closed: true, qualifies: false });
    expect(matchOpportunity(listing({ closeDate: "2026-11-17" }), PROFILE, MARKS, NOW).qualifies).toBe(true);
  });
});

describe("opportunitiesForLearner", () => {
  it("shows only qualifying, published, open listings and lists the questions to answer", () => {
    const listings = [
      listing({ title: "B", closeDate: "2026-12-20" }),
      listing({ title: "A", closeDate: "2026-12-01" }),
      listing({ title: "Draft", published: false }),
      listing({ title: "Needs licence", driversLicence: true }),
      listing({ title: "Bad link", applyUrl: "javascript:alert(1)" }),
      listing({ title: "Disability only", disabilityOnly: true }),
    ];
    const { qualifying, notQualifying, unanswered } = opportunitiesForLearner(listings, { ...PROFILE, disability: undefined }, MARKS, NOW);
    expect(qualifying.map((o) => o.title)).toEqual(["A", "B"]);
    expect(notQualifying).toBe(1);
    expect(unanswered).toEqual([{ question: "whether you live with a disability", count: 1 }]);
  });
});

describe("validateOpportunity", () => {
  it("accepts a complete listing", () => {
    const { errors, opportunity } = validateOpportunity({ ...listing(), ageMin: "18", ageMax: "35", provinces: ["Gauteng", "Mars"] });
    expect(errors).toEqual([]);
    expect(opportunity).toMatchObject({ ageMin: 18, ageMax: 35, provinces: ["Gauteng"] });
  });

  it("rejects missing basics and contradictions", () => {
    const { errors } = validateOpportunity({
      ...listing(), title: "", applyUrl: "ftp://x", source: "", ageMin: "40", ageMax: "20",
      requiredSubjects: [{ subject: "Mathematics", minMark: 50 }],
    });
    expect(errors).toEqual([
      "Add the title.",
      "Add the official application link, starting with https://",
      "Say where you verified it (e.g. the company's careers page or the SETA).",
      "The minimum age is above the maximum age.",
      "Matric subject requirements need the minimum education set to Matric or higher.",
    ]);
  });
});

describe("cleanWorkProfile", () => {
  it("keeps only valid answers", () => {
    expect(cleanWorkProfile({ education: "matric", province: "Atlantis", dateOfBirth: "2007-03-10", saCitizen: false, unemployed: "yes" }))
      .toEqual({ education: "matric", dateOfBirth: "2007-03-10", saCitizen: false });
  });
});

describe("free courses", () => {
  it("validates the starter list", () => {
    for (const course of STARTER_FREE_COURSES) expect(validateFreeCourse(course).errors).toEqual([]);
  });

  it("shows only published courses with a safe link, free certificates first", () => {
    const courses = [
      { title: "No cert", url: "https://a.example", topics: ["coding"], certificate: "none", published: true },
      { title: "Free cert", url: "https://b.example", topics: ["coding"], certificate: "free", published: true },
      { title: "Draft", url: "https://c.example", topics: ["coding"], certificate: "free", published: false },
      { title: "Bad", url: "javascript:x", topics: ["coding"], certificate: "free", published: true },
      { title: "Cloud", url: "https://d.example", topics: ["cloud"], certificate: "free", published: true },
    ];
    expect(visibleFreeCourses(courses, "coding").map((c) => c.title)).toEqual(["Free cert", "No cert"]);
    expect(visibleFreeCourses(courses).map((c) => c.title)).toEqual(["Cloud", "Free cert", "No cert"]);
  });
});
