import { describe, expect, it } from "vitest";
import { buildDeadlineCalendarFile, buildShareText, whatsAppShareUrl } from "./shareResults";

const course = (n) => ({ courseName: `Course ${n}`, institution: "University of Johannesburg" });

describe("buildShareText", () => {
  it("lists every course when there are only a few", () => {
    const text = buildShareText({ aps: 35, courses: [course(1), { ...course(2), campus: "Soweto" }] });
    expect(text).toBe([
      "My Course Finder results 🎓",
      "APS: 35",
      "I qualify for 2 courses:",
      "• Course 1 — University of Johannesburg",
      "• Course 2 — University of Johannesburg (Soweto)",
      "Check yours: https://mycoursefinder.web.app",
    ].join("\n"));
  });

  it("caps the list and says how many more there are", () => {
    const text = buildShareText({ aps: 30, courses: Array.from({ length: 14 }, (_, i) => course(i + 1)) });
    expect(text).toContain("I qualify for 14 courses, including:");
    expect(text).toContain("• Course 10 —");
    expect(text).not.toContain("• Course 11 —");
    expect(text).toContain("…and 4 more.");
  });

  it("handles an empty list", () => {
    expect(buildShareText({ aps: 20, courses: [] })).toContain("No courses match my current filters yet.");
  });

  it("builds a WhatsApp link with the text encoded", () => {
    expect(whatsAppShareUrl("APS: 35 & more")).toBe("https://wa.me/?text=APS%3A%2035%20%26%20more");
  });
});

describe("buildDeadlineCalendarFile", () => {
  const ics = buildDeadlineCalendarFile({
    title: "Applications close: University of Johannesburg",
    closeDate: "2026-09-30",
    description: "BSc Computer Science; check requirements",
    uid: "uj-2026-09-30",
    now: new Date(Date.UTC(2026, 9, 7, 8, 30, 0)),
  });
  const lines = ics.split("\r\n");

  it("is an all-day event on the closing date", () => {
    expect(lines).toContain("DTSTART;VALUE=DATE:20260930");
    expect(lines).toContain("DTEND;VALUE=DATE:20261001");
    expect(lines).toContain("DTSTAMP:20261007T083000Z");
    expect(lines).toContain("UID:uj-2026-09-30@mycoursefinder.web.app");
  });

  it("escapes text and adds reminders a week and a day before", () => {
    expect(lines).toContain("DESCRIPTION:BSc Computer Science\\; check requirements");
    expect(lines.filter((l) => l.startsWith("TRIGGER:"))).toEqual(["TRIGGER:-P7D", "TRIGGER:-P1D"]);
  });

  it("uses CRLF line endings throughout", () => {
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
  });
});
