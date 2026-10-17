import { useEffect, useRef } from "react";
import { STUDY_FIELDS, studyFieldLabel, saToday } from "../../utils/bursaries";

const inputClass =
  "w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500";

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-gray-300">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

// Rendered with a key per bursary, so opening it (Add, or Edit on any card)
// always mounts it afresh: focus moves to the first field, which also
// scrolls the form into view when it opens above a card lower down the list.
function BursaryForm({ form, setForm, errors, saving, onSave, onCancel }) {
  const nameRef = useRef(null);
  useEffect(() => { nameRef.current?.focus(); }, []);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const toggleField = (key) => {
    const fields = form.fields.includes(key) ? form.fields.filter((f) => f !== key) : [...form.fields, key];
    setForm({ ...form, fields });
  };

  return (
    <div className="bg-gray-900 border border-purple-800 rounded-2xl p-5 space-y-4">
      <p className="font-semibold text-white">{form.id ? `Edit ${form.name || "bursary"}` : "Add a bursary"}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Bursary name">
          <input ref={nameRef} value={form.name} onChange={set("name")} placeholder="e.g. Funza Lushaka Bursary" className={inputClass} />
        </Field>
        <Field label="Offered by">
          <input value={form.provider} onChange={set("provider")} placeholder="Company, department or institution" className={inputClass} />
        </Field>
        <Field label="Closing date" hint="Leave empty if it's open all year or the date isn't published yet.">
          <input type="date" value={form.closeDate} onChange={set("closeDate")} className={inputClass} />
        </Field>
        <Field label="For the academic year" hint="Optional, e.g. 2027.">
          <input value={form.academicYear} onChange={set("academicYear")} placeholder="2027" className={inputClass} />
        </Field>
      </div>
      <Field label="Official link" hint="Where learners apply or read the provider's own details.">
        <input value={form.applyUrl} onChange={set("applyUrl")} placeholder="https://" className={inputClass} />
      </Field>
      <Field label="What it covers" hint="Optional, e.g. tuition, residence, books and a monthly allowance.">
        <input value={form.covers} onChange={set("covers")} className={inputClass} />
      </Field>
      <Field label="Who can apply" hint="Optional: marks, citizenship, work-back requirements and so on.">
        <textarea value={form.description} onChange={set("description")} rows={3} className={inputClass} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-gray-300">Fields of study it funds</legend>
        <div className="flex flex-wrap gap-2">
          {STUDY_FIELDS.map((f) => {
            const on = form.fields.includes(f.key);
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleField(f.key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                  on ? "bg-purple-600 border-purple-500 text-white" : "bg-gray-800 border-gray-600 text-gray-300 hover:border-purple-500"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400">
          Learners see a bursary when they qualify for at least one course in one of these fields.
        </p>
      </fieldset>

      {errors.length > 0 && (
        <ul className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-xs text-red-300 list-disc list-inside space-y-0.5">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="flex gap-3">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
        <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-semibold transition disabled:opacity-60">
          {saving ? "Saving…" : "Save bursary"}
        </button>
      </div>
    </div>
  );
}

// The delete confirmation, as a proper modal dialog: focus starts on Cancel,
// Tab stays inside, Escape cancels, and focus goes back to the card's Delete
// button afterwards.
function ConfirmDeleteDialog({ bursary, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    cancelRef.current?.focus();
    return () => { if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, []);
  const onKeyDown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onCancel(); return; }
    if (e.key !== "Tab") return;
    const buttons = [...dialogRef.current.querySelectorAll("button")];
    const i = buttons.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length;
    e.preventDefault();
    buttons[next].focus();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-bursary-title"
        aria-describedby="delete-bursary-text"
        onKeyDown={onKeyDown}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 text-center space-y-4"
      >
        <p id="delete-bursary-title" className="text-lg font-bold text-red-400">Delete bursary?</p>
        <p id="delete-bursary-text" className="text-gray-400 text-sm">Remove <span className="text-white font-medium">"{bursary.name}"</span> permanently?</p>
        <div className="flex gap-3">
          <button ref={cancelRef} onClick={onCancel} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold transition">Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function BursariesTab({ admin }) {
  const {
    bursaries, loadingBursaries, editingBursary, setEditingBursary, bursaryErrors, savingBursary,
    confirmDeleteBursary, setConfirmDeleteBursary, startAddBursary, startEditBursary,
    cancelEditBursary, handleSaveBursary, handleDeleteBursary,
  } = admin;
  const today = saToday();
  const closedCount = bursaries.filter((b) => b.closeDate && b.closeDate < today).length;

  return (
    <div className="space-y-6">
      {confirmDeleteBursary && (
        <ConfirmDeleteDialog
          bursary={confirmDeleteBursary}
          onCancel={() => setConfirmDeleteBursary(null)}
          onConfirm={() => handleDeleteBursary(confirmDeleteBursary)}
        />
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Bursaries</h2>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Learners see these on their results page, under "Can I get funding to study?", when they qualify for a
            course in a matching field. Bursaries whose closing date has passed are hidden from learners
            automatically. Check each one against the provider's own website every year.
          </p>
        </div>
        {!editingBursary && (
          <button onClick={startAddBursary} className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition font-medium">
            + Add bursary
          </button>
        )}
      </div>

      {editingBursary && (
        <BursaryForm
          key={editingBursary.id || "new"}
          form={editingBursary}
          setForm={setEditingBursary}
          errors={bursaryErrors}
          saving={savingBursary}
          onSave={handleSaveBursary}
          onCancel={cancelEditBursary}
        />
      )}

      {closedCount > 0 && (
        <p className="text-xs text-amber-300 bg-amber-950/50 border border-amber-900 rounded-xl px-4 py-2">
          {closedCount} {closedCount === 1 ? "bursary has" : "bursaries have"} a closing date in the past. Update the date
          for the new cycle, or delete {closedCount === 1 ? "it" : "them"}.
        </p>
      )}

      {loadingBursaries ? (
        <p className="text-gray-500 text-sm">Loading bursaries…</p>
      ) : bursaries.length === 0 ? (
        <p className="text-gray-500 text-sm">No bursaries yet. Learners won't see a bursary list until you add one.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {bursaries.map((b) => {
            const closed = b.closeDate && b.closeDate < today;
            return (
              <div key={b.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{b.name}</p>
                    <p className="text-xs text-gray-400">{b.provider}{b.academicYear && ` · ${b.academicYear}`}</p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
                    closed ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"
                  }`}>
                    {b.closeDate ? `${closed ? "Closed" : "Closes"} ${b.closeDate}` : "No closing date"}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{(b.fields || []).map(studyFieldLabel).join(" · ")}</p>
                <div className="flex gap-3 text-xs">
                  <a href={b.applyUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Official link ↗</a>
                  <button onClick={() => startEditBursary(b)} className="text-gray-300 hover:text-white">Edit</button>
                  <button onClick={() => setConfirmDeleteBursary(b)} className="text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
