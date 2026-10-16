import { describe, expect, it, vi } from "vitest";
import {
  REMINDER_KINDS,
  applicationLodgedMessage,
  buildReminderMessage,
  interestsOf,
  planReminders,
  reminderEventsFor,
} from "./reminders.js";
import { sendToTokens, removeDeadTokens } from "./push.js";
import { addDays, formatDayMonth, saToday } from "../../src/utils/saDate.js";

const TODAY = "2026-10-16";

const settings = {
  institutionSettings: {
    "University of Johannesburg": { openDate: "2026-04-01", closeDate: "2026-10-17" }, // closes tomorrow
    "University of Pretoria": { openDate: "2026-04-01", closeDate: "2026-10-23" },     // closes in 7 days
    "Rhodes University": { openDate: TODAY, closeDate: "2026-12-01" },                 // opens today
    "Stellenbosch University": { openDate: "2026-04-01", closeDate: "2026-11-30" },    // nothing today
  },
  facultySettings: {
    "Stellenbosch University|||Faculty of Health Sciences": { openDate: "2026-04-01", closeDate: "2026-10-17" },
  },
};

describe("saDate helpers", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formats dates and South African 'today'", () => {
    expect(formatDayMonth("2026-09-30")).toBe("30 September");
    expect(saToday(new Date("2026-10-16T22:30:00Z"))).toBe("2026-10-17");
  });
});

describe("interestsOf", () => {
  it("collects shortlist and Apply For Me institutions once each", () => {
    const user = {
      shortlist: [
        { id: "a", institution: "University of Johannesburg" },
        { id: "b", institution: "University of Johannesburg" },
        { id: "c", institution: "Stellenbosch University", faculty: "Faculty of Health Sciences" },
      ],
      applySelections: { "Rhodes University": { 1: { courseName: "BA" } } },
    };
    expect(interestsOf(user)).toEqual([
      { institution: "University of Johannesburg" },
      { institution: "Stellenbosch University", faculty: "Faculty of Health Sciences" },
      { institution: "Rhodes University" },
    ]);
  });

  it("leaves out institutions an Apply For Me learner has handed over", () => {
    const user = {
      plan: "apply_for_me",
      applyStatus: "submitted",
      shortlist: [{ institution: "University of Johannesburg" }, { institution: "Rhodes University" }],
      applySelections: { "University of Johannesburg": { 1: { courseName: "BSc" } } },
    };
    expect(interestsOf(user)).toEqual([{ institution: "Rhodes University" }]);
  });
});

describe("reminderEventsFor", () => {
  it("finds opening and closing reminders, most urgent first", () => {
    const user = {
      shortlist: [
        { institution: "Rhodes University" },
        { institution: "University of Pretoria" },
        { institution: "University of Johannesburg" },
        { institution: "Stellenbosch University" },
      ],
    };
    const events = reminderEventsFor(user, settings, TODAY);
    expect(events.map((e) => [e.institution, e.kind])).toEqual([
      ["University of Johannesburg", REMINDER_KINDS.CLOSES_TOMORROW],
      ["University of Pretoria", REMINDER_KINDS.CLOSES_IN_7],
      ["Rhodes University", REMINDER_KINDS.OPENS],
    ]);
  });

  it("uses a faculty's own dates when it has them", () => {
    const user = { shortlist: [{ institution: "Stellenbosch University", faculty: "Faculty of Health Sciences" }] };
    const [event] = reminderEventsFor(user, settings, TODAY);
    expect(event).toMatchObject({ kind: REMINDER_KINDS.CLOSES_TOMORROW, faculty: "Faculty of Health Sciences" });
  });

  it("ignores institutions without dates", () => {
    expect(reminderEventsFor({ shortlist: [{ institution: "Unknown University" }] }, settings, TODAY)).toEqual([]);
  });
});

