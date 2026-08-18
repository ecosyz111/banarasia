// Is a Vercel Blob store attached to this deployment?
//
// Asked in three places — the content store, the uploader and the image route —
// which must all agree, because a disagreement means content written to one
// backend and read from the other.
//
// Vercel wires a connected store in one of two ways, and the answer has to be
// yes for both:
//
//   OIDC (the default)   BLOB_STORE_ID, plus a VERCEL_OIDC_TOKEN it rotates
//   Read-write token     BLOB_READ_WRITE_TOKEN, long-lived
//
// The SDK resolves the credential itself; this only reports whether a store is
// there at all. VERCEL_OIDC_TOKEN is deliberately not part of the test — Vercel
// sets it on every project, Blob store or not, so keying off it would push a
// storeless deployment onto the blob backend.
import "server-only";

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}
