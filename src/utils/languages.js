// South Africa's 11 official languages.
// Used to build the "Home Language" / "First Additional Language" subject
// options so courses can require "any second official language" without
// needing to enumerate every possible language combination.

export const OFFICIAL_LANGUAGES = [
  "English",
  "Afrikaans",
  "isiZulu",
  "isiXhosa",
  "Sepedi",
  "Sesotho",
  "Setswana",
  "siSwati",
  "Tshivenda",
  "Xitsonga",
  "isiNdebele",
];

// e.g. "English Home Language", "isiZulu Home Language", ...
export const HOME_LANGUAGE_SUBJECTS = OFFICIAL_LANGUAGES.map(
  (lang) => `${lang} Home Language`
);

// e.g. "English First Additional Language", ...
// A First Additional Language subject IS, by definition, a "second language"
// for NSC purposes — so "requires a second language" = "requires any one of
// these, at the chosen minimum mark".
export const FAL_SUBJECTS = OFFICIAL_LANGUAGES.map(
  (lang) => `${lang} First Additional Language`
);

export const ALL_LANGUAGE_SUBJECTS = [...HOME_LANGUAGE_SUBJECTS, ...FAL_SUBJECTS];