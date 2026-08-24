// Image upload — stores the file and returns the URL it is served from.
//
// Where it lands follows the store in src/lib/caterer/store.ts and its
// precedence exactly: Postgres when a database is configured, Vercel Blob when
// a Blob store is attached, `public/uploads/caterer/` on disk when neither is.
// Whichever takes it, the URL handed back is the same site-relative
// `/uploads/caterer/<filename>`, served by src/app/uploads/caterer/[filename].
// Records therefore hold no backend-specific URL, and moving a site between
// disk and Blob does not rewrite a single stored image path.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { put } from "@vercel/blob";
import { isBlobConfigured } from "@/lib/caterer/blob";
import { isPostgresConfigured, pgQuery } from "@/lib/caterer/pg";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";

// Allowed image MIME types for gallery upload
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// What the upload is for. Every file lands in the same directory; the kind
// becomes the filename prefix, so `site_…` and `venue_…` stay tellable apart at
// a glance. `kind` is optional and defaults to gallery, so existing callers
// that only send `file` are unaffected. "site" covers the fixed page
// photography — hero, About, section backdrops, share image and favicon.
//
// SVG stays off the allow-list even for logos — it can carry script and is
// served from our own origin.
const KINDS = ["gallery", "logo", "venue", "cuisine", "service", "feature", "site"] as const;

type UploadKind = (typeof KINDS)[number];

function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

// POST /api/caterer/upload — Admin endpoint for uploading image files
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawKind = formData.get("kind");
    const kind: UploadKind = isUploadKind(rawKind) ? rawKind : "gallery";

    if (!file) {
      return NextResponse.json(
        { error: "No image file provided. Please select a file to upload." },
        { status: 400 }
      );
    }

    const mimeType = file.type.toLowerCase();
    if (!ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: "Invalid file format. Only JPG, JPEG, PNG, and WebP images are allowed." },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize extension & generate unique filename
    const extMatch = file.name.match(/\.(jpe?g|png|webp)$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : ".jpg";
    const randomHash = crypto.randomBytes(6).toString("hex");
    const filename = `${kind}_${Date.now()}_${randomHash}${ext}`;

    // Same precedence as the content store: Postgres first, so a project moved
    // off Blob keeps its uploads working even with BLOB_STORE_ID still sitting
    // in its environment. An image is a row like any other record; they are
    // small, and a free Postgres tier has room for far more of them than this
    // site will ever hold.
    if (isPostgresConfigured()) {
      await pgQuery(
        `INSERT INTO caterer_upload (name, content_type, bytes)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE
           SET content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes`,
        [filename, mimeType, buffer]
      );
      return NextResponse.json({ url: `/uploads/caterer/${filename}` });
    }

    if (isBlobConfigured()) {
      // Private, because a Blob store's access mode is fixed at creation and
      // covers everything in it — and the same store holds the content shards,
      // which include captured leads. Private blobs are delivered through our
      // own route rather than by URL, which is what serves them.
      //
      // The filename already carries a timestamp and six random bytes, so
      // addRandomSuffix would only make it longer. allowOverwrite covers the
      // retry of a request whose response was lost.
      await put(`caterer/uploads/${filename}`, buffer, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: mimeType,
      });
      return NextResponse.json({ url: `/uploads/caterer/${filename}` });
    }

    // The URL returned here is served by src/app/uploads/caterer/[filename] —
    // Next indexes public/ at build time and 404s anything added later, so a
    // file written now cannot rely on the static layer.
    const uploadDir = path.join(process.cwd(), "public", "uploads", "caterer");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, filename), buffer);
    return NextResponse.json({ url: `/uploads/caterer/${filename}` });
  } catch (err: unknown) {
    console.error("POST /api/caterer/upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload image file." },
      { status: 500 }
    );
  }
}
