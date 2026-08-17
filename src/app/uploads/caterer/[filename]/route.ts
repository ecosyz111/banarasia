// Serves the images POST /api/caterer/upload writes.
//
// WHY THIS EXISTS. The uploader saves into `public/uploads/caterer/`, and Next
// does serve `public/` — but it indexes that directory when the app is BUILT.
// A file written afterwards is not in the index, so `next start` answers 404
// for it: the console reports a successful upload, the URL saves into the
// content store, and the photo never appears until the next rebuild. Files that
// happened to exist at build time keep being served statically and never reach
// this handler, so both eras of upload resolve.
import { NextResponse } from "next/server";
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

  try {
    const file = await fs.readFile(path.join(UPLOAD_DIR, filename));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? "image/jpeg",
        // Every filename carries a timestamp and a random hash, so a given URL
        // always names the same bytes and can be cached hard.
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(file.byteLength),
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
