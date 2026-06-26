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
 */

function normalize(str) {
  return String(str ?? "").trim().toLowerCase();
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

  // Special case: "mathematics" requirement must NOT match "mathematical literacy"
  if (req === "mathematics" && user === "mathematical literacy") return false;
  if (req === "mathematics" && user === "math literacy") return false;

  // "mathematical literacy" requirement must not match plain "mathematics"
  if (req === "mathematical literacy" && user === "mathematics") return false;

  // General: requirement is a prefix of, or fully contained in, the user subject
  // e.g. req="English" matches user="English Home Language"
  if (user.startsWith(req)) return true;
  if (user.includes(req)) return true;

  return false;
}

/**
 * Check whether a user's subjects array satisfies a course's keySubjects requirements.
 *
 * @param {Array<{subject: string, mark: number|string}>} userSubjects
 * @param {Array} keySubjects - from courses.json
 * @returns {boolean}
 */
export function meetsKeySubjects(userSubjects, keySubjects) {
  if (!keySubjects || keySubjects.length === 0) return true;

  return keySubjects.every((req) => {
    // subjectGroup: user must satisfy at least one option in the group
    if (req.subjectGroup) {
      return req.subjectGroup.some((opt) =>
        userSubjects.some(
          (s) =>
            subjectMatches(s.subject, opt.subject) &&
            parseInt(s.mark, 10) >= opt.minMark
        )
      );
    }

    // Single subject requirement
    return userSubjects.some(
      (s) =>
        subjectMatches(s.subject, req.subject) &&
        parseInt(s.mark, 10) >= req.minMark
    );
  });
}