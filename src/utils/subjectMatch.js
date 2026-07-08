/**
 * Fuzzy subject matcher.
 *
 * Course JSON uses short names like "English", "Mathematics", "Physical Sciences".
 * Users may select full NSC names like "English Home Language",
 * "English First Additional Language", "Mathematical Literacy", etc.
 *
 * Rules:
 *  - Exact match (case-insensitive) always wins.
 *  - A short course requirement matches a user subject if the requirement
 *    string is contained within the user subject name, OR the user subject
 *    name starts with the requirement string.
 *  - Special cases: "Mathematics" in a requirement must NOT match
 *    "Mathematical Literacy" unless the requirement explicitly says
 *    "Mathematical Literacy".
 *  - Known synonym pairs (e.g. "Computer Literacy" ↔ "CAT") are treated
 *    as equivalent, since colleges often use the older/generic term while
 *    NSC subject lists use the formal CAT name.
 */

function normalize(str) {
  return String(str ?? "").trim().toLowerCase();
}

// Matches "20 Credit Subject", "20 Credit Subject 1", "20-credit subject 2",
// "Other Subject", "Other Subjects (2)", "Other Subjects 3", etc.
// Different institutions use different generic wording in their prospectus for
// the same idea: "any recognised 20-credit NSC subject", i.e. any Grade 12
// subject at all, EXCLUDING Life Orientation (which carries only 10 credits and
// is explicitly excluded from APS/subject-requirement counting).
//
// Note: a numbered/parenthesised suffix (e.g. the "(2)" in "Other Subjects (2)")
// is only there so multiple placeholder rows can appear side by side in the
// JSON without literally duplicating a dict key — meetsKeySubjects checks each
// row independently ("does the learner have *some* qualifying subject for this
// row"), so it does not by itself guarantee the learner has that many *distinct*
// subjects satisfying the requirement. This mirrors how DUT's numbered
// "20 Credit Subject 1/2/3" placeholders already behave.
const GENERIC_CREDIT_SUBJECT_RE = /^(20[\s-]*credit\s*subjects?|other\s*subjects?)(\s*\(?\d+\)?)?$/i;

function isGenericCreditSubject(reqSubject) {
  return GENERIC_CREDIT_SUBJECT_RE.test(String(reqSubject ?? "").trim());
}

// Exported so UI code (e.g. the per-requirement status breakdown in Results.jsx)
// can apply the same "any subject but LO" rule instead of re-implementing it.
export { isGenericCreditSubject };

function isLifeOrientationName(name) {
  const n = normalize(name);
  return n === "life orientation" || n.includes("life orientation");
}

// Matches "Another Language", "Another Official Language", "Second Language", etc.
// Several institutions (e.g. UWC) phrase their second-official-language requirement
// this way rather than naming a specific language, since a learner could offer any
// one of the 11 official languages as Home or First Additional Language alongside
// English. This mirrors GENERIC_CREDIT_SUBJECT_RE's placeholder pattern, but is
// restricted to language subjects (excluding English) rather than any NSC subject.
const ANOTHER_LANGUAGE_RE = /^(another|second|additional)\s+(official\s+)?language$/i;

function isAnotherLanguagePlaceholder(reqSubject) {
  return ANOTHER_LANGUAGE_RE.test(String(reqSubject ?? "").trim());
}

export { isAnotherLanguagePlaceholder };

// The 11 official NSC languages, each offered as Home Language or First
// Additional Language — matches the subject list authored in EnterMarks.jsx.
const LANGUAGE_SUBJECT_RE = /(home language|first additional language)$/i;

function isLanguageSubjectName(name) {
  return LANGUAGE_SUBJECT_RE.test(normalize(name));
}


// Pairs of subject names treated as equivalent regardless of substring overlap.
// Each pair is checked both directions.
const SYNONYM_PAIRS = [
  ["computer literacy", "cat (computer applications technology)"],
  ["computer literacy", "cat"],
  ["computer literacy", "computer applications technology"],
  ["it", "information technology"],
  ["it (information technology)", "information technology"],
];

