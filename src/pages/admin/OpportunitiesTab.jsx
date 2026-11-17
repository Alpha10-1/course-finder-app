import { NSC_SUBJECTS } from "../../utils/nscSubjects";
import { saToday } from "../../utils/saDate";
import {
  EDUCATION_LEVELS, OPPORTUNITY_TYPES, PROVINCES, educationLabel, typeLabel,
} from "../../utils/opportunities";
import { Checkbox, ChipPicker, ConfirmDeleteDialog, ErrorList, Field, inputClass } from "./formParts";
import useFocusOnMount from "./useFocusOnMount";

const PROVINCE_OPTIONS = PROVINCES.map((p) => ({ key: p, label: p }));
const MATRIC_SUBJECTS = NSC_SUBJECTS.filter((s) => s !== "Life Orientation");

function SubjectRequirements({ rows, onChange }) {
  const update = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-gray-300">Matric subjects required</legend>
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select
            aria-label={`Required subject ${i + 1}`}
            value={r.subject}
            onChange={(e) => update(i, { subject: e.target.value })}
            className={inputClass}
          >
            <option value="">Choose a subject…</option>
            <option value="English">English (Home or First Additional)</option>
            {MATRIC_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            aria-label={`Minimum mark for required subject ${i + 1}`}
            type="number" min="0" max="100" value={r.minMark}
            onChange={(e) => update(i, { minMark: e.target.value })}
            className={`${inputClass} w-24`}
          />
          <span className="text-xs text-gray-400">%</span>
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="text-xs text-red-400 hover:text-red-300">
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { subject: "", minMark: 50 }])} className="text-xs text-purple-400 hover:text-purple-300">
        + Add a subject requirement
      </button>
    </fieldset>
  );
}

