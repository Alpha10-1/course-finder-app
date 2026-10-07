// @vitest-environment jsdom
//
// Smoke test for the admin panel: renders it against an in-memory fake of
// Firestore and clicks through every tab, modal and panel. It doesn't assert
// on styling or exact copy — it exists to catch wiring mistakes (a missing
// prop, an undefined handler, a crash on render) when the panel is refactored.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fake = vi.hoisted(() => {
  const SUPER = "lubisialpha@gmail.com";
  return {
    SUPER,
    collections: {
      users: [
        { id: "u-super", email: SUPER, firstName: "Super", lastName: "Admin", isAdmin: true, adminRole: "super", plan: "free" },
        {
          id: "u-learner",
          email: "learner@example.com",
          firstName: "Lerato",
          lastName: "Mokoena",
          plan: "apply_for_me",
          amountPaid: "100.00",
          grade: "Grade 12",
          gradeStatus: "completed",
          subjects: [
            { subject: "English Home Language", mark: 75 },
            { subject: "Mathematics", mark: 70 },
            { subject: "Physical Sciences", mark: 65 },
            { subject: "Life Sciences", mark: 68 },
            { subject: "Geography", mark: 72 },
            { subject: "isiZulu First Additional Language", mark: 80 },
            { subject: "Life Orientation", mark: 85 },
          ],
          applySelections: {
            "University of Johannesburg": { 1: { id: "c1", courseName: "BSc Computer Science" } },
          },
          applyPhone: "+27 82 000 0000",
          applyEmail: "learner@example.com",
        },
      ],
      courses: [
        {
          id: "c1", courseName: "BSc Computer Science", institution: "University of Johannesburg",
          institutionType: "university", faculty: "Science", qualificationType: "Bachelor",
          minAPS: 30, keySubjects: [{ subject: "Mathematics", minMark: 60 }],
        },
        {
          id: "c2", courseName: "N4 Electrical Engineering", institution: "Ekurhuleni East TVET College",
          institutionType: "college", campus: "Kempton Park", faculty: "", qualificationType: "N4 Certificate",
          minAPS: 0, keySubjects: [], minGrade: "Grade 11",
        },
      ],
      courseAuditLogs: [
        {
          id: "a1", action: "edit", courseName: "BSc Computer Science", institution: "University of Johannesburg",
          adminEmail: SUPER, timestamp: "2026-01-01T00:00:00Z", changedFields: { minAPS: { from: 28, to: 30 } },
        },
      ],
      institutionSettings: [{ id: "University of Johannesburg", openDate: "2026-04-01", closeDate: "2026-09-30" }],
      facultySettings: [],
    },
  };
});

vi.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "u-super", email: fake.SUPER, getIdToken: async () => null } },
}));

vi.mock("firebase/auth", () => ({
  sendPasswordResetEmail: vi.fn(async () => {}),
  onAuthStateChanged: vi.fn(() => () => {}),
}));

vi.mock("firebase/firestore", () => {
  const snapshotOf = (rows) => ({
    empty: rows.length === 0,
    docs: rows.map(({ id, ...rest }) => ({ id, data: () => rest })),
  });
  return {
    collection: (_db, name) => ({ name }),
    doc: (...args) => ({ path: args.slice(1).join("/") }),
    query: (ref) => ref,
    orderBy: () => ({}),
    limit: () => ({}),
    getDocs: vi.fn(async (ref) => snapshotOf(fake.collections[ref.name] || [])),
    getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
    setDoc: vi.fn(async () => {}),
    updateDoc: vi.fn(async () => {}),
    deleteDoc: vi.fn(async () => {}),
    addDoc: vi.fn(async () => ({ id: "new-course" })),
    arrayUnion: (...values) => values,
    arrayRemove: (...values) => values,
    writeBatch: () => ({ set() {}, delete() {}, commit: async () => {} }),
  };
});

import Admin from "./Admin";

const tabButton = (name) => screen.getByRole("button", { name });
const click = (el) => fireEvent.click(el);

