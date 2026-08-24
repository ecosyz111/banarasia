// Serves the images POST /api/caterer/upload writes, from whichever backend
// took them.
//
// WHY THIS EXISTS. A reason per backend, and all three need it.
//
// On Postgres: the bytes are a row. There is no URL to redirect to — reading
// them out and writing them to the response is the only way they reach a
// browser.
//
// On disk: the uploader saves into `public/uploads/caterer/`, and Next does
// serve `public/` — but it indexes that directory when the app is BUILT. A file
// written afterwards is not in the index, so `next start` answers 404 for it:
// the console reports a successful upload, the URL saves into the content store,
// and the photo never appears until the next rebuild. Files that happened to
// exist at build time keep being served statically and never reach this
// handler, so both eras of upload resolve.
//
// On Blob: the store is private — its access mode is fixed at creation and the
// same store holds the content shards, leads included — so a private blob has no
// public URL at all. Delivery is by definition through a function, and this is
// it.
import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { isBlobConfigured } from "@/lib/caterer/blob";
import { isPostgresConfigured, pgQuery, uploadTable } from "@/lib/caterer/pg";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
// The directory changes under a running server, which is the whole point.
export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "caterer");

// The exact shape the uploader generates: `<kind>_<timestamp>_<hash>.<ext>`.
// Anything else — a traversal attempt, a dotfile, a name with a slash — is a
// 404 rather than a read, so a request can never leave this directory.
const FILENAME = /^[a-z]+_\d+_[0-9a-f]+\.(jpe?g|png|webp)$/i;

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!FILENAME.test(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? "image/jpeg";
  // Every filename carries a timestamp and a random hash, so a given URL always
  // names the same bytes and can be cached hard. On Blob that matters twice
  // over: it is what keeps a page of photos from costing a function invocation
  // per image on every visit.
  const cacheControl = "public, max-age=31536000, immutable";

  // Postgres first, matching the uploader and the content store.
  if (isPostgresConfigured()) {
    try {
      const rows = await pgQuery<{ content_type: string; bytes: Buffer }>(
        `SELECT content_type, bytes FROM ${uploadTable()} WHERE name = $1`,
        [filename]
      );
      const row = rows[0];
      if (!row) return new NextResponse("Not found", { status: 404 });
      return new NextResponse(new Uint8Array(row.bytes), {
        headers: {
          "Content-Type": row.content_type || contentType,
          "Cache-Control": cacheControl,
          "Content-Length": String(row.bytes.byteLength),
        },
      });
    } catch (err) {
      // Unlike a missing row, a database that will not answer is a real
      // failure and must not be dressed up as a 404 the browser will cache.
      console.error("GET /uploads/caterer error:", err);
      return new NextResponse("Upload store unavailable", { status: 503 });
    }
  }

  if (isBlobConfigured()) {
    try {
      const res = await get(`caterer/uploads/${filename}`, { access: "private" });
      if (!res || res.statusCode !== 200) {
        return new NextResponse("Not found", { status: 404 });
      }
      return new NextResponse(res.stream, {
        headers: {
          // The blob's own content type is authoritative — it is what the
          // uploader validated — and falls back to the extension.
          "Content-Type": res.blob.contentType || contentType,
          "Cache-Control": cacheControl,
          "Content-Length": String(res.blob.size),
        },
      });
    } catch {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  try {
    const file = await fs.readFile(path.join(UPLOAD_DIR, filename));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
        "Content-Length": String(file.byteLength),
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
