// @vitest-environment jsdom
//
// Smoke test for the learner-facing results page against an in-memory fake
// of Firestore: matching, filtering, expanding course rows and the round-1
// selection flow. Like Admin.test.jsx, it's here to catch wiring mistakes
// when the page is refactored, not to pin down styling or copy.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fake = vi.hoisted(() => ({
  userDoc: {},
  collections: {},
  setDoc: null,
}));

vi.mock("../firebase", () => ({ db: {}, auth: {} }));

vi.mock("firebase/auth", () => ({
  // Results unsubscribes from inside the callback, so it must fire async.
  onAuthStateChanged: (_auth, cb) => {
    queueMicrotask(() => cb({ uid: "learner-1", email: "learner@example.com" }));
    return () => {};
  },
}));

vi.mock("firebase/firestore", () => {
  fake.setDoc = vi.fn(async () => {});
  return {
    collection: (_db, name) => ({ name }),
    doc: (...args) => ({ path: args.slice(1).join("/") }),
    getDoc: async () => ({ exists: () => true, data: () => fake.userDoc }),
    getDocs: async (ref) => ({
      docs: (fake.collections[ref.name] || []).map(({ id, ...rest }) => ({ id, data: () => rest })),
    }),
    setDoc: (...args) => fake.setDoc(...args),
  };
});

import Results from "./Results";

const MATRIC = [
  { subject: "English Home Language", mark: 75 },
  { subject: "Mathematics", mark: 70 },
  { subject: "Physical Sciences", mark: 65 },
  { subject: "Life Sciences", mark: 68 },
  { subject: "Geography", mark: 72 },
  { subject: "isiZulu First Additional Language", mark: 80 },
  { subject: "Life Orientation", mark: 95 },
];

const uni = (id, courseName, institution, extra = {}) => ({
  id, courseName, institution, institutionType: "university", faculty: "Science",
  qualificationType: "Bachelor", duration: "3 years", minAPS: 25, keySubjects: [], ...extra,
});

const COURSES = [
  uni("c1", "BSc Computer Science", "University of Johannesburg", {
    minAPS: 30, keySubjects: [{ subject: "Mathematics", minMark: 60 }],
    additionalRequirements: "Applicants with an APS of 28-29 may be wait-listed.", selectionProcess: true,
  }),
  // APS 35 vs 37 needed and Maths 70 vs 75 — unlocked by +5% on every subject
  uni("c7", "BSc Actuarial Science", "University of Johannesburg", { minAPS: 37, keySubjects: [{ subject: "Mathematics", minMark: 75 }] }),
  uni("c2", "BCom Accounting", "University of Johannesburg", { faculty: "Commerce", minAPS: 28 }),
  uni("c3", "BSc Engineering", "University of the Witwatersrand", { faculty: "Engineering", minAPS: 42, keySubjects: [{ subject: "Mathematics", minMark: 70 }] }),
  uni("c4", "BSc Extended Programme", "University of Pretoria", { qualificationType: "Bachelor (Extended)" }),
  uni("c5", "MBChB", "University of Cape Town", { faculty: "Health Sciences", minAPS: 550 }), // UCT score 430 — not qualified
  {
    id: "c6", courseName: "Electrical Engineering N4", institution: "Ekurhuleni East TVET College", campus: "Kempton Park",
    institutionType: "college", faculty: "Engineering", qualificationType: "N4 Certificate", minGrade: "Grade 11", keySubjects: [],
  },
];

const renderResults = async () => {
  render(
    <MemoryRouter initialEntries={["/results"]}>
      <Results />
    </MemoryRouter>
  );
  await screen.findByText("Your Qualifying Courses");
};