function OpportunityForm({ form, setForm, errors, saving, onSave, onCancel }) {
  const firstRef = useFocusOnMount();
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const flag = (field) => (value) => setForm({ ...form, [field]: value });
  return (
    <div className="bg-gray-900 border border-purple-800 rounded-2xl p-5 space-y-5">
      <p className="font-semibold text-white">{form.id ? `Edit ${form.title || "listing"}` : "Add a learnership or job"}</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Title">
          <input ref={firstRef} value={form.title} onChange={set("title")} placeholder="e.g. Wholesale & Retail Learnership" className={inputClass} />
        </Field>
        <Field label="Organisation">
          <input value={form.organisation} onChange={set("organisation")} className={inputClass} />
        </Field>
        <Field label="Type">
          <select value={form.type} onChange={set("type")} className={inputClass}>
            {OPPORTUNITY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Closing date" hint="Leave empty if there's no closing date.">
          <input type="date" value={form.closeDate || ""} onChange={set("closeDate")} className={inputClass} />
        </Field>
        <Field label="Official application link">
          <input value={form.applyUrl} onChange={set("applyUrl")} placeholder="https://" className={inputClass} />
        </Field>
        <Field label="Where you verified it" hint="Shown to learners, e.g. 'Company careers page' or 'W&R SETA'.">
          <input value={form.source} onChange={set("source")} className={inputClass} />
        </Field>
        <Field label="Stipend or salary" hint="Optional, e.g. R4,500 a month.">
          <input value={form.stipend} onChange={set("stipend")} className={inputClass} />
        </Field>
      </div>
      <Field label="Description">
        <textarea value={form.description} onChange={set("description")} rows={3} className={inputClass} />
      </Field>

      <div className="border-t border-gray-800 pt-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-white">Requirements</p>
          <p className="text-[11px] text-gray-400">
            Learners only see this listing if they meet every requirement here. Leave a requirement empty if it
            doesn't apply. Anything else goes under "Other requirements" — learners are told to check those themselves.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Minimum education">
            <select value={form.minEducation} onChange={set("minEducation")} className={inputClass}>
              <option value="">No minimum</option>
              {EDUCATION_LEVELS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
          </Field>
          <Field label="Minimum age">
            <input type="number" value={form.ageMin ?? ""} onChange={set("ageMin")} className={inputClass} />
          </Field>
          <Field label="Maximum age">
            <input type="number" value={form.ageMax ?? ""} onChange={set("ageMax")} className={inputClass} />
          </Field>
        </div>
        <SubjectRequirements rows={form.requiredSubjects || []} onChange={(requiredSubjects) => setForm({ ...form, requiredSubjects })} />
        <ChipPicker
          legend="Must live in"
          hint="Leave all off if anyone in South Africa can apply."
          options={PROVINCE_OPTIONS}
          selected={form.provinces || []}
          onChange={(provinces) => setForm({ ...form, provinces })}
        />
        <div className="grid sm:grid-cols-2 gap-2">
          <Checkbox label="South African citizens only" checked={form.saCitizenOnly === true} onChange={flag("saCitizenOnly")} />
          <Checkbox label="Needs a driver's licence" checked={form.driversLicence === true} onChange={flag("driversLicence")} />
          <Checkbox label="Unemployed applicants only" checked={form.unemployedOnly === true} onChange={flag("unemployedOnly")} />
          <Checkbox label="For people with a disability" checked={form.disabilityOnly === true} onChange={flag("disabilityOnly")} />
        </div>
        <Field label="Other requirements" hint="Shown to learners, not checked by the app.">
          <textarea value={form.otherRequirements} onChange={set("otherRequirements")} rows={2} className={inputClass} />
        </Field>
      </div>

      <Checkbox label="Published — learners can see it" checked={form.published === true} onChange={flag("published")} />
      <ErrorList errors={errors} />
      <div className="flex gap-3">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
        <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-semibold transition disabled:opacity-60">
          {saving ? "Saving…" : "Save listing"}
        </button>
      </div>
    </div>
  );
}

function requirementSummary(o) {
  const parts = [];
  if (o.minEducation) parts.push(`${educationLabel(o.minEducation)}+`);
  for (const r of o.requiredSubjects || []) parts.push(`${r.subject} ${r.minMark}%+`);
  if (o.ageMin != null || o.ageMax != null) parts.push(`age ${o.ageMin ?? "any"}–${o.ageMax ?? "any"}`);
  if (o.provinces?.length) parts.push(o.provinces.join("/"));
  if (o.saCitizenOnly) parts.push("SA citizen");
  if (o.driversLicence) parts.push("licence");
  if (o.unemployedOnly) parts.push("unemployed");
  if (o.disabilityOnly) parts.push("disability");
  return parts.length ? parts.join(" · ") : "No requirements set";
}

export default function OpportunitiesTab({ admin }) {
  const { items, loading, editing, setEditing, errors, saving, confirmDelete, setConfirmDelete, startAdd, startEdit, cancelEdit, save, remove } = admin;
  const today = saToday();

  return (
    <div className="space-y-6">
      {confirmDelete && (
        <ConfirmDeleteDialog title="Delete listing?" name={confirmDelete.title} onCancel={() => setConfirmDelete(null)} onConfirm={() => remove(confirmDelete)} />
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Learnerships & jobs</h2>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Only add listings you've verified at the source. Fake learnerships that charge "registration fees" are common
            — never publish one that asks applicants for money. Learners only see published, open listings whose every
            requirement they meet.
          </p>
        </div>
        {!editing && (
          <button onClick={startAdd} className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition font-medium">
            + Add listing
          </button>
        )}
      </div>

      {editing && (
        <OpportunityForm key={editing.id || "new"} form={editing} setForm={setEditing} errors={errors} saving={saving} onSave={save} onCancel={cancelEdit} />
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading listings…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-sm">No listings yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map((o) => {
            const closed = o.closeDate && o.closeDate < today;
            return (
              <div key={o.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{o.title}</p>
                    <p className="text-xs text-gray-400">{o.organisation} · {typeLabel(o.type)}</p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
                    closed ? "bg-red-900 text-red-300" : o.published ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-300"
                  }`}>
                    {closed ? `Closed ${o.closeDate}` : o.published ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{requirementSummary(o)}</p>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => startEdit(o)} className="text-gray-300 hover:text-white">Edit</button>
                  <button onClick={() => setConfirmDelete(o)} className="text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
