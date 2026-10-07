import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, addDoc, getDoc, arrayUnion, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import { expandCollegeCourse } from "../../utils/collegeCourses";
import { BLANK_COURSE } from "./constants";
import { courseDedupeKey, buildCourseDiff } from "./helpers";
import { SEED_EXCLUSIONS_DOC, getSeedExclusions, addSeedExclusion, removeSeedExclusion } from "./seedExclusions";

// Firestore batched writes are capped at 500 operations each; chunk to stay
// safely under that regardless of how large courses.json grows.
const SEED_BATCH_LIMIT = 400;

// Shared add-or-replace logic for both seed buttons below.
//
// Behavior: for every course in the local JSON, look it up in Firestore by
// dedupeKey (courseName + institution + campus + faculty + qualificationCode).
//   - No match, not tombstoned  -> ADD as a new doc.
//   - Match found               -> REPLACE the existing doc's fields with
//                                   the JSON version (this is what makes
//                                   editing a course in courses.json and
//                                   re-seeding actually push the fix live,
//                                   instead of the old behavior of treating
//                                   any dedupe-key match as "already seeded"
//                                   and silently skipping it forever).
//   - Tombstoned (previously
//     deleted via the admin panel) -> always skipped, regardless of match,
//                                      so intentional deletions don't come back.
// If the same dedupeKey matches more than one existing doc (a leftover from
// before this dedupe key included qualificationCode), all of them are
// updated to the same JSON data rather than picking one arbitrarily.
async function seedCoursesInto(localCourses) {
  const [snap, excluded] = await Promise.all([
    getDocs(collection(db, "courses")),
    getSeedExclusions(),
  ]);

  const existingByKey = new Map(); // dedupeKey -> [docId, ...]
  for (const d of snap.docs) {
    const key = courseDedupeKey(d.data());
    if (!existingByKey.has(key)) existingByKey.set(key, []);
    existingByKey.get(key).push(d.id);
  }

  let added = 0, updated = 0, skippedExcluded = 0;
  const ops = [];

  for (const course of localCourses) {
    const key = courseDedupeKey(course);
    if (excluded.has(key)) { skippedExcluded++; continue; }

    const existingIds = existingByKey.get(key);
    if (existingIds && existingIds.length > 0) {
      for (const id of existingIds) {
        ops.push({ ref: doc(db, "courses", id), data: course });
        updated++;
      }
    } else {
      ops.push({ ref: doc(collection(db, "courses")), data: course });
      added++;
    }
  }

  for (let i = 0; i < ops.length; i += SEED_BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + SEED_BATCH_LIMIT)) {
      batch.set(op.ref, op.data);
    }
    await batch.commit();
  }

  return { added, updated, skippedExcluded };
}

