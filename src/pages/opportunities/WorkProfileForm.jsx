import { useState } from "react";
import { EDUCATION_LEVELS, PROVINCES } from "../../utils/opportunities";

const selectClass =
  "w-full p-2.5 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-600";

const YES_NO = [
  { field: "saCitizen", question: "Are you a South African citizen?" },
  { field: "unemployed", question: "Are you currently unemployed?" },
  { field: "hasDriversLicence", question: "Do you have a driver's licence?" },
  { field: "disability", question: "Do you live with a disability?" },
];

const toChoice = (v) => (v === true ? "yes" : v === false ? "no" : "");
const fromChoice = (v) => (v === "yes" ? true : v === "no" ? false : undefined);

// The questions learnerships and entry-level jobs usually ask. Every answer
// is optional, but a listing that asks something unanswered isn't shown.
export default function WorkProfileForm({ profile, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...profile });
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-sm font-medium text-gray-800 mb-1">Highest qualification you've completed</span>
          <select value={form.education || ""} onChange={(e) => set("education", e.target.value || undefined)} className={selectClass}>
            <option value="">Choose…</option>
            {EDUCATION_LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-800 mb-1">Province you live in</span>
          <select value={form.province || ""} onChange={(e) => set("province", e.target.value || undefined)} className={selectClass}>
            <option value="">Choose…</option>
            {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-800 mb-1">Date of birth</span>
          <input type="date" value={form.dateOfBirth || ""} onChange={(e) => set("dateOfBirth", e.target.value || undefined)} className={selectClass} />
        </label>
        {YES_NO.map(({ field, question }) => (
          <label key={field} className="block">
            <span className="block text-sm font-medium text-gray-800 mb-1">{question}</span>
            <select value={toChoice(form[field])} onChange={(e) => set(field, fromChoice(e.target.value))} className={selectClass}>
              <option value="">Choose…</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-600">
        Used only to check which listings you qualify for. We never share it with employers — you apply on their own site.
      </p>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition disabled:opacity-60">
          {saving ? "Saving…" : "Save my profile"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-gray-700 hover:underline px-2">Cancel</button>
        )}
      </div>
    </form>
  );
}
