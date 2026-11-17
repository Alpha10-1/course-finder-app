// Free courses directory: admins keep a list of free online courses in
// Firestore (`freeCourses/{id}`). Learners see the published ones and are sent
// to the provider's own site. Each entry says honestly whether the
// certificate is free, costs money, or doesn't exist.

export const COURSE_TOPICS = [
  { key: "coding", label: "Coding & computer science" },
  { key: "data-ai", label: "Data & AI" },
  { key: "it-support", label: "IT support, networks & cybersecurity" },
  { key: "cloud", label: "Cloud" },
  { key: "digital-marketing", label: "Digital marketing" },
  { key: "business", label: "Business & entrepreneurship" },
  { key: "design", label: "Design" },
  { key: "maths-science", label: "Maths & science" },
  { key: "work-readiness", label: "Work readiness & personal finance" },
];

export const CERTIFICATE_OPTIONS = [
  { key: "free", label: "Free certificate" },
  { key: "paid", label: "Course free, certificate costs money" },
  { key: "none", label: "No certificate" },
];

export const LEVELS = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
];

const labelOf = (list) => (key) => list.find((x) => x.key === key)?.label || key;
export const topicLabel = labelOf(COURSE_TOPICS);
export const certificateLabel = labelOf(CERTIFICATE_OPTIONS);
export const levelLabel = labelOf(LEVELS);

export const BLANK_FREE_COURSE = {
  title: "",
  provider: "",
  url: "",
  topics: [],
  certificate: "free",
  level: "beginner",
  duration: "",
  description: "",
  published: false,
};

const isWebUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};
export const safeUrl = (value) => (isWebUrl(value) ? value : null);

const MAX = { title: 140, provider: 100, url: 500, duration: 60, description: 500 };

/** Checks an admin's form; returns { errors, course } with the cleaned record. */
export function validateFreeCourse(form) {
  const text = (k) => String(form?.[k] ?? "").trim();
  const course = {
    title: text("title"),
    provider: text("provider"),
    url: text("url"),
    topics: Array.from(new Set((form?.topics || []).filter((t) => COURSE_TOPICS.some((x) => x.key === t)))),
    certificate: CERTIFICATE_OPTIONS.some((c) => c.key === form?.certificate) ? form.certificate : "none",
    level: LEVELS.some((l) => l.key === form?.level) ? form.level : "beginner",
    duration: text("duration"),
    description: text("description"),
    published: form?.published === true,
  };
  const errors = [];
  if (!course.title) errors.push("Add the course title.");
  if (!course.provider) errors.push("Add who offers it.");
  if (!isWebUrl(course.url)) errors.push("Add the course's web address, starting with https://");
  if (course.topics.length === 0) errors.push("Pick at least one topic.");
  for (const [k, max] of Object.entries(MAX)) {
    if (course[k].length > max) errors.push(`"${k}" is too long (${max} characters max).`);
  }
  return { errors, course };
}

/** Published courses, optionally for one topic, free certificates first. */
export function visibleFreeCourses(courses, topic = "") {
  const order = { free: 0, paid: 1, none: 2 };
  return courses
    .filter((c) => c.published === true && safeUrl(c.url))
    .filter((c) => !topic || (c.topics || []).includes(topic))
    .sort((a, b) => (order[a.certificate] ?? 3) - (order[b.certificate] ?? 3) || a.title.localeCompare(b.title));
}

// A starting list for admins, added as unpublished drafts so someone checks
// each one on the provider's site before learners see it.
export const STARTER_FREE_COURSES = [
  {
    title: "CS50x: Introduction to Computer Science", provider: "Harvard University (CS50)",
    url: "https://cs50.harvard.edu/x/", topics: ["coding"], certificate: "free", level: "beginner",
    description: "Harvard's famous intro to programming. CS50's own certificate is free; edX's verified certificate costs money.",
  },
  {
    title: "CS50P: Introduction to Programming with Python", provider: "Harvard University (CS50)",
    url: "https://cs50.harvard.edu/python/", topics: ["coding"], certificate: "free", level: "beginner",
    description: "Python from scratch. Free CS50 certificate for completing the problem sets and final project.",
  },
  {
    title: "CS50's Introduction to Artificial Intelligence with Python", provider: "Harvard University (CS50)",
    url: "https://cs50.harvard.edu/ai/", topics: ["data-ai", "coding"], certificate: "free", level: "intermediate",
    description: "Search, machine learning and neural networks. Best after CS50x or CS50P.",
  },
  {
    title: "freeCodeCamp certifications", provider: "freeCodeCamp",
    url: "https://www.freecodecamp.org/learn/", topics: ["coding"], certificate: "free", level: "beginner",
    description: "Web design, JavaScript, Python and more, each ending in a free certification.",
  },
  {
    title: "Introduction to Cybersecurity", provider: "Cisco Networking Academy",
    url: "https://www.netacad.com/", topics: ["it-support"], certificate: "free", level: "beginner",
    description: "Self-paced course with a free digital badge.",
  },
  {
    title: "Microsoft Learn training", provider: "Microsoft",
    url: "https://learn.microsoft.com/training/", topics: ["cloud", "data-ai", "it-support"], certificate: "paid", level: "beginner",
    description: "Free modules and learning paths. The official certification exams cost money.",
  },
  {
    title: "Khan Academy", provider: "Khan Academy",
    url: "https://www.khanacademy.org/", topics: ["maths-science"], certificate: "none", level: "beginner",
    description: "Free lessons in maths and science — good for catching up on school work. No certificates.",
  },
  {
    title: "Coursera courses (audit for free)", provider: "Coursera",
    url: "https://www.coursera.org/", topics: ["business", "data-ai", "digital-marketing"], certificate: "paid", level: "beginner",
    description: "Most courses can be audited for free; certificates cost money, with financial aid available on many.",
  },
];