// Courses tab state and actions: catalog CRUD, seeding from the bundled
// JSON, bulk delete and the APS search view.
export default function useAdminCourses(showToast, audit) {
  // Course filters
  const [filterFaculty, setFilterFaculty] = useState("");
  const [filterInstitution, setFilterInstitution] = useState("");
  const [filterQualType, setFilterQualType] = useState("");
  const [filterMinAPS, setFilterMinAPS] = useState("");
  const [filterMaxAPS, setFilterMaxAPS] = useState("");

  // Courses state — Firestore
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseSearch, setCourseSearch] = useState("");
  const [editingCourse, setEditingCourse] = useState(null); // null | course obj with id
  const [addingCourse, setAddingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState(BLANK_COURSE);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(null);
  const [seedExclusions, setSeedExclusions] = useState([]);
  const [showSeedExclusions, setShowSeedExclusions] = useState(false);
  const [selectedVarsity, setSelectedVarsity] = useState(null); // null = show varsity grid, else show that varsity's courses

  // Which faculty groups are collapsed in the single-varsity view (by
  // "institution|||faculty" key). Absent from the set = expanded (default).
  const [collapsedFacultyGroups, setCollapsedFacultyGroups] = useState(new Set());
  const toggleFacultyGroupCollapsed = (key) => {
    setCollapsedFacultyGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Bulk delete mode
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState(() => new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // APS search mode — cross-institution course search/filter by APS range
  const [apsSearchMode, setApsSearchMode] = useState(false);
  const [apsSortDir, setApsSortDir] = useState("asc"); // "asc" | "desc"

  // ── Load Firestore courses ───────────────────────────────────────────────
  // Same fetch/load split as useAdminUsers: fetchCourses only sets state from
  // promise callbacks; loadCourses is the refresh that also flips loading.
  const fetchCourses = useCallback(() =>
    getDocs(collection(db, "courses"))
      .then((snap) => {
        if (snap.empty) {
          // First run: seed from local JSON
          showToast("No courses in Firestore yet. Seed from local JSON first.", "error");
          setCourses([]);
        } else {
          setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      })
      .catch((err) => showToast("Failed to load courses: " + err.message, "error"))
      .finally(() => setLoadingCourses(false)),
  [showToast]);

  const loadCourses = useCallback(() => {
    setLoadingCourses(true);
    return fetchCourses();
  }, [fetchCourses]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const { writeAuditLog, loadAuditLogs } = audit;

  const handleSeedCourses = async () => {
    try {
      showToast("Syncing courses from courses.json…");
      const { default: localCourses } = await import("../../data/courses.json");
      const { added, updated, skippedExcluded } = await seedCoursesInto(localCourses);

      if (added === 0 && updated === 0) {
        showToast("✓ No changes — Firestore is already up to date.");
        return;
      }

      const parts = [];
      if (added) parts.push(`${added} added`);
      if (updated) parts.push(`${updated} updated`);
      if (skippedExcluded) parts.push(`${skippedExcluded} skipped (previously deleted)`);
      showToast(`✓ Sync complete — ${parts.join(", ")}.`);
      loadCourses();
    } catch (err) {
      showToast("Seed failed: " + err.message, "error");
    }
  };

  const handleSeedCollegeCourses = async () => {
    try {
      showToast("Syncing college courses from college-courses.json…");
      const { default: localCollegeCourses } = await import("../../data/college-courses.json");
      const expanded = localCollegeCourses.flatMap(expandCollegeCourse);
      const { added, updated, skippedExcluded } = await seedCoursesInto(expanded);

      if (added === 0 && updated === 0) {
        showToast("✓ No changes — Firestore is already up to date.");
        return;
      }

      const parts = [];
      if (added) parts.push(`${added} added`);
      if (updated) parts.push(`${updated} updated`);
      if (skippedExcluded) parts.push(`${skippedExcluded} skipped (previously deleted)`);
      showToast(`✓ Sync complete — ${parts.join(", ")}.`);
      loadCourses();
    } catch (err) {
      showToast("Seed failed: " + err.message, "error");
    }
  };

  const handleSaveCourse = async () => {
    try {
      const { id, ...data } = editingCourse;
      const original = courses.find((c) => c.id === id) || {};
      const diff = buildCourseDiff(original, data);

      await updateDoc(doc(db, "courses", id), data);
      setCourses((prev) => prev.map((c) => c.id === id ? { id, ...data } : c));

      if (Object.keys(diff).length > 0) {
        await writeAuditLog("edit", { id, ...data }, diff);
        loadAuditLogs();
      }

      setEditingCourse(null);
      showToast("Course updated");
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleAddCourse = async () => {
    try {
      const ref = await addDoc(collection(db, "courses"), newCourse);
      const created = { id: ref.id, ...newCourse };
      setCourses((prev) => [...prev, created]);
      await writeAuditLog("add", created, null);
      loadAuditLogs();
      setNewCourse(BLANK_COURSE);
      setAddingCourse(false);
      showToast("Course added");
    } catch (err) { showToast(err.message, "error"); }
  };

  const loadSeedExclusions = async () => {
    const snap = await getDoc(SEED_EXCLUSIONS_DOC);
    setSeedExclusions(snap.exists() ? snap.data().keys || [] : []);
  };

  const handleRestoreSeedExclusion = async (key) => {
    try {
      await removeSeedExclusion(key);
      setSeedExclusions((prev) => prev.filter((k) => k !== key));
      showToast("Restored — it'll be re-added next time you seed.");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteCourse = async (id, name) => {
    try {
      const deletedCourse = courses.find((c) => c.id === id) || { id, courseName: name };
      await deleteDoc(doc(db, "courses", id));
      await addSeedExclusion(courseDedupeKey(deletedCourse));
      setCourses((prev) => prev.filter((c) => c.id !== id));
      await writeAuditLog("delete", deletedCourse, null);
      loadAuditLogs();
      setConfirmDeleteCourse(null);
      showToast(`"${name}" deleted`);
    } catch (err) { showToast(err.message, "error"); }
  };

  // ── Bulk delete ───────────────────────────────────────────────────────────
  const toggleBulkSelected = (id) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllBulkMatches = (matches) => setBulkSelectedIds(new Set(matches.map((c) => c.id)));
  const clearBulkSelection = () => setBulkSelectedIds(new Set());

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const toDelete = courses.filter((c) => bulkSelectedIds.has(c.id));

      // Delete the Firestore docs in batches (500-op cap per batch).
      for (let i = 0; i < toDelete.length; i += SEED_BATCH_LIMIT) {
        const batch = writeBatch(db);
        for (const c of toDelete.slice(i, i + SEED_BATCH_LIMIT)) {
          batch.delete(doc(db, "courses", c.id));
        }
        await batch.commit();
      }

      // Tombstone all of them in one write so re-seeding from courses.json
      // doesn't silently bring any of them back.
      const keys = toDelete.map((c) => courseDedupeKey(c));
      if (keys.length > 0) {
        await setDoc(SEED_EXCLUSIONS_DOC, { keys: arrayUnion(...keys) }, { merge: true });
      }

      // One audit log entry per deleted course, same as a single delete.
      await Promise.all(toDelete.map((c) => writeAuditLog("delete", c, null)));

      setCourses((prev) => prev.filter((c) => !bulkSelectedIds.has(c.id)));
      setBulkSelectedIds(new Set());
      setConfirmBulkDelete(false);
      setBulkMode(false);
      showToast(`Deleted ${toDelete.length} course(s)`);
      loadAuditLogs();
      loadSeedExclusions();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  const filteredCourses = courses.filter((c) => {
    const matchSearch = !courseSearch ||
      c.courseName?.toLowerCase().includes(courseSearch.toLowerCase()) ||
      c.institution?.toLowerCase().includes(courseSearch.toLowerCase());
    const matchFaculty = !filterFaculty || c.faculty === filterFaculty;
    const matchInstitution = !filterInstitution || c.institution === filterInstitution;
    const matchQualType = !filterQualType || c.qualificationType === filterQualType;
    const matchMinAPS = !filterMinAPS || c.minAPS >= Number(filterMinAPS);
    const matchMaxAPS = !filterMaxAPS || c.minAPS <= Number(filterMaxAPS);
    return matchSearch && matchFaculty && matchInstitution && matchQualType && matchMinAPS && matchMaxAPS;
  });

  return {
    filterFaculty, setFilterFaculty, filterInstitution, setFilterInstitution, filterQualType,
    setFilterQualType, filterMinAPS, setFilterMinAPS, filterMaxAPS, setFilterMaxAPS, courses,
    loadingCourses, courseSearch, setCourseSearch, editingCourse, setEditingCourse, addingCourse,
    setAddingCourse, newCourse, setNewCourse, confirmDeleteCourse, setConfirmDeleteCourse,
    seedExclusions, showSeedExclusions, setShowSeedExclusions, selectedVarsity, setSelectedVarsity,
    collapsedFacultyGroups, bulkMode, setBulkMode, bulkSelectedIds, confirmBulkDelete,
    setConfirmBulkDelete, bulkDeleting, apsSearchMode, setApsSearchMode, apsSortDir, setApsSortDir,
    toggleFacultyGroupCollapsed, loadCourses, handleSeedCourses, handleSeedCollegeCourses,
    handleSaveCourse, handleAddCourse, loadSeedExclusions, handleRestoreSeedExclusion,
    handleDeleteCourse, toggleBulkSelected, selectAllBulkMatches, clearBulkSelection, handleBulkDelete,
    filteredCourses,
  };
}
