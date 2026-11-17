import { useState, useEffect, useCallback, useRef } from "react";
import { collection, getDocs, doc, addDoc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db, auth } from "../../firebase";

/**
 * List / add / edit / delete for a simple admin-maintained Firestore
 * collection (free courses, opportunities). `validate(form)` returns
 * `{ errors, [recordKey]: cleanRecord }`; `nameOf(record)` labels toasts.
 */
export default function useAdminCollection({ name, blank, validate, recordKey, nameOf, showToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // form values, with `id` when editing
  const [errors, setErrors] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // blocks a double click before the re-render

  const sortItems = useCallback((list) => [...list].sort((a, b) => nameOf(a).localeCompare(nameOf(b))), [nameOf]);

  // State is only set from promise callbacks (eslint set-state-in-effect).
  const fetchItems = useCallback(() =>
    getDocs(collection(db, name))
      .then((snap) => setItems(sortItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))))
      .catch((err) => showToast(`Failed to load ${name}: ${err.message}`, "error"))
      .finally(() => setLoading(false)),
  [name, showToast, sortItems]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const startAdd = () => { setErrors([]); setEditing({ ...blank }); };
  const startEdit = (item) => { setErrors([]); setEditing({ ...blank, ...item }); };
  const cancelEdit = () => { setErrors([]); setEditing(null); };

  const stamp = (record) => ({ ...record, updatedAt: new Date().toISOString(), updatedBy: auth.currentUser?.email || "unknown" });

  const save = async () => {
    if (!editing || savingRef.current) return;
    const result = validate(editing);
    setErrors(result.errors);
    if (result.errors.length) return;
    savingRef.current = true;
    setSaving(true);
    const record = stamp(result[recordKey]);
    try {
      if (editing.id) {
        await setDoc(doc(db, name, editing.id), record);
        setItems((prev) => sortItems(prev.map((x) => (x.id === editing.id ? { id: x.id, ...record } : x))));
        showToast(`Saved ${nameOf(record)}`);
      } else {
        const ref = await addDoc(collection(db, name), record);
        setItems((prev) => sortItems([...prev, { id: ref.id, ...record }]));
        showToast(`Added ${nameOf(record)}`);
      }
      setEditing(null);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const remove = async (item) => {
    try {
      await deleteDoc(doc(db, name, item.id));
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      if (editing?.id === item.id) cancelEdit();
      showToast(`Deleted ${nameOf(item)}`);
    } catch (err) { showToast(err.message, "error"); }
    setConfirmDelete(null);
  };

  /** Adds several records at once (e.g. a starter list), as given. */
  const addMany = async (records) => {
    try {
      const batch = writeBatch(db);
      const added = records.map((r) => {
        const ref = doc(collection(db, name));
        const record = stamp(r);
        batch.set(ref, record);
        return { id: ref.id, ...record };
      });
      await batch.commit();
      setItems((prev) => sortItems([...prev, ...added]));
      showToast(`Added ${added.length} drafts`);
    } catch (err) { showToast(err.message, "error"); }
  };

  return {
    items, loading, editing, setEditing, errors, saving, confirmDelete, setConfirmDelete,
    startAdd, startEdit, cancelEdit, save, remove, addMany,
  };
}
