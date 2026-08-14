import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { put } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

// Allowed image MIME types for gallery upload
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// POST /api/caterer/upload — Admin endpoint for uploading gallery image files
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

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
    const filename = `gallery_${Date.now()}_${randomHash}${ext}`;

    if (useBlob) {
      // Production: Upload to Vercel Blob store
      const blob = await put(`caterer/gallery/${filename}`, buffer, {
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
