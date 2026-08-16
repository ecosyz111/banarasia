// Materialise the caterer store as shard files — one JSON file per record.
//
//   npm run seed:shards            write any shard that is missing
//   npm run seed:shards -- --force overwrite existing shards too
//
// Reads the same src/lib/caterer/seed-data.json the store falls back to, so a
// freshly seeded directory and a store that seeded itself on first write hold
// byte-identical files. Local disk only: with a Blob store the app seeds itself
// on its first write, and this script has nothing to talk to.
//
// Existing shards are left alone unless --force is passed, so running it against
// a store the owner has already edited cannot silently revert their content.

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_ROOT = path.join(ROOT, "data", "caterer");
const SEED_FILE = path.join(ROOT, "src", "lib", "caterer", "seed-data.json");

// Kept in step with SHARD_VERSION / SINGLETON_FILES in src/lib/caterer/store.ts.
const SHARD_VERSION = 2;
const COLLECTIONS = [
  "packages",
  "gallery",
  "venues",
  "cuisines",
  "services",
  "features",
  "testimonials",
];

const force = process.argv.includes("--force");

// Mirrors shardFileName() in the store: same input must produce the same file,
// or seeding here and seeding through the app would disagree.
function shardFileName(id) {
  const safe = id.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "_");
  if (safe === id && safe.length > 0) return `${id}.json`;
  const digest = crypto.createHash("sha1").update(id).digest("hex").slice(0, 8);
  return `${safe || "id"}-${digest}.json`;
}

async function writeShard(rel, value, stats) {
  const full = path.join(DATA_ROOT, rel);
  if (!force) {
    try {
      await fs.access(full);
      stats.skipped++;
      return;
    } catch {
      // Not there yet — fall through and write it.
    }
  }
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(value, null, 2), "utf-8");
  stats.written++;
}

const seed = JSON.parse(await fs.readFile(SEED_FILE, "utf-8"));
const stats = { written: 0, skipped: 0 };

await writeShard("manifest.json", { version: SHARD_VERSION }, stats);

for (const name of COLLECTIONS) {
  const records = seed[name] ?? [];
  for (const record of records) {
    await writeShard(`${name}/${shardFileName(record.id)}`, record, stats);
  }
  console.log(`${name.padEnd(13)} ${String(records.length).padStart(3)} records`);
}

await writeShard("about.json", seed.about, stats);

// Seeding into a store that already holds records is the case that goes wrong
// quietly: a kept file and a newly written one can claim the same sortOrder, and
// since every read path sorts by it the grid then renders in an arbitrary order.
// Report it rather than leave the owner to notice a card in the wrong place.
for (const name of COLLECTIONS) {
  const dir = path.join(DATA_ROOT, name);
  let files;
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    continue;
  }
  const seen = new Map();
  for (const file of files) {
    const record = JSON.parse(await fs.readFile(path.join(dir, file), "utf-8"));
    const clash = seen.get(record.sortOrder);
    if (clash) {
      console.warn(
        `  ! ${name}: "${clash}" and "${record.id}" both have sortOrder ${record.sortOrder}` +
          ` — re-run with --force to take the seed's ordering.`
      );
    }
    seen.set(record.sortOrder, record.id);
  }
}

// settings.json and site.json are deliberately not seeded: DEFAULT_SETTINGS and
// DEFAULT_SITE live in store.ts and the store writes them on its first save.
// Duplicating them here would give branding two sources of truth.

console.log(
  `\n${stats.written} file(s) written, ${stats.skipped} left alone` +
    (force ? "" : " (pass --force to overwrite)")
);
console.log(`store: ${path.relative(ROOT, DATA_ROOT)}`);