describe("buildReminderMessage", () => {
  it("words a single reminder", () => {
    const message = buildReminderMessage(
      [{ institution: "University of Johannesburg", kind: REMINDER_KINDS.CLOSES_TOMORROW, date: "2026-10-17" }],
      TODAY
    );
    expect(message).toEqual({
      title: "University of Johannesburg: applications close tomorrow",
      body: "The closing date is 17 October. Apply today if you haven't yet.",
      url: "/results",
      tag: "reminders-2026-10-16",
    });
  });

  it("mentions the closing date when applications open", () => {
    const message = buildReminderMessage(
      [{ institution: "Rhodes University", kind: REMINDER_KINDS.OPENS, date: TODAY, closeDate: "2026-12-01" }],
      TODAY
    );
    expect(message.body).toBe("Rhodes University is now taking applications. The closing date is 1 December.");
  });

  it("combines several reminders into one notification", () => {
    const message = buildReminderMessage(
      [
        { institution: "University of Johannesburg", kind: REMINDER_KINDS.CLOSES_TOMORROW, date: "2026-10-17" },
        { institution: "Rhodes University", kind: REMINDER_KINDS.OPENS, date: TODAY },
      ],
      TODAY
    );
    expect(message.title).toBe("2 application reminders");
    expect(message.body).toBe(
      "• University of Johannesburg closes tomorrow (17 October)\n• Rhodes University is now open for applications"
    );
  });
});

describe("planReminders", () => {
  it("only plans notifications for opted-in learners with a device and something due", () => {
    const users = [
      { uid: "on", reminders: true, pushTokens: ["t1", "t2"], shortlist: [{ institution: "University of Johannesburg" }] },
      { uid: "off", reminders: false, pushTokens: ["t3"], shortlist: [{ institution: "University of Johannesburg" }] },
      { uid: "no-device", reminders: true, pushTokens: [], shortlist: [{ institution: "University of Johannesburg" }] },
      { uid: "nothing-due", reminders: true, pushTokens: ["t4"], shortlist: [{ institution: "Stellenbosch University" }] },
    ];
    const plan = planReminders({ users, ...settings, today: TODAY });
    expect(plan.map((p) => p.uid)).toEqual(["on"]);
    expect(plan[0].tokens).toEqual(["t1", "t2"]);
    expect(plan[0].message.title).toBe("University of Johannesburg: applications close tomorrow");
  });
});

describe("applicationLodgedMessage", () => {
  it("names the institution", () => {
    expect(applicationLodgedMessage("Rhodes University").title).toBe("We've applied to Rhodes University for you 🎉");
  });
});

describe("sendToTokens", () => {
  it("sends a data-only message and reports dead tokens", async () => {
    const messaging = {
      sendEachForMulticast: vi.fn(async ({ tokens }) => ({
        responses: tokens.map((t) =>
          t === "dead" ? { success: false, error: { code: "messaging/registration-token-not-registered" } }
            : t === "flaky" ? { success: false, error: { code: "messaging/internal-error" } }
              : { success: true }
        ),
      })),
    };
    const message = { title: "T", body: "B", url: "/results", tag: "x" };
    const result = await sendToTokens(messaging, ["ok", "dead", "flaky"], message, 60);
    expect(result).toEqual({ sent: 1, failed: 2, deadTokens: ["dead"] });
    const call = messaging.sendEachForMulticast.mock.calls[0][0];
    expect(call.data).toEqual(message);
    expect(call.notification).toBeUndefined();
    expect(call.webpush.headers.TTL).toBe("60");
  });

  it("removes dead tokens from the learner's record", async () => {
    const update = vi.fn(async () => {});
    const db = { collection: () => ({ doc: (uid) => ({ uid, update }) }) };
    const FieldValue = { arrayRemove: (...t) => ({ removed: t }) };
    await removeDeadTokens(db, FieldValue, "u1", ["dead"]);
    expect(update).toHaveBeenCalledWith({ pushTokens: { removed: ["dead"] } });
    await removeDeadTokens(db, FieldValue, "u1", []);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