describe("Results page smoke test", () => {
  beforeEach(() => {
    fake.userDoc = { plan: "apply_for_me", subjects: MATRIC, grade: "Grade 12", gradeStatus: "completed" };
    fake.collections = { courses: COURSES, institutionSettings: [], facultySettings: [] };
    fake.setDoc.mockClear();
  });

  afterEach(cleanup);

  it("lists the courses the learner qualifies for", async () => {
    await renderResults();
    expect(within(screen.getByText(/Your APS:/)).getByText("35")).toBeTruthy();
    expect(screen.getByText("BSc Computer Science")).toBeTruthy();
    expect(screen.getByText("BCom Accounting")).toBeTruthy();
    expect(screen.getByText("BSc Engineering")).toBeTruthy();
    expect(screen.getByText("Extended Degrees")).toBeTruthy();
    expect(screen.getByText("BSc Extended Programme")).toBeTruthy();
    expect(screen.queryByText("MBChB")).toBeNull();
  });

  it("expands a course row into its requirement details", async () => {
    await renderResults();
    fireEvent.click(screen.getByText("BSc Computer Science"));
    expect(screen.getByText(/Min APS: 30/)).toBeTruthy();
    expect(screen.getByText(/Mathematics ≥60%/)).toBeTruthy();
    expect(screen.getByText(/may be wait-listed/)).toBeTruthy();
    expect(screen.getByText(/has a selection process/)).toBeTruthy();
    fireEvent.click(screen.getByText("BSc Engineering"));
    expect(screen.getByText(/Wits APS/)).toBeTruthy();
  });

  it("shows courses within reach and what's missing for each", async () => {
    await renderResults();
    expect(screen.getByText("Within reach (1)")).toBeTruthy();
    expect(screen.getByText("BSc Actuarial Science")).toBeTruthy();
    expect(screen.getByText("+5% needed")).toBeTruthy();
    expect(screen.getByText("APS 35 — need 37")).toBeTruthy();
    expect(screen.getByText("Mathematics ≥75% — you have 70%")).toBeTruthy();
  });

  it("lets the learner try different marks without saving them", async () => {
    await renderResults();
    fireEvent.click(screen.getByRole("button", { name: /What if my marks change/ }));
    fireEvent.click(screen.getByRole("button", { name: "+5% on every subject" }));
    expect(screen.getByText("(+1 new)")).toBeTruthy();
    expect(screen.getByText(/APS \(best 6\): 35/).textContent).toMatch(/35 → 38/);
    expect(screen.getAllByText("BSc Actuarial Science")).toHaveLength(2); // what-if list + within reach

    fireEvent.change(screen.getByLabelText("What-if mark for Mathematics"), { target: { value: "40" } });
    expect(screen.getByText(/fewer\)/)).toBeTruthy();
    expect(fake.setDoc).not.toHaveBeenCalled();
  });

  it("shows paying learners which applications have been lodged", async () => {
    fake.userDoc = {
      ...fake.userDoc,
      applyStatus: "submitted",
      applySelections: {
        "University of Johannesburg": { 1: { id: "c1", courseName: "BSc Computer Science" } },
        "University of the Witwatersrand": { 1: { id: "c3", courseName: "BSc Engineering" } },
      },
      applicationProgress: { "University of Johannesburg": { applied: true, appliedAt: "2026-05-03T10:00:00Z" } },
    };
    await renderResults();
    expect(screen.getByText("We've applied to 1 of 2 institutions so far.")).toBeTruthy();
    expect(screen.getByText(/✓ Applied/)).toBeTruthy();
    expect(screen.getByText("⏳ Not yet applied")).toBeTruthy();
    // Choices can't be edited once applications have been lodged
    expect(screen.queryByRole("button", { name: "Edit selections" })).toBeNull();
  });

  it("shares exactly the courses on screen, and saves them as a PDF", async () => {
    await renderResults();
    fireEvent.change(screen.getByPlaceholderText("Search for a course..."), { target: { value: "Account" } });
    const whatsApp = screen.getByRole("link", { name: "Share on WhatsApp" });
    const text = decodeURIComponent(whatsApp.getAttribute("href").split("?text=")[1]);
    expect(text).toContain("I qualify for 1 course:");
    expect(text).toContain("• BCom Accounting — University of Johannesburg");

    window.print = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "Save as PDF" }));
    expect(window.print).toHaveBeenCalled();
    expect(screen.getByText("My qualifying courses")).toBeTruthy();
    fireEvent(window, new Event("afterprint"));
    expect(screen.queryByText("My qualifying courses")).toBeNull();
  });

  it("offers a calendar reminder for an open application window", async () => {
    const inThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const closeDate = [inThirtyDays.getFullYear(), String(inThirtyDays.getMonth() + 1).padStart(2, "0"), String(inThirtyDays.getDate()).padStart(2, "0")].join("-");
    fake.collections.institutionSettings = [{ id: "University of Johannesburg", openDate: null, closeDate }];
    URL.createObjectURL = vi.fn(() => "blob:calendar");
    URL.revokeObjectURL = vi.fn();

    await renderResults();
    fireEvent.click(screen.getByText("BSc Computer Science"));
    fireEvent.click(screen.getByRole("button", { name: /Add the closing date .* to my calendar/ }));
    const blob = URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("text/calendar");
    expect(await blob.text()).toContain(`DTSTART;VALUE=DATE:${closeDate.replace(/-/g, "")}`);
  });

  it("lets any learner star courses into a saved shortlist", async () => {
    fake.userDoc = { ...fake.userDoc, plan: "free" };
    await renderResults();
    fireEvent.click(screen.getByRole("button", { name: "Add to shortlist: BSc Computer Science" }));
    expect(screen.getByText("★ My shortlist (1)")).toBeTruthy();
    expect(screen.getByText("Want us to apply to these for you?")).toBeTruthy();
    await vi.waitFor(() => expect(fake.setDoc).toHaveBeenCalled());
    expect(fake.setDoc.mock.calls.at(-1)[1]).toEqual({
      shortlist: [{ id: "c1", courseName: "BSc Computer Science", institution: "University of Johannesburg" }],
    });

    // Both the card's star and the panel's star remove it
    const removeButtons = screen.getAllByRole("button", { name: "Remove from shortlist: BSc Computer Science" });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByText(/My shortlist/)).toBeNull();
    expect(fake.setDoc.mock.calls.at(-1)[1]).toEqual({ shortlist: [] });
  });

  it("runs a quick NSFAS funding check", async () => {
    await renderResults();
    fireEvent.click(screen.getByRole("button", { name: /Can I get funding to study/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "No" })[0]); // SASSA grant
    fireEvent.click(screen.getAllByRole("button", { name: "No" })[1]); // disability
    expect(screen.queryByRole("status")).toBeNull(); // income not answered yet
    fireEvent.click(screen.getByRole("button", { name: "Between R350,000 and R600,000" }));
    expect(screen.getByRole("status").textContent).toMatch(/probably above NSFAS's limit/);
    fireEvent.click(screen.getAllByRole("button", { name: "Yes" })[1]); // lives with a disability
    expect(screen.getByRole("status").textContent).toMatch(/probably meet NSFAS's financial criteria/);
  });

  it("filters by search term and switches to colleges", async () => {
    await renderResults();
    fireEvent.change(screen.getByPlaceholderText("Search for a course..."), { target: { value: "Account" } });
    expect(screen.getByText("BCom Accounting")).toBeTruthy();
    expect(screen.queryByText("BSc Computer Science")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Colleges/ }));
    expect(screen.getByText("Electrical Engineering N4")).toBeTruthy();
    expect(screen.getByText("✓ Qualify")).toBeTruthy();
  });

  it("picks a first-choice course and saves a draft", async () => {
    await renderResults();
    fireEvent.click(screen.getByRole("button", { name: "Start Selecting" }));
    expect(screen.getByText("Pick Your 1st Choices")).toBeTruthy();

    fireEvent.click(screen.getByText("BSc Computer Science"));
    fireEvent.click(screen.getByRole("button", { name: "Select this course →" }));
    const progress = screen.getByText(/\/6 institutions selected/);
    expect(within(progress).getByText("1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save & Exit" }));
    await vi.waitFor(() => expect(fake.setDoc).toHaveBeenCalled());
    expect(fake.setDoc.mock.calls[0][1]).toMatchObject({
      applyStatus: "draft",
      applySelections: { "University of Johannesburg": { 1: { id: "c1" } } },
    });
  });

  it("walks all three rounds through to submission", async () => {
    await renderResults();
    const pick = (courseName) => {
      fireEvent.click(screen.getByText(courseName));
      fireEvent.click(screen.getByRole("button", { name: "Select this course →" }));
    };

    fireEvent.click(screen.getByRole("button", { name: "Start Selecting" }));
    pick("BSc Computer Science");
    pick("BSc Engineering");
    pick("BSc Extended Programme");
    fireEvent.click(screen.getByRole("button", { name: /Colleges/ }));
    // The learner qualifies at only these four institutions, so this pick
    // exhausts round 1 and should jump straight to the review screen.
    pick("Electrical Engineering N4");
    expect(screen.getByText("1st Choice Confirmed")).toBeTruthy();

    // Round 2: only UJ has another qualifying course.
    fireEvent.click(screen.getByRole("button", { name: "Go to 2nd Choices →" }));
    pick("BCom Accounting");
    expect(screen.getByText("2nd Choice Confirmed")).toBeTruthy();

    // Round 3: nothing left anywhere, so it goes straight to its review.
    fireEvent.click(screen.getByRole("button", { name: "Go to 3rd Choices →" }));
    expect(screen.getByText("3rd Choice Confirmed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Submit →" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit Applications ✓" }));
    expect(screen.getByText("Please enter a phone number.")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("e.g. +27 81 234 5678"), { target: { value: "+27 82 000 0000" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit Applications ✓" }));
    expect(await screen.findByText("✅ Selections submitted!")).toBeTruthy();
    expect(fake.setDoc.mock.calls.at(-1)[1]).toMatchObject({
      applyStatus: "submitted",
      applyContactPhone: "+27 82 000 0000",
      applyContactEmail: "learner@example.com",
      applySelections: {
        "University of Johannesburg": { 1: { id: "c1" }, 2: { id: "c2" } },
        "University of the Witwatersrand": { 1: { id: "c3" } },
        "University of Pretoria": { 1: { id: "c4" } },
        "Ekurhuleni East TVET College": { 1: { id: "c6" } },
      },
    });
  });
});
