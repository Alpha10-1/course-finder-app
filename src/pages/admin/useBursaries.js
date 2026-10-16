import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, addDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { BLANK_BURSARY, validateBursary } from "../../utils/bursaries";

// Bursary directory (Firestore `bursaries` collection): list, add, edit, delete.
export default function useBursaries(showToast) {
  const [bursaries, setBursaries] = useState([]);
  const [loadingBursaries, setLoadingBursaries] = useState(true);
  const [editingBursary, setEditingBursary] = useState(null); // form values, with `id` when editing
  const [bursaryErrors, setBursaryErrors] = useState([]);
  const [confirmDeleteBursary, setConfirmDeleteBursary] = useState(null);

  // Same fetch/load split as the other admin hooks: state is only set from
  // promise callbacks, so the initial-load effect never sets it synchronously.
  const fetchBursaries = useCallback(() =>
    getDocs(collection(db, "bursaries"))
      .then((snap) => setBursaries(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      ))
      .catch((err) => showToast("Failed to load bursaries: " + err.message, "error"))
      .finally(() => setLoadingBursaries(false)),
  [showToast]);

  useEffect(() => { fetchBursaries(); }, [fetchBursaries]);

  const startAddBursary = () => {
    setBursaryErrors([]);
    setEditingBursary({ ...BLANK_BURSARY });
  };

  const startEditBursary = (bursary) => {
    setBursaryErrors([]);
    setEditingBursary({ ...BLANK_BURSARY, ...bursary, closeDate: bursary.closeDate || "" });
  };

  const cancelEditBursary = () => {
    setBursaryErrors([]);
    setEditingBursary(null);
  };

  const handleSaveBursary = async () => {
    if (!editingBursary) return;
    const { errors, bursary } = validateBursary(editingBursary);
    setBursaryErrors(errors);
    if (errors.length) return;

    const record = {
      ...bursary,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.email || "unknown",
    };
    try {
      if (editingBursary.id) {
        await setDoc(doc(db, "bursaries", editingBursary.id), record);
        setBursaries((prev) => prev.map((b) => (b.id === editingBursary.id ? { id: b.id, ...record } : b)));
        showToast(`Saved ${record.name}`);
      } else {
        const ref = await addDoc(collection(db, "bursaries"), record);
        setBursaries((prev) => [...prev, { id: ref.id, ...record }].sort((a, b) => a.name.localeCompare(b.name)));
        showToast(`Added ${record.name}`);
      }
      setEditingBursary(null);
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleDeleteBursary = async (bursary) => {
    try {
      await deleteDoc(doc(db, "bursaries", bursary.id));
      setBursaries((prev) => prev.filter((b) => b.id !== bursary.id));
      showToast(`Deleted ${bursary.name}`);
    } catch (err) { showToast(err.message, "error"); }
    setConfirmDeleteBursary(null);
  };

  return {
    bursaries, loadingBursaries, editingBursary, setEditingBursary, bursaryErrors,
    confirmDeleteBursary, setConfirmDeleteBursary, startAddBursary, startEditBursary,
    cancelEditBursary, handleSaveBursary, handleDeleteBursary,
  };
}
