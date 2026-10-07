import { useState, useEffect, useCallback } from "react";
import { auth } from "../../firebase";
import { fetchInstitutionSettingsMap, saveInstitutionSettings, fetchFacultySettingsMap, saveFacultySettings, facultySettingsKey } from "../../utils/institutionStatus";

// Institution- and faculty-level application windows (open/close dates).
export default function useApplicationWindows(showToast) {
  // Institution application windows (open/close dates)
  const [institutionSettings, setInstitutionSettings] = useState({}); // { [institution]: { openDate, closeDate } }
  const [editingInstitutionDates, setEditingInstitutionDates] = useState(null); // institution name | null
  const [datesForm, setDatesForm] = useState({ openDate: "", closeDate: "" });

  // Faculty-level application windows (override the institution's window for
  // just that faculty; falls back to the institution's dates when unset)
  const [facultySettings, setFacultySettings] = useState({}); // { "institution|||faculty": { openDate, closeDate } }
  const [editingFacultyDates, setEditingFacultyDates] = useState(null); // { institution, faculty } | null
  const [facultyDatesForm, setFacultyDatesForm] = useState({ openDate: "", closeDate: "" });

  // ── Load institution application-window settings ─────────────────────────
  const loadInstitutionSettings = useCallback(() =>
    fetchInstitutionSettingsMap()
      .then(setInstitutionSettings)
      .catch((err) => showToast("Failed to load application windows: " + err.message, "error")),
  [showToast]);

  // ── Load faculty-level application-window settings ────────────────────────
  const loadFacultySettings = useCallback(() =>
    fetchFacultySettingsMap()
      .then(setFacultySettings)
      .catch((err) => showToast("Failed to load faculty application windows: " + err.message, "error")),
  [showToast]);

  useEffect(() => {
    loadInstitutionSettings();
    loadFacultySettings();
  }, [loadInstitutionSettings, loadFacultySettings]);

  // ── Institution application windows ──────────────────────────────────────
  const openInstitutionDatesEditor = (institution) => {
    const s = institutionSettings[institution] || {};
    setDatesForm({ openDate: s.openDate || "", closeDate: s.closeDate || "" });
    setEditingInstitutionDates(institution);
  };

  const handleSaveInstitutionDates = async () => {
    if (!editingInstitutionDates) return;
    try {
      await saveInstitutionSettings(editingInstitutionDates, datesForm, auth.currentUser?.email);
      setInstitutionSettings((prev) => ({
        ...prev,
        [editingInstitutionDates]: {
          openDate: datesForm.openDate || null,
          closeDate: datesForm.closeDate || null,
        },
      }));
      showToast(`Application window saved for ${editingInstitutionDates}`);
      setEditingInstitutionDates(null);
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleClearInstitutionDates = async () => {
    if (!editingInstitutionDates) return;
    try {
      await saveInstitutionSettings(editingInstitutionDates, { openDate: null, closeDate: null }, auth.currentUser?.email);
      setInstitutionSettings((prev) => ({ ...prev, [editingInstitutionDates]: { openDate: null, closeDate: null } }));
      showToast(`${editingInstitutionDates} is now always open (dates cleared)`);
      setEditingInstitutionDates(null);
    } catch (err) { showToast(err.message, "error"); }
  };

  // ── Faculty application windows ───────────────────────────────────────────
  const openFacultyDatesEditor = (institution, faculty) => {
    const key = facultySettingsKey(institution, faculty);
    const s = facultySettings[key] || {};
    setFacultyDatesForm({ openDate: s.openDate || "", closeDate: s.closeDate || "" });
    setEditingFacultyDates({ institution, faculty });
  };

  const handleSaveFacultyDates = async () => {
    if (!editingFacultyDates) return;
    const { institution, faculty } = editingFacultyDates;
    try {
      await saveFacultySettings(institution, faculty, facultyDatesForm, auth.currentUser?.email);
      setFacultySettings((prev) => ({
        ...prev,
        [facultySettingsKey(institution, faculty)]: {
          openDate: facultyDatesForm.openDate || null,
          closeDate: facultyDatesForm.closeDate || null,
        },
      }));
      showToast(`Application window saved for ${faculty}`);
      setEditingFacultyDates(null);
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleClearFacultyDates = async () => {
    if (!editingFacultyDates) return;
    const { institution, faculty } = editingFacultyDates;
    try {
      await saveFacultySettings(institution, faculty, { openDate: null, closeDate: null }, auth.currentUser?.email);
      setFacultySettings((prev) => ({
        ...prev,
        [facultySettingsKey(institution, faculty)]: { openDate: null, closeDate: null },
      }));
      showToast(`${faculty} now follows ${institution}'s own dates`);
      setEditingFacultyDates(null);
    } catch (err) { showToast(err.message, "error"); }
  };

  return {
    institutionSettings, editingInstitutionDates, setEditingInstitutionDates, datesForm,
    setDatesForm, facultySettings, editingFacultyDates, setEditingFacultyDates, facultyDatesForm,
    setFacultyDatesForm, openInstitutionDatesEditor, handleSaveInstitutionDates, handleClearInstitutionDates,
    openFacultyDatesEditor, handleSaveFacultyDates, handleClearFacultyDates,
  };
}
