import { useEffect, useRef } from "react";

// Shared pieces for the admin directory tabs (free courses, opportunities).

export const inputClass =
  "w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500";

export function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-gray-300">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

/** Toggle buttons for picking several values from a list. */
export function ChipPicker({ legend, options, selected, onChange, hint }) {
  const toggle = (key) => onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-gray-300">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.key);
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                on ? "bg-purple-600 border-purple-500 text-white" : "bg-gray-800 border-gray-600 text-gray-300 hover:border-purple-500"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </fieldset>
  );
}

export function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-200">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-purple-500" />
      {label}
    </label>
  );
}

export function ErrorList({ errors }) {
  if (!errors.length) return null;
  return (
    <ul className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-xs text-red-300 list-disc list-inside space-y-0.5">
      {errors.map((e) => <li key={e}>{e}</li>)}
    </ul>
  );
}

/**
 * A modal delete confirmation: focus starts on Cancel, Tab stays inside,
 * Escape cancels, and focus returns to whatever opened it.
 */
export function ConfirmDeleteDialog({ title, name, onCancel, onConfirm }) {
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
    e.preventDefault();
    buttons[e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length].focus();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-text"
        onKeyDown={onKeyDown}
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 text-center space-y-4"
      >
        <p id="confirm-delete-title" className="text-lg font-bold text-red-400">{title}</p>
        <p id="confirm-delete-text" className="text-gray-400 text-sm">Remove <span className="text-white font-medium">"{name}"</span> permanently?</p>
        <div className="flex gap-3">
          <button ref={cancelRef} onClick={onCancel} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold transition">Delete</button>
        </div>
      </div>
    </div>
  );
}
