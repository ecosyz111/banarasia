"use client";

// Admin screen for a photo-card collection — the grids on the public page that
// are a photo with a bilingual title and one line under it (Our Services, Why
// Choose Us). The list, the add/edit modal and the delete confirmation all live
// here so a new grid costs a props object rather than another 400 lines in the
// dashboard.
//
// The record type is redeclared rather than imported: the store module is
// server-only, and this runs in the browser.

import { useRef, useState } from "react";

export type PhotoCard = {
  id: string;
  nameEn: string;
  nameHi: string;
  descEn: string;
  descHi: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
};

type FormData = {
  nameEn: string;
  nameHi: string;
  descEn: string;
  descHi: string;
  imageUrl: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_FORM: FormData = {
  nameEn: "",
  nameHi: "",
  descEn: "",
  descHi: "",
  imageUrl: "",
  sortOrder: "0",
  isActive: true,
};

export type PhotoCardCollectionProps = {
  items: PhotoCard[];
  loading: boolean;
  // Collection endpoint, e.g. "/api/caterer/services". Item writes go to
  // `${endpoint}/${id}`.
  endpoint: string;
  // `kind` sent to /api/caterer/upload, which decides the storage folder.
  uploadKind: string;
  heading: string;
  blurb: string;
  // Lower-case noun used in buttons, toasts and confirmations ("service").
  singular: string;
  emptyBody: string;
  placeholders: { nameEn: string; nameHi: string; descEn: string; descHi: string };
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  showToast: (type: "success" | "error", message: string) => void;
  // Called after a successful write so the dashboard can refetch.
  onChanged: () => void;
};

// Sentence-cases the noun for headings without pulling in a dependency.
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function PhotoCardCollection({
  items,
  loading,
  endpoint,
  uploadKind,
  heading,
  blurb,
  singular,
  emptyBody,
  placeholders,
  apiFetch,
  showToast,
  onChanged,
}: PhotoCardCollectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<PhotoCard | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // The file input id has to be unique per collection — two of these render on
  // the same dashboard, and a shared id would point both labels at one input.
  const fileInputId = `caterer-${uploadKind}-file-input`;
  const Noun = titleCase(singular);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: String(items.length + 1) });
    setModalOpen(true);
  };

  const openEdit = (item: PhotoCard) => {
    setEditingId(item.id);
    setForm({
      nameEn: item.nameEn,
      nameHi: item.nameHi,
      descEn: item.descEn ?? "",
      descHi: item.descHi ?? "",
      imageUrl: item.imageUrl ?? "",
      sortOrder: String(item.sortOrder ?? 0),
      isActive: item.isActive ?? true,
    });
    setModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      showToast("error", "Invalid format. Only JPG, JPEG, PNG, and WebP images are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", uploadKind);

      const res = await apiFetch("/api/caterer/upload", { method: "POST", body: formData });
      const json = await res.json().catch(() => null);

      if (res.ok && json?.url) {
        setForm((prev) => ({ ...prev, imageUrl: json.url }));
        showToast("success", `Photo uploaded. Save the ${singular} to apply it.`);
      } else {
        showToast("error", json?.error ?? "Image upload failed.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "An error occurred while uploading the photo.");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!form.nameEn.trim()) {
      showToast("error", "English title is required.");
      return;
    }
    if (!form.nameHi.trim()) {
      showToast("error", "Hindi title is required.");
      return;
    }

    setSubmitting(true);

    const payload = {
      nameEn: form.nameEn.trim(),
      nameHi: form.nameHi.trim(),
      descEn: form.descEn.trim(),
      descHi: form.descHi.trim(),
      imageUrl: form.imageUrl.trim(),
      sortOrder: parseInt(form.sortOrder, 10) || 0,
      isActive: form.isActive,
    };

    try {
      const url = editingId ? `${endpoint}/${editingId}` : endpoint;
      const res = await apiFetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast("success", editingId ? `${Noun} updated.` : `${Noun} added.`);
        setModalOpen(false);
        onChanged();
      } else {
        const json = await res.json().catch(() => null);
        showToast("error", json?.error ?? `Failed to save ${singular}.`);
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", `An error occurred while saving the ${singular}.`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleting || deletingLoading) return;
    setDeletingLoading(true);
    try {
      const res = await apiFetch(`${endpoint}/${deleting.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", `${Noun} deleted.`);
        setDeleting(null);
        onChanged();
      } else {
        showToast("error", `Failed to delete ${singular}.`);
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", `An error occurred while deleting the ${singular}.`);
      }
    } finally {
      setDeletingLoading(false);
    }
  };

  return (
    <>
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#3D2518]">{heading}</h2>
            <p className="text-sm text-stone-500">{blurb}</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Add {Noun}</span>
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-stone-200 bg-white overflow-hidden">
                <div className="h-40 bg-stone-200"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 bg-stone-100 rounded"></div>
                  <div className="h-3 w-1/2 bg-stone-100 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <h3 className="text-base font-bold text-stone-800">Nothing Here Yet</h3>
            <p className="mt-1 text-sm text-stone-500">{emptyBody}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
                  item.isActive ? "border-stone-200" : "border-stone-200 opacity-75 bg-stone-50"
                }`}
              >
                <div>
                  <div className="relative h-40 w-full overflow-hidden bg-stone-100">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.nameEn} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-500 to-amber-500 p-4 text-center">
                        <span className="text-sm font-bold text-white">{item.nameEn}</span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${
                          item.isActive
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-stone-100 text-stone-600 border border-stone-200"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            item.isActive ? "bg-emerald-500" : "bg-stone-400"
                          }`}
                        />
                        {item.isActive ? "Active" : "Hidden"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-1">
                    <h4 className="font-bold text-[#3D2518] text-sm">{item.nameEn}</h4>
                    <p className="text-xs font-medium text-stone-500">{item.nameHi}</p>
                    <p className="pt-1 text-xs text-stone-500 line-clamp-2">{item.descEn}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-stone-100 p-4 bg-stone-50/50">
                  <span className="text-xs text-stone-400 font-mono">#{item.sortOrder}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(item)}
                      className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 hover:border-stone-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleting(item)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ==================================================================== */}
      {/* ADD / EDIT MODAL */}
      {/* ==================================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="my-8 w-full max-w-2xl space-y-5 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <h3 className="text-lg font-bold text-[#3D2518]">
                {editingId ? `Edit ${Noun}` : `Add ${Noun}`}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 rounded-2xl border border-stone-200 bg-[#FAF8F5] p-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                {Noun} Photo
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="relative h-28 w-full flex-shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 sm:w-44">
                  {form.imageUrl.trim() ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.imageUrl.trim()}
                        alt={`${Noun} preview`}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.opacity = "0";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, imageUrl: "" })}
                        className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold text-rose-600 shadow-sm transition hover:bg-white"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-orange-500 to-amber-500 text-white">
                      <span className="px-2 text-center text-[10px] font-bold uppercase tracking-wider">
                        Gradient card
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                    id={fileInputId}
                    disabled={uploading || submitting}
                  />
                  <label
                    htmlFor={fileInputId}
                    className={`flex items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-stone-300 bg-white px-4 py-3 text-xs font-bold text-stone-700 transition hover:border-orange-500 hover:bg-orange-50/50 ${
                      uploading || submitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                    }`}
                  >
                    {uploading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin text-orange-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="font-bold text-orange-600">Uploading Photo…</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>Choose File from Device (JPG, PNG, WebP)</span>
                      </>
                    )}
                  </label>

                  <input
                    type="text"
                    placeholder="Or paste a URL / path — https://… or /uploads/caterer/…"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    disabled={uploading || submitting}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:opacity-60"
                  />
                  <p className="text-[11px] text-stone-500">
                    Optional. With no photo the tile renders as an orange gradient card with the
                    title on it.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Title (English) *
                </label>
                <input
                  type="text"
                  required
                  placeholder={placeholders.nameEn}
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Title (Hindi) *
                </label>
                <input
                  type="text"
                  required
                  placeholder={placeholders.nameHi}
                  value={form.nameHi}
                  onChange={(e) => setForm({ ...form, nameHi: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Caption (English)
                </label>
                <input
                  type="text"
                  placeholder={placeholders.descEn}
                  value={form.descEn}
                  onChange={(e) => setForm({ ...form, descEn: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Caption (Hindi)
                </label>
                <input
                  type="text"
                  placeholder={placeholders.descHi}
                  value={form.descHi}
                  onChange={(e) => setForm({ ...form, descHi: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Display Order
                </label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                />
                <span>Show on the public site</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || uploading}
                className="rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 disabled:opacity-60"
              >
                {submitting ? "Saving…" : editingId ? "Save Changes" : `Add ${Noun}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CONFIRMATION DIALOG: DELETE */}
      {/* ==================================================================== */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-stone-900">Delete {Noun}?</h3>
            </div>
            <p className="text-sm text-stone-600">
              Remove <strong className="text-stone-900">{deleting.nameEn}</strong> from the grid? To
              take it off the site temporarily, edit it and untick &ldquo;Show on the public
              site&rdquo; instead.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={deletingLoading}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deletingLoading}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 disabled:opacity-60"
              >
                {deletingLoading ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
