// Works out which push reminders to send each day. Pure functions only, so
// they can be tested without Firebase; api/send-reminders.js does the I/O.
//
// A learner gets reminders for the institutions on their shortlist and in
// their Apply For Me choices: the day applications open, 7 days before they
// close and the day before. Apply For Me learners who've handed over their
// choices don't get reminders for those institutions — the team is applying
// for them, and "applications close tomorrow" would only cause panic.
import { addDays, formatDayMonth } from "../../src/utils/saDate.js";

export const REMINDER_KINDS = { OPENS: "opens", CLOSES_IN_7: "closes-7", CLOSES_TOMORROW: "closes-1" };

const facultyKey = (institution, faculty) => `${institution}|||${faculty}`;
const hasDates = (s) => !!(s && (s.openDate || s.closeDate));

function hasHandedOverChoices(user) {
  return user.plan === "apply_for_me" && (user.applyStatus === "submitted" || !!user.applySubmittedAt);
}

/** The { institution, faculty? } pairs a learner has shown interest in. */
export function interestsOf(user) {
  const handedOver = hasHandedOverChoices(user) ? new Set(Object.keys(user.applySelections || {})) : new Set();
  const seen = new Set();
  const interests = [];
  const add = (institution, faculty) => {
    if (!institution || handedOver.has(institution)) return;
    const key = facultyKey(institution, faculty || "");
    if (seen.has(key)) return;
    seen.add(key);
    interests.push(faculty ? { institution, faculty } : { institution });
  };

  for (const entry of Array.isArray(user.shortlist) ? user.shortlist : []) add(entry?.institution, entry?.faculty);
  for (const [institution, choices] of Object.entries(user.applySelections || {})) {
    const faculties = Object.values(choices || {}).map((c) => c?.faculty).filter(Boolean);
    if (faculties.length === 0) add(institution);
    for (const faculty of faculties) add(institution, faculty);
  }
  return interests;
}

/**
 * Today's reminder events for one learner, deduplicated: several shortlisted
 * courses at one institution give one reminder, unless a faculty has its
 * own dates.
 */
export function reminderEventsFor(user, { institutionSettings = {}, facultySettings = {} }, today) {
  const in7 = addDays(today, 7);
  const tomorrow = addDays(today, 1);
  const events = [];
  const seen = new Set();

  for (const { institution, faculty } of interestsOf(user)) {
    const facultyDates = faculty ? facultySettings[facultyKey(institution, faculty)] : null;
    const usesFaculty = hasDates(facultyDates);
    const dates = usesFaculty ? facultyDates : institutionSettings[institution];
    if (!hasDates(dates)) continue;

    const add = (kind, date) => {
      const key = `${institution}|${usesFaculty ? faculty : ""}|${kind}|${date}`;
      if (seen.has(key)) return;
      seen.add(key);
      const event = { institution, kind, date, closeDate: dates.closeDate || null };
      if (usesFaculty) event.faculty = faculty;
      events.push(event);
    };
    if (dates.openDate === today) add(REMINDER_KINDS.OPENS, today);
    if (dates.closeDate === in7) add(REMINDER_KINDS.CLOSES_IN_7, in7);
    if (dates.closeDate === tomorrow) add(REMINDER_KINDS.CLOSES_TOMORROW, tomorrow);
  }

  // Most urgent first.
  const order = { [REMINDER_KINDS.CLOSES_TOMORROW]: 0, [REMINDER_KINDS.CLOSES_IN_7]: 1, [REMINDER_KINDS.OPENS]: 2 };
  return events.sort((a, b) => order[a.kind] - order[b.kind] || a.institution.localeCompare(b.institution));
}

const where = (e) => (e.faculty ? `${e.institution} (${e.faculty})` : e.institution);

function shortLine(e) {
  if (e.kind === REMINDER_KINDS.OPENS) return `${where(e)} is now open for applications`;
  if (e.kind === REMINDER_KINDS.CLOSES_IN_7) return `${where(e)} closes in 7 days (${formatDayMonth(e.date)})`;
  return `${where(e)} closes tomorrow (${formatDayMonth(e.date)})`;
}

/** One notification covering all of a learner's events for the day. */
export function buildReminderMessage(events, today) {
  const tag = `reminders-${today}`;
  const url = "/results";
  if (events.length === 1) {
    const [e] = events;
    if (e.kind === REMINDER_KINDS.OPENS) {
      return {
        title: `Applications are open at ${e.institution}`,
        body: `${where(e)} is now taking applications.${e.closeDate ? ` The closing date is ${formatDayMonth(e.closeDate)}.` : ""}`,
        url, tag,
      };
    }
    const forFaculty = e.faculty ? ` for ${e.faculty}` : "";
    if (e.kind === REMINDER_KINDS.CLOSES_IN_7) {
      return {
        title: `${e.institution}: applications close in 7 days`,
        body: `The closing date${forFaculty} is ${formatDayMonth(e.date)}. Get your documents ready and apply.`,
        url, tag,
      };
    }
    return {
      title: `${e.institution}: applications close tomorrow`,
      body: `The closing date${forFaculty} is ${formatDayMonth(e.date)}. Apply today if you haven't yet.`,
      url, tag,
    };
  }
  return {
    title: `${events.length} application reminders`,
    body: events.map((e) => `• ${shortLine(e)}`).join("\n"),
    url, tag,
  };
}

/**
 * Every notification to send today: learners who turned reminders on, have
 * at least one device registered, and have something to be reminded about.
 */
export function planReminders({ users, institutionSettings, facultySettings, today }) {
  const plan = [];
  for (const user of users) {
    const tokens = Array.isArray(user.pushTokens) ? user.pushTokens.filter((t) => typeof t === "string" && t) : [];
    if (user.reminders !== true || tokens.length === 0) continue;
    const events = reminderEventsFor(user, { institutionSettings, facultySettings }, today);
    if (events.length === 0) continue;
    plan.push({ uid: user.uid, tokens, events, message: buildReminderMessage(events, today) });
  }
  return plan;
}

/** The notification an Apply For Me learner gets when the team lodges an application. */
export function applicationLodgedMessage(institution) {
  return {
    title: `We've applied to ${institution} for you 🎉`,
    body: "Open Course Finder to see which applications we've lodged so far.",
    url: "/results",
    tag: `applied-${institution}`,
  };
}
