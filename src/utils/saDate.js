// Dates in South African time (SAST, UTC+2 all year), as "YYYY-MM-DD"
// strings — the same format the admin panel stores application windows in.

/** Today's date in South Africa. */
export function saToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(now);
}

/** The date `days` after (or before, if negative) a "YYYY-MM-DD" date. */
export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "30 September" style, for messages. Returns the input if it isn't a date. */
export function formatDayMonth(isoDate) {
  const [y, m, d] = String(isoDate).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return String(isoDate);
  return date.toLocaleDateString("en-ZA", { timeZone: "UTC", day: "numeric", month: "long" });
}
