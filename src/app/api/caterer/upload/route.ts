import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { put } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

// The local-dev fallback writes into public/, which only exists on a real disk.
// On Vercel the bundle lives in a read-only /var/task, so that branch used to
// die with a bare ENOENT; /tmp is writable but nothing serves it, so there is no
// fallback worth taking here — the deployment simply needs a Blob store.
const isServerless = !!process.env.VERCEL;

// Allowed image MIME types for gallery upload
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// Upload destinations. `kind` is optional and defaults to gallery, so existing
// callers that only send `file` are unaffected. SVG stays off the allow-list
// even for logos — it can carry script and is served from our own origin.
const KINDS = {
  gallery: { prefix: "gallery", blobDir: "caterer/gallery" },
  logo: { prefix: "logo", blobDir: "caterer/branding" },
  venue: { prefix: "venue", blobDir: "caterer/venues" },
  cuisine: { prefix: "cuisine", blobDir: "caterer/cuisines" },
  service: { prefix: "service", blobDir: "caterer/services" },
  feature: { prefix: "feature", blobDir: "caterer/features" },
  // The fixed page photography — hero, About, section backdrops, share image
  // and favicon. One folder keeps them together in the Blob store.
  site: { prefix: "site", blobDir: "caterer/site" },
} as const;

type UploadKind = keyof typeof KINDS;

// POST /api/caterer/upload — Admin endpoint for uploading image files
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  if (!useBlob && isServerless) {
    console.error(
      "POST /api/caterer/upload: BLOB_READ_WRITE_TOKEN is missing — image uploads need a Vercel Blob store."
    );
    return NextResponse.json(
      {
        error:
          "Image uploads are not configured on this deployment. Connect a Vercel Blob store so BLOB_READ_WRITE_TOKEN is set, then redeploy.",
      },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawKind = formData.get("kind");
    const kind: UploadKind =
      typeof rawKind === "string" && rawKind in KINDS ? (rawKind as UploadKind) : "gallery";

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
    const filename = `${KINDS[kind].prefix}_${Date.now()}_${randomHash}${ext}`;

    if (useBlob) {
      // Production: Upload to Vercel Blob store
      const blob = await put(`${KINDS[kind].blobDir}/${filename}`, buffer, {
        access: "public",
        addRandomSuffix: false,
        contentType: file.type || "image/jpeg",
      });
      return NextResponse.json({ url: blob.url });
    } else {
      // Local Development: Save to public/uploads/caterer/ directory
      const uploadDir = path.join(process.cwd(), "public", "uploads", "caterer");
      await fs.mkdir(uploadDir, { recursive: true });
      const localFilePath = path.join(uploadDir, filename);
      await fs.writeFile(localFilePath, buffer);
      return NextResponse.json({ url: `/uploads/caterer/${filename}` });
    }
  } catch (err: unknown) {
    console.error("POST /api/caterer/upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload image file." },
      { status: 500 }
    );
  }
}
