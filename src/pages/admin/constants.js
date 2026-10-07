import { HOME_LANGUAGE_SUBJECTS, FAL_SUBJECTS } from "../../utils/languages";

export const ALL_TABS = ["Dashboard", "Quick Check", "Users", "Courses", "Audit Log", "Settings"];

export const INSTITUTIONS = [
  "University of the Witwatersrand",
  "University of Johannesburg",
  "University of Pretoria",
  "Stellenbosch University",
  "University of Cape Town",
  "University of KwaZulu-Natal",
  "University of the Free State",
  "North-West University",
  "University of Limpopo",
  "University of Zululand",
  "University of South Africa",
  "University of the Western Cape",
  "Nelson Mandela University",
  "Rhodes University",
  "Walter Sisulu University",
  "Tshwane University of Technology",
  "Durban University of Technology",
  "Central University of Technology",
  "Cape Peninsula University of Technology",
  "Vaal University of Technology",
  "Mangosuthu University of Technology",
  "University of Venda",
  "University of Fort Hare",
  "University of Mpumalanga",
  "Sefako Makgatho Health Sciences University",
  "Sol Plaatje University",
];

// Common college qualification types (TVET / private colleges)
export const COLLEGE_QUAL_TYPES = [
  "N4 Certificate", "N5 Certificate", "N6 Certificate",
  "NCV Level 2", "NCV Level 3", "NCV Level 4",
  "National Certificate (Vocational)",
  "Higher Certificate", "Diploma", "Occupational Certificate",
];

export const UNI_QUAL_TYPES = ["Bachelor", "Bachelor (Extended)", "Diploma", "Extended Diploma", "Higher Certificate"];

// Master subject list — used for all subject dropdowns in the admin panel
export const SUBJECT_OPTIONS = [
  "Accounting",
  "Agricultural Sciences", "Business Studies", "CAT (Computer Applications Technology)",
  "Civil Technology", "Computer Literacy", "Consumer Studies", "Dramatic Arts",
  "Economics", "Electrical Technology", "Engineering Graphics and Design",
  "Geography",
  "History", "Hospitality Studies", "IT (Information Technology)", "Life Orientation",
  "Life Sciences", "Mathematical Literacy", "Mathematics", "Technical Mathematics",
  "Mechanical Technology", "Music", "Physical Sciences", "Religion Studies",
  "Tourism", "Visual Arts",
  // All 11 official languages, as Home Language and First Additional Language
  ...HOME_LANGUAGE_SUBJECTS,
  ...FAL_SUBJECTS,
].sort();

export const BLANK_COURSE = {
  courseName: "", institution: INSTITUTIONS[0], institutionType: "university", faculty: "",
  campus: "",                // college-only, optional — e.g. "Boksburg Campus". `institution` stays
                               // the college itself (e.g. "Ekurhuleni East TVET College"); campus is
                               // the specific site offering this particular course.
  duration: "", qualificationType: "Bachelor", minAPS: 0, keySubjects: [],
  admissionRequirement: "", // free-text description shown to users
  minGrade: null,           // "Grade 9" | "Grade 10" | "Grade 11" | "Grade 12" | null — colleges only
  minNQFLevel: null,        // 1 | 2 | 3 | 4 | null — colleges only
  apsAlternatives: [],      // [{ subject: "Mathematical Literacy", minAPS: 34 }] — alternate minAPS
                             // that applies instead of minAPS when the learner took that subject
                             // (e.g. Maths vs Maths Lit courses with different cutoffs)
  curriculum: null,         // college-only, optional — { fundamentalSubjects: [], vocationalSubjects: [] }
                             // describes the qualification's subject structure (e.g. NC(V) programmes).
                             // This is DISPLAY-ONLY and is never used for eligibility matching — see
                             // minGrade/minNQFLevel above for the actual admission gate.
};
