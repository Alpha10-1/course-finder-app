// @vitest-environment jsdom
//
// Smoke test for the subject-choice advisor against the real course catalogue.
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import SubjectAdvisor from "./SubjectAdvisor";

const seen = { search: "" };
function LocationSpy() {
  const { search } = useLocation();
  useEffect(() => { seen.search = search; }, [search]);
  return null;
}

const renderAdvisor = (search = "") =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[`/subject-choices${search}`]}>
        <Routes>
          <Route path="/subject-choices" element={<><SubjectAdvisor /><LocationSpy /></>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );

const openCount = () => Number(screen.getByText(/of [\d\s,]+ university courses$/).previousSibling.textContent.replace(/\D/g, ""));

describe("Subject advisor", () => {
  afterEach(cleanup);

  it("shows how many courses the default subjects keep open", () => {
    renderAdvisor();
    expect(screen.getByRole("heading", { name: "Which subjects should I choose?" })).toBeTruthy();
    expect(openCount()).toBeGreaterThan(1500);
    expect(screen.getByRole("button", { name: "Mathematics Pure maths" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("switches to Maths Literacy, explains what it rules out and suggests switching back", async () => {
    renderAdvisor();
    const before = openCount();
    fireEvent.click(screen.getByRole("button", { name: "Mathematical Literacy Maths for everyday life" }));
    expect(openCount()).toBeLessThan(before);
    expect(seen.search).toMatch(/maths=Mathematical\+Literacy/);

    const blockers = screen.getByText(/Most of the university courses you'd miss out on need/).parentElement;
    expect(within(blockers).getByText(/^Mathematics · /)).toBeTruthy();

    const suggestions = screen.getByRole("heading", { name: "Changes that open the most courses" }).parentElement;
    const [first] = await within(suggestions).findAllByText(/instead of/, {}, { timeout: 10000 });
    expect(first.textContent).toBe("Take Mathematics instead of Mathematical Literacy");
    fireEvent.click(within(first.closest("li")).getByRole("button", { name: "Try it" }));
    expect(openCount()).toBe(before);
  }, 20000);

  it("reads a shared combination from the link", () => {
    renderAdvisor("?maths=Mathematics&e=Accounting,Business%20Studies,Economics&mark=70");
    expect(screen.getByRole("button", { name: "Commerce" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByDisplayValue("About 70% in every subject")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/^With these subjects and about 70% in each, you could apply for [\d\s]+ of [\d\s]+ university courses\.$/);
  });

  it("flags a combination schools can't register, and fixes it in one click", () => {
    renderAdvisor("?maths=Mathematical%20Literacy&e=Physical%20Sciences,Life%20Sciences,Geography");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Physical Sciences has to be taken with Mathematics/);
    fireEvent.click(within(alert).getByRole("button", { name: "Switch to Mathematics" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Mathematics Pure maths" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("lists the ruled-out courses in a field, with what they need", () => {
    renderAdvisor("?maths=Mathematical%20Literacy&e=History,Geography,Tourism");
    fireEvent.click(screen.getByRole("button", { name: /Health sciences/ }));
    const needs = screen.getAllByText(/^Needs /);
    expect(needs.length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link").some((a) => a.getAttribute("href").startsWith("/courses/"))).toBe(true);
  });

  it("doesn't offer an elective that's already chosen in another slot", () => {
    renderAdvisor();
    const [first] = screen.getAllByRole("combobox", { name: /Subject 1/ });
    const options = within(first).getAllByRole("option").map((o) => o.value);
    expect(options).toContain("Physical Sciences");
    expect(options).not.toContain("Life Sciences");
  });
});
