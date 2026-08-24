// Why is the Blob store refusing us?
//
// A 403 in the deployment log does not say whether the store is the wrong kind
// or the credential is for someone else's store, and the two have different
// fixes. This asks the store directly and prints which one it is.
//
//   vercel env pull .env.vercel      # the deployment's own credentials
//   npm run blob:doctor -- .env.vercel
//
// Reads only: it lists and fetches, and writes nothing.
import { list, get } from "@vercel/blob";
import fs from "node:fs";

const PREFIX = "caterer/";

// Minimal .env parsing — enough for `vercel env pull` output, without pulling
// in a dependency for a diagnostic script.
function loadEnvFile(file) {
  if (!file) return;
  if (!fs.existsSync(file)) {
    console.error(`env file not found: ${file}`);
    process.exit(1);
  }
  for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    const value = rawValue.trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
  console.log(`loaded env from ${file}\n`);
}

function mask(value) {
  if (!value) return "(unset)";
  return `${value.slice(0, 12)}…${value.slice(-4)} (${value.length} chars)`;
}

// The access mode is part of the hostname the SDK builds, so a blob's own URL
// is the store's answer about what it is.
function accessFromUrl(url) {
  const host = new URL(url).hostname;
  if (host.includes(".private.")) return "private";
  if (host.includes(".public.")) return "public";
  return "unknown";
}

async function probeGet(pathname, access) {
  try {
    const res = await get(pathname, { access, useCache: false });
    if (!res) return { ok: true, note: "reachable, blob not found (404)" };
    return { ok: true, note: `read ${res.blob.size ?? "?"} bytes` };
  } catch (err) {
    return { ok: false, note: err instanceof Error ? err.message : String(err) };
  }
}

loadEnvFile(process.argv[2]);

console.log("credentials visible to the SDK");
console.log(`  BLOB_READ_WRITE_TOKEN  ${mask(process.env.BLOB_READ_WRITE_TOKEN)}`);
console.log(`  BLOB_STORE_ID          ${process.env.BLOB_STORE_ID ?? "(unset)"}`);
console.log(`  VERCEL_OIDC_TOKEN      ${mask(process.env.VERCEL_OIDC_TOKEN)}`);

if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
  console.log(
    "\nNeither is set, so the app would use the fs backend (data/caterer/) and " +
      "never touch Blob. Pull the deployment's env and pass it as an argument."
  );
  process.exit(0);
}

console.log("\nlisting the store");
let listed;
try {
  listed = await list({ prefix: PREFIX, limit: 5 });
  console.log(`  ok — ${listed.blobs.length} blob(s) under ${PREFIX}`);
} catch (err) {
  console.log(`  FAILED — ${err instanceof Error ? err.message : err}`);
  console.log(
    "\nVERDICT: the credential cannot even list this store. It belongs to a " +
      "different store or account than the one attached to the deployment.\n" +
      "FIX: in the Vercel project that serves the site, connect its own Blob " +
      "store (Storage tab), redeploy, and drop any hand-copied token."
  );
  process.exit(1);
}

const sample = listed.blobs[0];
if (sample) {
  const actual = accessFromUrl(sample.url);
  console.log(`  store access mode: ${actual}  (from ${sample.url})`);
  console.log(`  sample blob: ${sample.pathname}`);

  if (actual === "public") {
    console.log(
      "\nVERDICT: the attached store is PUBLIC, and the app reads and writes it " +
        "as private — that mismatch is the 403.\n" +
        "FIX: a store's access mode is fixed at creation, so create a NEW store " +
        "with access Private, connect it to this project, redeploy. Do not switch " +
        "the app to public: these shards include captured leads (visitor names " +
        "and phone numbers), and a public blob is readable by anyone who can " +
        "derive its URL."
    );
    process.exit(1);
  }
}

console.log("\nreading a shard as private (what the app does)");
const manifest = await probeGet(`${PREFIX}manifest.json`, "private");
console.log(`  ${manifest.ok ? "ok" : "FAILED"} — ${manifest.note}`);

if (!manifest.ok) {
  const asPublic = await probeGet(`${PREFIX}manifest.json`, "public");
  console.log(`  same blob as public: ${asPublic.ok ? "ok" : "FAILED"} — ${asPublic.note}`);
  console.log(
    asPublic.ok
      ? "\nVERDICT: the store answers as public but not as private — it was " +
          "created public.\nFIX: create a Private store, connect it, redeploy."
      : "\nVERDICT: the credential lists the store but cannot read from it. That " +
          "is an authorisation problem, not an access-mode one — most often an " +
          "OIDC token that the deployment's account is not entitled to use.\n" +
          "FIX: set BLOB_READ_WRITE_TOKEN on the project from that store's own " +
          "Storage tab, and redeploy."
  );
  process.exit(1);
}

console.log("\nVERDICT: the store is private, listable and readable. Blob is not " +
  "the problem — check the deployment log for the failing call.");
