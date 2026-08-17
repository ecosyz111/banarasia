// Image upload — writes to `public/uploads/caterer/` and returns the path the
// image is served from. Needs a writable, persistent filesystem, same as the
// JSON store in src/lib/caterer/store.ts.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
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