describe("Admin panel smoke test", () => {
  beforeEach(async () => {
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );
    // Dashboard renders once users + courses have loaded.
    await screen.findByText("Overview");
  });

  afterEach(cleanup);

  it("shows dashboard stats from loaded users and courses", async () => {
    const totalUsers = screen.getByText("Total Users").parentElement;
    expect(within(totalUsers).getByText("2")).toBeTruthy();
    expect(await screen.findByText("R100")).toBeTruthy();
  });

  it("runs a quick check", async () => {
    click(tabButton("Quick Check"));
    const marks = screen.getAllByPlaceholderText("Mark");
    // Default rows: English HL, Maths, LO, Accounting, Business Studies, Geography, Physical Sciences
    [75, 70, 85, 72, 68, 66, 65].forEach((m, i) => fireEvent.change(marks[i], { target: { value: String(m) } }));
    click(screen.getByRole("button", { name: "Check Courses" }));
    expect(await screen.findByText(/APS: 33/)).toBeTruthy();
    expect(screen.getAllByText(/BSc Computer Science/).length).toBeGreaterThan(0);
  });

  it("browses and acts on users", async () => {
    click(tabButton("Users"));
    click(await screen.findByText("Lerato Mokoena"));
    expect(screen.getByText("Apply For Me Selections")).toBeTruthy();

    click(screen.getByRole("button", { name: "Mark as Applied" }));
    expect(await screen.findByText("Marked University of Johannesburg as applied")).toBeTruthy();

    click(screen.getByRole("button", { name: /Reset Password/ }));
    expect(await screen.findByText("Password reset sent to learner@example.com")).toBeTruthy();

    click(screen.getByRole("button", { name: /Delete/ }));
    expect(screen.getByText("Delete User?")).toBeTruthy();
    click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Delete User?")).toBeNull();

    click(screen.getByRole("button", { name: /Import/ }));
    expect(screen.getByText("Import Users from Firebase Console")).toBeTruthy();
    click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), { target: { value: "nobody" } });
    expect(screen.getByText("No users found.")).toBeTruthy();
  });

  it("browses institutions, edits courses and application windows", async () => {
    click(tabButton("Courses"));
    expect(await screen.findByText("🎓 Universities")).toBeTruthy();
    expect(screen.getByText("🏫 Colleges")).toBeTruthy();

    click(screen.getAllByText("Set dates")[0]);
    expect(screen.getByText("Application Window")).toBeTruthy();
    click(screen.getByRole("button", { name: "Cancel" }));

    click(screen.getByRole("button", { name: /\+ Add Course/ }));
    expect(screen.getByText("Add New Course")).toBeTruthy();
    click(screen.getByRole("button", { name: "Cancel" }));

    click(screen.getByRole("button", { name: /Seed Exclusions/ }));
    expect(await screen.findByText("Nothing excluded right now.")).toBeTruthy();

    click(screen.getByRole("button", { name: /Search by APS/ }));
    expect(screen.getByRole("button", { name: /Exit APS Search/ })).toBeTruthy();
    click(screen.getByRole("button", { name: /Bulk Delete/ }));
    expect(screen.getByRole("button", { name: /Exit Bulk Delete/ })).toBeTruthy();
    click(screen.getByRole("button", { name: /Exit Bulk Delete/ }));

    // Single-institution view
    click(screen.getByText("University of Johannesburg"));
    expect(screen.getByRole("button", { name: "← All Institutions" })).toBeTruthy();
    expect(screen.getByText("Science")).toBeTruthy();

    click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByText("Edit Course")).toBeTruthy();
    click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Course updated")).toBeTruthy();

    click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete Course?")).toBeTruthy();
    click(screen.getByRole("button", { name: "Cancel" }));

    const setDates = screen.getAllByText("Set dates");
    click(setDates[setDates.length - 1]); // faculty-level
    expect(screen.getByText("Faculty Application Window")).toBeTruthy();
    click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Application window saved for Science")).toBeTruthy();

    click(screen.getByRole("button", { name: "← All Institutions" }));
    expect(screen.getByText("🎓 Universities")).toBeTruthy();
  });

  it("shows the audit log to the super admin", async () => {
    click(tabButton("Audit Log"));
    expect(screen.getByText("Course Audit Log")).toBeTruthy();
    expect(screen.getByText("minAPS:")).toBeTruthy();
  });

  it("shows settings with current admins", async () => {
    click(tabButton("Settings"));
    expect(screen.getByText("Grant Admin Access")).toBeTruthy();
    expect(screen.getByText("Current Admins")).toBeTruthy();
    expect(screen.getByText("Super Admin")).toBeTruthy();
  });
});