function isSynonym(a, b) {
  return SYNONYM_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

/**
 * Returns true if the user's subject name satisfies the course requirement name.
 *
 * @param {string} userSubject  - e.g. "English Home Language"
 * @param {string} reqSubject   - e.g. "English"
 */
export function subjectMatches(userSubject, reqSubject) {
  const user = normalize(userSubject);
  const req  = normalize(reqSubject);

  // Exact match
  if (user === req) return true;

  // Known synonym pairs (e.g. Computer Literacy ↔ CAT)
  if (isSynonym(user, req)) return true;

  // Special case: "mathematics" requirement must NOT match "mathematical literacy"
  if (req === "mathematics" && user === "mathematical literacy") return false;
  if (req === "mathematics" && user === "math literacy") return false;

  // "mathematical literacy" requirement must not match plain "mathematics"
  if (req === "mathematical literacy" && user === "mathematics") return false;

  // "mathematics" requirement must NOT match "technical mathematics" — these
  // are distinct NSC subjects and most courses that require pure Mathematics
  // do not accept Technical Mathematics as a substitute. (The reverse — a
  // course requiring Technical Mathematics being satisfied by a user who did
  // plain Mathematics — is allowed via the general containment rule below.)
  if (req === "mathematics" && user === "technical mathematics") return false;

  // General: requirement is a prefix of, or fully contained in, the user subject
  // e.g. req="English" matches user="English Home Language"
  if (user.startsWith(req)) return true;
  if (user.includes(req)) return true;

  // Reverse containment: req contains user as a substring
  // e.g. req="CAT (Computer Applications Technology)" matches user="CAT"
  if (req.includes(user) && user.length >= 3) return true;

  return false;
}

/**
 * Check whether a user's subjects array satisfies a course's keySubjects requirements.
 *
 * @param {Array<{subject: string, mark: number|string}>} userSubjects
 * @param {Array} keySubjects - from courses.json
 * @returns {boolean}
 */
function safeMark(mark) {
  const n = parseInt(mark, 10);
  return Number.isFinite(n) ? n : -1;
}

export function meetsKeySubjects(userSubjects, keySubjects) {
  if (!keySubjects || keySubjects.length === 0) return true;

  return keySubjects.every((req) => {
    // subjectGroup: user must satisfy at least one option in the group
    if (req.subjectGroup) {
      return req.subjectGroup.some((opt) => {
        if (isGenericCreditSubject(opt.subject)) {
          return userSubjects.some(
            (s) => !isLifeOrientationName(s.subject) && safeMark(s.mark) >= opt.minMark
          );
        }
        if (isAnotherLanguagePlaceholder(opt.subject)) {
          return userSubjects.some(
            (s) =>
              isLanguageSubjectName(s.subject) &&
              !subjectMatches(s.subject, "English") &&
              safeMark(s.mark) >= opt.minMark
          );
        }
        return userSubjects.some(
          (s) =>
            subjectMatches(s.subject, opt.subject) &&
            safeMark(s.mark) >= opt.minMark
        );
      });
    }

    // Generic "20 Credit Subject [N]" placeholder: any NSC subject other than
    // Life Orientation, at or above the stated mark, satisfies this slot.
    if (isGenericCreditSubject(req.subject)) {
      return userSubjects.some(
        (s) => !isLifeOrientationName(s.subject) && safeMark(s.mark) >= req.minMark
      );
    }

    // Generic "Another Language" placeholder: any official NSC language subject
    // (Home or First Additional) other than English, at or above the stated mark.
    if (isAnotherLanguagePlaceholder(req.subject)) {
      return userSubjects.some(
        (s) =>
          isLanguageSubjectName(s.subject) &&
          !subjectMatches(s.subject, "English") &&
          safeMark(s.mark) >= req.minMark
      );
    }

    // Single subject requirement
    return userSubjects.some(
      (s) =>
        subjectMatches(s.subject, req.subject) &&
        safeMark(s.mark) >= req.minMark
    );
  });
}