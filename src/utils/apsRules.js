export const apsRules = {
  "University of Johannesburg": (subjects) => {
    let total = 0;
    subjects.forEach(({ subject, aps }) => {
      if (subject === "Life Orientation") {
        total += Math.min(aps, 3);
      } else {
        total += aps;
      }
    });
    return total;
  },

  "University of Pretoria": (subjects) => {
    let total = 0;
    subjects.forEach(({ subject, aps }) => {
      if (subject !== "Life Orientation") {
        total += aps;
      }
    });
    return total;
  },

  "University of Witwatersrand": (subjects) => {
    let total = 0;
    let loScore = 0;
    let sorted = [...subjects].sort((a, b) => b.aps - a.aps);
    sorted.slice(0, 6).forEach(({ aps }) => (total += aps));
    const lo = subjects.find((s) => s.subject === "Life Orientation");
    loScore = lo ? Math.min(lo.aps, 1) : 0;
    return total + loScore;
  },

  "Tshwane University of Technology": (subjects) => {
    let total = 0;
    subjects.forEach(({ aps }) => {
      total += aps;
    });
    return total;
  },

  "Unisa": (subjects) => {
    let total = 0;
    subjects.forEach(({ aps }) => {
      total += aps;
    });
    return total;
  },
};

export const calculateAPSForUniversity = (university, subjects) => {
  const rule = apsRules[university];
  if (!rule) {
    console.warn(`No APS rule for ${university}, using UJ default.`);
    return apsRules["University of Johannesburg"](subjects);
  }
  return rule(subjects);
};