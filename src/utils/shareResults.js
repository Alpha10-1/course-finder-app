// Text and files learners can take away from their results: a short message
// for WhatsApp (or the phone's share sheet) and calendar reminders for
// application deadlines.

export const SITE_URL = "https://mycoursefinder.web.app";
const MAX_LISTED = 10;

/**
 * A WhatsApp-sized summary of the courses a learner is looking at.
 *
 * @param {{aps: number, courses: Array<{courseName: string, institution: string, campus?: string}>}} params
 */
export function buildShareText({ aps, courses }) {
  const lines = ["My Course Finder results 🎓", `APS: ${aps}`];
  if (courses.length === 0) {
    lines.push("No courses match my current filters yet.");
  } else {
    lines.push(`I qualify for ${courses.length} course${courses.length === 1 ? "" : "s"}${courses.length > MAX_LISTED ? ", including" : ""}:`);
    for (const c of courses.slice(0, MAX_LISTED)) {
      lines.push(`• ${c.courseName} — ${c.institution}${c.campus ? ` (${c.campus})` : ""}`);
    }
    if (courses.length > MAX_LISTED) lines.push(`…and ${courses.length - MAX_LISTED} more.`);
  }
  lines.push(`Check yours: ${SITE_URL}`);
  return lines.join("\n");
}

export const whatsAppShareUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

// ── Calendar reminders (.ics) ───────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, "0");
const icsDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const icsStamp = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
// RFC 5545 text escaping
const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/**
 * An all-day calendar event on an application's closing date, with reminders
 * a week and a day before.
 *
 * @param {{title: string, closeDate: string, description?: string, uid: string, now?: Date}} params
 *   closeDate is "YYYY-MM-DD" (as stored in institutionSettings / facultySettings)
 */
export function buildDeadlineCalendarFile({ title, closeDate, description = "", uid, now = new Date() }) {
  const [y, m, d] = closeDate.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 1);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Course Finder//Application deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@mycoursefinder.web.app`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART;VALUE=DATE:${icsDate(start)}`,
    `DTEND;VALUE=DATE:${icsDate(end)}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText(description)}`,
    `URL:${SITE_URL}`,
    ...["-P7D", "-P1D"].flatMap((trigger) => [
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(title)}`,
      `TRIGGER:${trigger}`,
      "END:VALARM",
    ]),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n") + "\r\n";
}

/** Triggers a browser download of a text file. */
export function downloadTextFile(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
