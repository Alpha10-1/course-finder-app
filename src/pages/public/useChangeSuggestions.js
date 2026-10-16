import { useEffect, useState } from "react";
import { evaluateChange, rankChanges, swapCandidates } from "../../utils/subjectAdvisor";

// Each candidate change means re-checking the whole catalogue (~10 ms), and
// there are ~60 of them, so they're worked through a few at a time between
// frames instead of freezing the page on a slow phone.
const PER_TICK = 3;

/**
 * The single subject changes that would open the most courses.
 * `key` identifies the current choices + mark; work restarts when it changes.
 */
export default function useChangeSuggestions(courses, choices, mark, openNow, key) {
  const [done, setDone] = useState({ key: null, suggestions: [] });

  useEffect(() => {
    let cancelled = false;
    let timer;
    const candidates = swapCandidates(courses, choices);
    const results = [];
    let i = 0;
    const step = () => {
      if (cancelled) return;
      const end = Math.min(i + PER_TICK, candidates.length);
      for (; i < end; i += 1) results.push(evaluateChange(courses, choices, mark, candidates[i], openNow));
      if (i < candidates.length) timer = setTimeout(step, 0);
      else setDone({ key, suggestions: rankChanges(results) });
    };
    timer = setTimeout(step, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [courses, choices, mark, openNow, key]);

  return done.key === key ? { loading: false, suggestions: done.suggestions } : { loading: true, suggestions: [] };
}
