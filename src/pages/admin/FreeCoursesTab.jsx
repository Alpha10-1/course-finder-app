import {
  CERTIFICATE_OPTIONS, COURSE_TOPICS, LEVELS, STARTER_FREE_COURSES, certificateLabel, safeUrl, topicLabel,
} from "../../utils/freeCourses";
import { Checkbox, ChipPicker, ConfirmDeleteDialog, ErrorList, Field, inputClass } from "./formParts";
import useFocusOnMount from "./useFocusOnMount";

function FreeCourseForm({ form, setForm, errors, saving, onSave, onCancel }) {
  const firstRef = useFocusOnMount();
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  return (
    <div className="bg-gray-900 border border-purple-800 rounded-2xl p-5 space-y-4">
      <p className="font-semibold text-white">{form.id ? `Edit ${form.title || "course"}` : "Add a free course"}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Course title">
          <input ref={firstRef} value={form.title} onChange={set("title")} placeholder="e.g. CS50x: Introduction to Computer Science" className={inputClass} />
        </Field>
        <Field label="Offered by">
          <input value={form.provider} onChange={set("provider")} placeholder="e.g. Harvard University" className={inputClass} />
        </Field>
        <Field label="Certificate" hint="Check this on the provider's site — many 'free' courses charge for the certificate.">
          <select value={form.certificate} onChange={set("certificate")} className={inputClass}>
            {CERTIFICATE_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Level">
          <select value={form.level} onChange={set("level")} className={inputClass}>
            {LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </Field>
        <Field label="How long it takes" hint="Optional, e.g. about 10 weeks.">
          <input value={form.duration} onChange={set("duration")} className={inputClass} />
        </Field>
        <Field label="Course link">
          <input value={form.url} onChange={set("url")} placeholder="https://" className={inputClass} />
        </Field>
      </div>
      <Field label="Short description" hint="What learners will learn, and anything they should know first.">
        <textarea value={form.description} onChange={set("description")} rows={3} className={inputClass} />
      </Field>
      <ChipPicker legend="Topics" options={COURSE_TOPICS} selected={form.topics} onChange={(topics) => setForm({ ...form, topics })} />
      <Checkbox
        label="Published — learners can see it"
        checked={form.published === true}
        onChange={(published) => setForm({ ...form, published })}
      />
      <ErrorList errors={errors} />
      <div className="flex gap-3">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
        <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-semibold transition disabled:opacity-60">
          {saving ? "Saving…" : "Save course"}
        </button>
      </div>
    </div>
  );
}

export default function FreeCoursesTab({ admin }) {
  const { items, loading, editing, setEditing, errors, saving, confirmDelete, setConfirmDelete, startAdd, startEdit, cancelEdit, save, remove, addMany } = admin;
  const existing = new Set(items.map((c) => c.url));
  const missingStarters = STARTER_FREE_COURSES.filter((c) => !existing.has(c.url));

  return (
    <div className="space-y-6">
      {confirmDelete && (
        <ConfirmDeleteDialog title="Delete course?" name={confirmDelete.title} onCancel={() => setConfirmDelete(null)} onConfirm={() => remove(confirmDelete)} />
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Free courses</h2>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Free online courses learners can take for skills and certificates, shown on the public Free courses page.
            Only published courses are shown. Say honestly whether the certificate is free.
          </p>
        </div>
        {!editing && (
          <div className="flex gap-2 flex-wrap">
            {missingStarters.length > 0 && (
              <button
                onClick={() => addMany(missingStarters.map((c) => ({ duration: "", ...c, published: false })))}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white text-sm px-4 py-2 rounded-lg transition"
              >
                Add {missingStarters.length} suggested courses as drafts
              </button>
            )}
            <button onClick={startAdd} className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition font-medium">
              + Add course
            </button>
          </div>
        )}
      </div>

      {editing && (
        <FreeCourseForm key={editing.id || "new"} form={editing} setForm={setEditing} errors={errors} saving={saving} onSave={save} onCancel={cancelEdit} />
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading courses…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-sm">No free courses yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map((c) => (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white">{c.title}</p>
                  <p className="text-xs text-gray-400">{c.provider} · {certificateLabel(c.certificate)}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${c.published ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-300"}`}>
                  {c.published ? "Published" : "Draft"}
                </span>
              </div>
              <p className="text-xs text-gray-400">{(c.topics || []).map(topicLabel).join(" · ")}</p>
              <div className="flex gap-3 text-xs">
                {safeUrl(c.url) && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Open course ↗</a>}
                <button onClick={() => startEdit(c)} className="text-gray-300 hover:text-white">Edit</button>
                <button onClick={() => setConfirmDelete(c)} className="text-red-400 hover:text-red-300">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
