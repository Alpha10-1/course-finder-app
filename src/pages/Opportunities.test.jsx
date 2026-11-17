// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

const fake = vi.hoisted(() => ({ userDoc: {}, collections: {}, setDoc: null, failRead: false }));

vi.mock("../firebase", () => ({ db: {}, auth: {} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth, cb) => {
    queueMicrotask(() => cb({ uid: "learner-1" }));
    return () => {};
  },
}));
vi.mock("firebase/firestore", () => {
  fake.setDoc = vi.fn(async () => {});
  return {
    collection: (_db, name) => ({ name }),
    doc: (...args) => ({ path: args.slice(1).join("/") }),
    getDoc: async () => ({ exists: () => true, data: () => fake.userDoc }),
    getDocs: async (ref) => {
      if (fake.failRead) throw new Error("permission-denied");
      return { docs: (fake.collections[ref.name] || []).map(({ id, ...rest }) => ({ id, data: () => rest })) };
    },
    setDoc: (...args) => fake.setDoc(...args),
  };
});

import Opportunities from "./Opportunities";
import FreeCourses from "./FreeCourses";

const listing = (id, title, extra = {}) => ({
  id, title, organisation: "Acme", type: "learnership", applyUrl: `https://example.com/${id}`, source: "Acme careers page",
  published: true, closeDate: "2099-12-31", requiredSubjects: [], provinces: [], ...extra,
});

describe("Learnerships & jobs page", () => {
  beforeEach(() => {
    fake.failRead = false;
    fake.userDoc = {
      subjects: [{ subject: "English Home Language", mark: 60 }],
      workProfile: { education: "matric", province: "Gauteng", dateOfBirth: "2006-01-01", saCitizen: true, unemployed: true },
    };
    fake.collections = {
      opportunities: [
        listing("o1", "Retail Learnership", { minEducation: "matric", provinces: ["Gauteng"], saCitizenOnly: true, otherRequirements: "Bring a certified ID copy" }),
        listing("o2", "Driver Learnership", { driversLicence: true }),
        listing("o3", "Engineering Internship", { minEducation: "diploma" }),
        listing("o4", "Draft listing", { published: false }),
        listing("o5", "Old listing", { closeDate: "2000-01-01" }),
      ],
    };
    fake.setDoc.mockClear();
  });
  afterEach(cleanup);

  const renderPage = async () => {
    render(<MemoryRouter><Opportunities /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Learnerships & jobs" });
  };

  it("shows only listings the learner meets every requirement for, with the reasons", async () => {
    await renderPage();
    expect(screen.getByText(/Never pay to apply/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "You qualify for 1" })).toBeTruthy();
    expect(screen.getByText("Retail Learnership")).toBeTruthy();
    expect(screen.getByText(/You meet: Matric \(Grade 12\) or higher · Lives in Gauteng · South African citizen/)).toBeTruthy();
    expect(screen.getByText(/Bring a certified ID copy/)).toBeTruthy();
    for (const hidden of ["Engineering Internship", "Draft listing", "Old listing", "Driver Learnership"]) {
      expect(screen.queryByText(hidden)).toBeNull();
    }
    // The licence question is unanswered, so that listing is offered as a prompt, not shown.
    expect(screen.getByText(/whether you have a driver's licence/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Apply on their site/ }).getAttribute("href")).toBe("https://example.com/o1");
  });

  it("saves the profile and re-checks listings straight away", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Do you have a driver's licence?"), { target: { value: "yes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save my profile" }));
    expect(await screen.findByRole("heading", { name: "You qualify for 2" })).toBeTruthy();
    const [, data, options] = fake.setDoc.mock.calls[0];
    expect(data.workProfile).toMatchObject({ hasDriversLicence: true, education: "matric" });
    expect(options).toEqual({ mergeFields: ["workProfile"] });
  });

  it("asks a new learner for their profile first", async () => {
    fake.userDoc = {};
    await renderPage();
    expect(screen.getByRole("button", { name: "Save my profile" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nothing you qualify for right now" })).toBeTruthy();
  });
});

describe("Free courses page", () => {
  beforeEach(() => {
    fake.failRead = false;
    fake.collections = {
      freeCourses: [
        { id: "c1", title: "CS50x", provider: "Harvard", url: "https://cs50.harvard.edu/x/", topics: ["coding"], certificate: "free", level: "beginner", published: true },
        { id: "c2", title: "Cloud basics", provider: "Microsoft", url: "https://learn.microsoft.com/", topics: ["cloud"], certificate: "paid", level: "beginner", published: true },
        { id: "c3", title: "Unchecked draft", provider: "X", url: "https://x.example", topics: ["coding"], certificate: "free", published: false },
      ],
    };
  });
  afterEach(cleanup);

  const renderPage = () => render(<HelmetProvider><MemoryRouter><FreeCourses /></MemoryRouter></HelmetProvider>);

  it("lists published courses with honest certificate labels and filters by topic", async () => {
    renderPage();
    expect(await screen.findByText("CS50x")).toBeTruthy();
    expect(screen.getByText("Free certificate")).toBeTruthy();
    expect(screen.getByText("Course free, certificate costs money")).toBeTruthy();
    expect(screen.queryByText("Unchecked draft")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cloud" }));
    expect(screen.queryByText("CS50x")).toBeNull();
    expect(screen.getByText("Cloud basics")).toBeTruthy();
  });

  it("explains when the list can't be loaded", async () => {
    fake.failRead = true;
    renderPage();
    expect(await screen.findByText(/Couldn't load the courses/)).toBeTruthy();
  });
});
