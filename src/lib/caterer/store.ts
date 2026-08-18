// Caterer CMS persistence — sharded JSON files.
//
// Every record is its own JSON file. A package edit rewrites that one package's
// file and nothing else, so the cost of a save no longer grows with the size of
// the catalogue, and two admins editing different sections cannot clobber each
// other by each re-serialising the whole store.
//
//   packages/pkg-silver.json
//   gallery/gal-001.json
//   settings.json
//
// Those shards live in one of two places, picked by whether a Vercel Blob store
// is attached to the deployment — see ./blob and storage():
//
//   blob   Vercel Blob, under the `caterer/` prefix. This is what makes the
//          store work on serverless hosting, where the only writable directory
//          is a per-instance /tmp that is wiped on the next cold start.
//   fs     `data/caterer/` on local disk. The default for local development
//          and for hosts with a persistent volume.
//
// Initial defaults are loaded from ./seed-data.json if no store exists yet, and
// a store still in the old single-file layout is read once and re-sharded on
// its next write — see readFromStorage.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { BlobNotFoundError, del, get, list, put } from "@vercel/blob";
import { isBlobConfigured } from "./blob";
import SEED from "./seed-data.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// "amount" renders the rupee figure; "quote" hides it behind a Get Price Quote
// call-to-action. Packages predating this field have no priceMode, so every
// read path treats undefined as "amount" and keeps rendering the old way.
export type PriceMode = "amount" | "quote";

export type CatererPackage = {
  id: string;
  nameEn: string;
  nameHi: string;
  price: number;
  priceMode: PriceMode;
  // Gathering size the plate rate was costed against. Per-plate price falls as
  // the guest count rises (staff and setup are fixed), so a rate without its
  // basis is meaningless. 0 hides the figure for packages priced some other way.
  basisPax: number;
  priceUnitEn: string;
  priceUnitHi: string;
  badgeEn: string | null;
  badgeHi: string | null;
  featuresEn: string[];
  featuresHi: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CatererVenue = {
  id: string;
  nameEn: string;
  nameHi: string;
  areaEn: string;
  areaHi: string;
  capacity: string;
  // Photo of the space. Optional — venues saved before this field existed have
  // none, and the public card falls back to the icon header it always drew.
  imageUrl: string;
  notesEn: string;
  notesHi: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

// Branding the owner can change without a deploy: the logo swap, the two
// colours the public page derives every accent from, the WhatsApp line every
// wa.me link on the site points at (stored with country code, no "+"), and the
// fixed page photography — every image on the public site that is not part of
// a collection (gallery, venues, cuisines) lives here, so nothing on the page
// needs a code edit to change.
export type CatererSettings = {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  whatsappNumber: string;
  heroImageUrl: string;
  aboutImageUrl: string;
  servicesBgUrl: string;
  ctaBgUrl: string;
  // What WhatsApp/Facebook show when the link is pasted, and the browser-tab
  // icon. Neither is visible on the page itself, so they are easy to forget —
  // they sit alongside the rest so one screen covers every image.
  shareImageUrl: string;
  faviconUrl: string;
  updatedAt?: string;
};

// The image keys above, listed once so validation, normalisation and the admin
// form all agree on what counts as a settings image.
export const SETTINGS_IMAGE_KEYS = [
  "logoUrl",
  "heroImageUrl",
  "aboutImageUrl",
  "servicesBgUrl",
  "ctaBgUrl",
  "shareImageUrl",
  "faviconUrl",
] as const;

export type SettingsImageKey = (typeof SETTINGS_IMAGE_KEYS)[number];

// Three grids on the page are the same thing — a photo with a bilingual title
// and one line under it: Cuisine Specialization, Our Services and Why Choose
// Us. One record shape serves all three, so the store, the API and the admin
// screen each only have to understand it once.
//
// An empty imageUrl is meaningful rather than missing: it renders the gradient
// card the cuisine grid has always ended with, and is what a Services or Why
// Choose Us tile falls back to when its photo has not been chosen yet.
export type CatererPhotoCard = {
  id: string;
  nameEn: string;
  nameHi: string;
  descEn: string;
  descHi: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

// Named separately because they are separate collections with separate admin
// tabs, even though the shape they carry is identical.
export type CatererCuisine = CatererPhotoCard;
export type CatererService = CatererPhotoCard;
export type CatererFeature = CatererPhotoCard;

// The photo-card collections, listed once so the generic store operations,
// the API routes and the backfill all agree on what exists.
export const PHOTO_CARD_COLLECTIONS = ["cuisines", "services", "features"] as const;
export type PhotoCardCollection = (typeof PHOTO_CARD_COLLECTIONS)[number];

export type CatererTestimonial = {
  id: string;
  quoteEn: string;
  quoteHi: string;
  authorName: string;
  eventEn: string;
  eventHi: string;
  // Star count, 1–5. Rendered as filled stars, so anything outside that range
  // is clamped rather than rejected.
  rating: number;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CatererHeroBadge = {
  value: string;
  labelEn: string;
  labelHi: string;
};

// Copy that used to be frozen in the HTML: the hero the visitor lands on, the
// contact details every enquiry route depends on, and the footer. Contact
// details in particular go stale (a new number, a moved kitchen) and must never
// need a deploy to fix.
export type CatererSite = {
  heroEyebrowEn: string;
  heroEyebrowHi: string;
  // The headline renders as two lines, the second in the brand gradient.
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroMottoEn: string;
  heroMottoHi: string;
  heroDescEn: string;
  heroDescHi: string;
  heroBadges: CatererHeroBadge[];
  phonePrimary: string;
  phoneSecondary: string;
  addressEn: string;
  addressHi: string;
  hoursEn: string;
  hoursHi: string;
  // Google Maps `/maps/embed` src for the contact iframe, and the share link
  // the Maps buttons open. They are different URLs for the same place.
  mapEmbedUrl: string;
  mapLinkUrl: string;
  youtubeUrl: string;
  // Social profiles. Both icons are always in the footer; these repoint them.
  // Empty means the owner has not pasted their profile yet, and the icon keeps
  // the placeholder link the page ships with (the platform home page) rather
  // than disappearing — the row stays visually complete either way.
  facebookUrl: string;
  instagramUrl: string;
  footerDescEn: string;
  footerDescHi: string;
  copyrightEn: string;
  copyrightHi: string;
  footerTaglineEn: string;
  footerTaglineHi: string;
  updatedAt?: string;
};

export type CatererGalleryItem = {
  id: string;
  imageUrl: string;
  captionEn: string;
  captionHi: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CatererStat = {
  labelEn: string;
  labelHi: string;
  value: string;
};

export type CatererExpertise = {
  textEn: string;
  textHi: string;
};

export type CatererAbout = {
  id: string;
  slug: string;
  storyTitleEn: string;
  storyTitleHi: string;
  titleEn: string;
  titleHi: string;
  descriptionEn: string;
  descriptionHi: string;
  mottoEn: string;
  mottoHi: string;
  subMottoEn: string | null;
  subMottoHi: string | null;
  establishedYear: number;
  stats: CatererStat[];
  expertise: CatererExpertise[];
  createdAt?: string;
  updatedAt?: string;
};

// A lead is any visitor who left contact details: the footer subscribe box
// (email + phone) and the contact-section inquiry form both land in the same
// admin inbox, told apart by `source`. Fields the originating form does not ask
// for stay empty strings rather than null, so the admin table never branches.
export type LeadSource = "newsletter" | "inquiry";
export type LeadStatus = "new" | "contacted";

export type CatererLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  eventType: string;
  guests: string;
  message: string;
  source: LeadSource;
  status: LeadStatus;
  createdAt: string;
  updatedAt?: string;
};

export type CatererStoreData = {
  packages: CatererPackage[];
  gallery: CatererGalleryItem[];
  venues: CatererVenue[];
  cuisines: CatererCuisine[];
  services: CatererService[];
  features: CatererFeature[];
  testimonials: CatererTestimonial[];
  leads: CatererLead[];
  about: CatererAbout;
  settings: CatererSettings;
  site: CatererSite;
};

export const DEFAULT_SETTINGS: CatererSettings = {
  logoUrl: "/sample-caterer/tl.png",
  primaryColor: "#ea580c",
  accentColor: "#eab308",
  whatsappNumber: "919918359017",
  heroImageUrl:
    "https://images.unsplash.com/photo-1555244162-803834f70033?w=1920&q=80",
  aboutImageUrl:
    "https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&q=80",
  servicesBgUrl:
    "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1920&q=60",
  ctaBgUrl:
    "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1920&q=80",
  shareImageUrl:
    "https://images.unsplash.com/photo-1555244162-803834f70033?w=1200&q=80",
  faviconUrl: "/sample-caterer/favicon-512.png",
};

export const DEFAULT_SITE: CatererSite = {
  heroEyebrowEn: "Since 2015",
  heroEyebrowHi: "2015 से निरंतर सेवा",
  heroTitleLine1: "Banarasia",
  heroTitleLine2: "Buffet Art",
  heroMottoEn: '"Jab har mehman khas ho.."',
  heroMottoHi: '"जब हर मेहमान खास हो.."',
  heroDescEn:
    "Premium catering experiences crafted with authentic taste, elegant presentation, and heartfelt hospitality.",
  heroDescHi:
    "स्वादिष्ट व्यंजन, भव्य प्रस्तुति और आदर-सत्कार के साथ तैयार किया गया प्रीमियम कैटरिंग अनुभव।",
  heroBadges: [
    { value: "10+", labelEn: "Years Experience", labelHi: "वर्षों का अनुभव" },
    { value: "10K+", labelEn: "Guests Served", labelHi: "मेहमानों की सेवा" },
    { value: "Pure", labelEn: "Veg & Jain", labelHi: "शुद्ध शाकाहारी व जैन" },
    { value: "Premium", labelEn: "Wedding Catering", labelHi: "वेडिंग कैटरिंग" },
  ],
  phonePrimary: "9918629017",
  phoneSecondary: "9918359017",
  addressEn: "Lane No. 7, Vidvan Khand, Gomti Nagar, Lucknow",
  addressHi: "लेन नं. 7, विद्वान खंड, गोमती नगर, लखनऊ",
  hoursEn: "10 AM – 7 PM (All Days)",
  hoursHi: "सुबह 10 बजे से शाम 7 बजे तक (सभी दिन)",
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3559.5!2d80.99!3d26.85!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjbCsDUxJzAwLjAiTiA4MMKwNTknMjQuMCJF!5e0!3m2!1sen!2sin!4v1",
  mapLinkUrl: "https://share.google/A5emKWy8iuQEcngAX",
  youtubeUrl: "https://youtube.com/@banarasiabuffetart?si=toOrkdaRR2pTff9F",
  // Left blank on purpose: guessing a handle would point the icon at a page
  // that may not be the owner's. Blank keeps the footer's placeholder link
  // until the real profile is pasted into the admin console.
  facebookUrl: "",
  instagramUrl: "",
  footerDescEn:
    "Premium catering services in Lucknow since 2015. Making every celebration a grand feast with authentic flavors and elegant presentation.",
  footerDescHi:
    "2015 से लखनऊ में प्रीमियम कैटरिंग सेवाएं। प्रामाणिक स्वाद और शानदार प्रस्तुति के साथ हर उत्सव को दावत बनाना।",
  copyrightEn: "© 2025 Banarasia Buffet Art. All rights reserved.",
  copyrightHi: "© 2025 बनारसिया बफे आर्ट। सर्वाधिकार सुरक्षित।",
  footerTaglineEn: "Premium Wedding Caterer in Lucknow",
  footerTaglineHi: "लखनऊ में प्रीमियम वेडिंग कैटरर",
};

// ---------------------------------------------------------------------------
// Initial Defaults
// ---------------------------------------------------------------------------

// What a store with no data of its own starts from, held in ./seed-data.json
// rather than inline here so this module stays about persistence — and so
// scripts/seed-shards.mjs can materialise the same records without going
// through a TypeScript build.
//
// The seven collections carry a deliberately small starter set — 3 packages, 6
// gallery photos, 3 venues, 8 cuisines, 8 services, 6 why-us cards, 4 reviews —
// which is the content the public page is written around. They once carried 118
// sample records instead: invented reviews, venues nobody had booked, whole
// stock-photo galleries, all reading as real content on the live site.
//
// This is not decoration. On a read-only host (Vercel) the store cannot keep
// anything the admin console writes, so these defaults ARE what the deployed
// site serves — an empty seed there means an empty site and an admin console
// showing 0 in every tab. Keep this set small and true; add sample records and
// every fresh deploy publishes them as if the owner had entered them.
//
// Treated as read-only: hydration hands out structuredClone copies, because the
// store mutates the object it hydrates and would otherwise edit the seed itself.
const INITIAL_DEFAULTS: CatererStoreData = {
  packages: SEED.packages as CatererPackage[],
  gallery: SEED.gallery as CatererGalleryItem[],
  venues: SEED.venues as CatererVenue[],
  cuisines: SEED.cuisines as CatererCuisine[],
  services: SEED.services as CatererService[],
  features: SEED.features as CatererFeature[],
  testimonials: SEED.testimonials as CatererTestimonial[],
  // Visitor-generated: a fresh store has no enquiries, and seeding fake ones
  // would put invented names in the owner's inbox.
  leads: [],
  about: SEED.about as CatererAbout,
  settings: { ...DEFAULT_SETTINGS },
  site: { ...DEFAULT_SITE },
};

// ---------------------------------------------------------------------------
// Shard Paths
// ---------------------------------------------------------------------------

// Where the fs backend keeps its shards. Beside the app, so a mounted volume on
// `data/` is all a container needs to persist the store.
const DATA_ROOT = path.join(process.cwd(), "data", "caterer");

// Blob pathnames are one flat namespace shared with anything else the project
// stores, so every shard is filed under a prefix of its own. Uploaded images
// live beside it under `caterer/uploads/` — see the upload route.
const BLOB_PREFIX = "caterer/";

// The pre-shard layout. Read once, only by a store that has no manifest, so an
// existing deployment carries its content across the upgrade; the first write
// after that lands as shards and this is never consulted again.
const LEGACY_DATA_FILE = "content.json";

// Presence of this file means "this store has been written in shard form".
// Without it an empty collection directory would be ambiguous — it reads the
// same for a fresh install that must seed from INITIAL_DEFAULTS and for a
// collection the owner deliberately emptied. The manifest settles it.
const MANIFEST_PATH = "manifest.json";
const SHARD_VERSION = 2;

// Collections stored as one file per record, in a directory of that name.
const SHARDED_COLLECTIONS = [
  "packages",
  "gallery",
  "venues",
  "cuisines",
  "services",
  "features",
  "testimonials",
  "leads",
] as const;

// Single-record sections — one file each, no directory.
const SINGLETON_FILES = {
  about: "about.json",
  settings: "settings.json",
  site: "site.json",
} as const;
type SingletonSection = keyof typeof SINGLETON_FILES;

// Hydration fans out over every shard, so it is the one place worth
// parallelising; writes stay lower because a normal save touches one file and
// only the initial flush is wide.
const READ_CONCURRENCY = 16;
const WRITE_CONCURRENCY = 8;

// Record ids arrive in request bodies, so they cannot be trusted as file names:
// an id of "../../settings" would otherwise escape its collection directory and
// overwrite another section. Anything outside [A-Za-z0-9._-] is replaced and a
// leading dot is stripped, so no shard can become a hidden or relative path.
function shardFileName(id: string): string {
  const safe = id.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "_");
  // Sanitising is lossy — two different ids can collapse onto one name, and the
  // loser would silently vanish. A short digest of the original keeps them
  // apart. Ids that were already safe keep their exact name, which is every id
  // this store generates itself.
  if (safe === id && safe.length > 0) return `${id}.json`;
  const digest = crypto.createHash("sha1").update(id).digest("hex").slice(0, 8);
  return `${safe || "id"}-${digest}.json`;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) {
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------------------------------------------------------------------------
// Storage Backend
// ---------------------------------------------------------------------------

// Four primitives are all the shard layer needs. Everything above this line
// works in store-relative paths ("packages/pkg-silver.json") and never learns
// which backend is carrying them.
//
// `read` returns null for a shard that is genuinely not there and throws for
// anything else. That distinction matters more than it looks: a store that
// reads as absent falls back to the seed, and the next admin save would then
// flush the seed over the real content. A network blip must not be able to
// masquerade as an empty store.
type StorageBackend = {
  readonly kind: "fs" | "blob";
  read(rel: string): Promise<string | null>;
  listNames(dir: string): Promise<string[]>;
  write(rel: string, text: string): Promise<void>;
  remove(rel: string): Promise<void>;
};

const fsBackend: StorageBackend = {
  kind: "fs",

  async read(rel) {
    try {
      return await fs.readFile(path.join(DATA_ROOT, rel), "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
      throw err;
    }
  },

  async listNames(dir) {
    try {
      return await fs.readdir(path.join(DATA_ROOT, dir));
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
      throw err;
    }
  },

  async write(rel, text) {
    const full = path.join(DATA_ROOT, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, text, "utf-8");
  },

  async remove(rel) {
    // Already gone is the outcome we wanted.
    await fs.unlink(path.join(DATA_ROOT, rel)).catch(() => {});
  },
};

const blobBackend: StorageBackend = {
  kind: "blob",

  async read(rel) {
    try {
      // `useCache: false` reads origin storage rather than the CDN. Blob's edge
      // cache cannot be set below a minute, and a store that serves content up
      // to a minute stale right after a save is the bug this backend exists to
      // fix — so the shard layer opts out of the cache entirely.
      const res = await get(BLOB_PREFIX + rel, { access: "private", useCache: false });
      // null is how `get` reports a blob that is not there; a 304 needs an
      // ifNoneMatch we never send, so it only shows up as a type possibility.
      if (!res || res.statusCode !== 200) return null;
      return await new Response(res.stream).text();
    } catch (err) {
      if (err instanceof BlobNotFoundError) return null;
      throw err;
    }
  },

  async listNames(dir) {
    const prefix = `${BLOB_PREFIX}${dir}/`;
    const names: string[] = [];
    let cursor: string | undefined;
    // A collection is far short of the 1000-per-page default, but paginating is
    // three lines and a silently truncated listing would read as deleted
    // records.
    do {
      const page = await list({ prefix, cursor });
      for (const blob of page.blobs) names.push(blob.pathname.slice(prefix.length));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return names;
  },

  async write(rel, text) {
    // Private, and the store itself must be created that way: a Blob store's
    // access mode is fixed at creation and applies to everything in it. It has
    // to be private here because the shards include captured leads — visitor
    // names and phone numbers — and a public blob is readable by anyone who can
    // derive its URL, which with addRandomSuffix off is every one of these.
    // Uploaded images share the store and are therefore private too; they are
    // delivered through src/app/uploads/caterer/[filename] rather than by URL.
    await put(BLOB_PREFIX + rel, text, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  },

  async remove(rel) {
    await del(BLOB_PREFIX + rel).catch(() => {});
  },
};

// Blob is chosen by whether a store is attached rather than by VERCEL, so a
// production deploy and a local `vercel env pull` behave the same way, and a
// container with a mounted volume keeps the fs backend by simply not attaching
// one.
//
// Resolved on first use and then memoised, not at module load: the admin gate
// reads its env per request for the same reason, and a module evaluated before
// the platform has injected the environment would otherwise pin the wrong
// backend for the life of the instance.
let backend: StorageBackend | null = null;

function storage(): StorageBackend {
  return (backend ??= isBlobConfigured() ? blobBackend : fsBackend);
}

// ---------------------------------------------------------------------------
// Singleton State
// ---------------------------------------------------------------------------

type StoreState = {
  data: CatererStoreData | null;
  hydration: Promise<void> | null;
  writeQueue: Promise<void>;
  // Store-relative shard path → the exact JSON text last known to be on
  // storage. writeToStorage diffs against this so a save only touches files
  // whose contents actually changed. Empty until hydration fills it, which is
  // what makes the first write after a legacy read flush every shard.
  shards: Map<string, string>;
  // The manifest revision this snapshot was built from, and when storage was
  // last consulted about it. Together they bound how stale a read can be — see
  // revalidate().
  rev: string | null;
  checkedAt: number;
  // Saves in flight. Revalidation may not swap `data` out from under a mutator
  // that is midway through editing it.
  writesInFlight: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __catererStore__: StoreState | undefined;
}

function getState(): StoreState {
  if (!globalThis.__catererStore__) {
    globalThis.__catererStore__ = {
      data: null,
      hydration: null,
      writeQueue: Promise.resolve(),
      shards: new Map(),
      rev: null,
      checkedAt: 0,
      writesInFlight: 0,
    };
  }
  // A dev-server hot reload can carry a state object created before `shards`
  // existed; without this the first save throws on an undefined Map.
  const state = globalThis.__catererStore__;
  state.shards ??= new Map();
  state.rev ??= null;
  state.checkedAt ??= 0;
  state.writesInFlight ??= 0;
  return state;
}

// ---------------------------------------------------------------------------
// Low-level Read / Write Snapshot
// ---------------------------------------------------------------------------

// Read one shard by store-relative path. A shard that is absent, or present but
// unparseable, is `null` — a half-written store degrades to its defaults rather
// than 500ing. A storage error is not caught here: see StorageBackend.read.
async function readShard(rel: string): Promise<{ text: string; value: unknown } | null> {
  const text = await storage().read(rel);
  if (text === null) return null;
  try {
    return { text, value: JSON.parse(text) };
  } catch {
    return null;
  }
}

// Every shard in one collection directory, paired with the path it came from so
// writeToStorage can diff against the exact bytes that are on storage.
async function readCollectionShards(
  dir: string
): Promise<{ rel: string; text: string; value: unknown }[]> {
  const names = await storage().listNames(dir);
  const read = await mapWithConcurrency(
    names.filter((n) => n.endsWith(".json")),
    READ_CONCURRENCY,
    async (name) => {
      const shard = await readShard(`${dir}/${name}`);
      return shard && { rel: `${dir}/${name}`, text: shard.text, value: shard.value };
    }
  );
  return read.filter((r) => r !== null);
}

// The single-file store this layout replaced. Returns null when there is none.
async function readLegacySnapshot(): Promise<Partial<CatererStoreData> | null> {
  const shard = await readShard(LEGACY_DATA_FILE);
  return (shard?.value as Partial<CatererStoreData> | undefined) ?? null;
}

type LoadedSnapshot = {
  snap: Partial<CatererStoreData> | null;
  baseline: Map<string, string>;
};

// Assemble a store-shaped snapshot out of the shard files, or fall back through
// the legacy single file to nothing at all. `baseline` holds the exact text of
// every shard read, and stays empty for the two fallbacks — which is precisely
// what makes the next write flush the whole store into shard form.
async function loadSnapshot(): Promise<LoadedSnapshot> {
  const baseline = new Map<string, string>();
  const manifest = await readShard(MANIFEST_PATH);

  if (!manifest) {
    return { snap: await readLegacySnapshot(), baseline };
  }
  baseline.set(MANIFEST_PATH, manifest.text);

  const snap: Record<string, unknown> = {};

  const collections = await mapWithConcurrency(
    SHARDED_COLLECTIONS,
    SHARDED_COLLECTIONS.length,
    async (name) => ({ name, shards: await readCollectionShards(name) })
  );
  for (const { name, shards } of collections) {
    for (const s of shards) baseline.set(s.rel, s.text);
    const records = shards.map((s) => s.value as Record<string, unknown>);
    // Directory listings come back in whatever order the filesystem feels
    // like. Every read path re-sorts for display, but leads are also
    // trimmed with slice(-MAX_LEADS), which silently drops the wrong ones unless
    // the array is genuinely oldest-first. Sorting here makes hydration
    // deterministic for both.
    records.sort((a, b) =>
      name === "leads"
        ? String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""))
        : Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
          String(a.id ?? "").localeCompare(String(b.id ?? ""))
    );
    snap[name] = records;
  }

  const singletons = await mapWithConcurrency(
    Object.entries(SINGLETON_FILES),
    3,
    async ([section, file]) => ({ section, file, shard: await readShard(file) })
  );
  for (const { section, file, shard } of singletons) {
    if (!shard) continue;
    baseline.set(file, shard.text);
    snap[section] = shard.value;
  }

  return { snap: snap as Partial<CatererStoreData>, baseline };
}

async function readFromStorage(): Promise<{ data: CatererStoreData; baseline: Map<string, string> }> {
  const { snap, baseline } = await loadSnapshot();
  if (!snap) return { data: seededStore(), baseline };
  return { data: normaliseSnapshot(snap), baseline };
}

// A private copy of the seed. Every fallback below goes through this, because
// the value it returns is handed straight to the store and then mutated in
// place by the first create or update — without the clone that edit would land
// on INITIAL_DEFAULTS itself and leak into every later fallback.
function seededStore(): CatererStoreData {
  return structuredClone(INITIAL_DEFAULTS);
}

function seeded<K extends keyof CatererStoreData>(key: K): CatererStoreData[K] {
  return structuredClone(INITIAL_DEFAULTS[key]);
}

// Everything below is shape-repair on a snapshot that may predate the fields the
// current code reads. It is unchanged by sharding: a snapshot assembled from
// shard files and one parsed out of the legacy single file arrive here alike.
function normaliseSnapshot(snap: Partial<CatererStoreData> | null): CatererStoreData {

  // Snapshots written before venues/settings/priceMode existed are still valid
  // on disk. Fill the gaps here so one old file cannot crash a read.
  const packages = Array.isArray(snap?.packages)
    ? (snap!.packages as CatererPackage[]).map((p) => ({
        ...p,
        priceMode: p.priceMode === "quote" ? "quote" : ("amount" as PriceMode),
        basisPax: typeof p.basisPax === "number" && p.basisPax >= 0 ? p.basisPax : 400,
      }))
    : seeded("packages");

  // Venues written before the photo field existed carry no imageUrl; normalise
  // it to "" so every read path can treat it as a plain string.
  const venues = Array.isArray(snap?.venues)
    ? (snap!.venues as CatererVenue[]).map((v) => ({
        ...v,
        imageUrl: typeof v.imageUrl === "string" ? v.imageUrl : "",
      }))
    : seeded("venues");

  // Cuisines, services, features and testimonials each arrived after the first
  // snapshots were written. An absent array means "this store predates the
  // feature", so it seeds from the defaults — an emptied-out collection is
  // saved as [] and stays empty, which only an explicit array in the snapshot
  // can express.
  const cuisines = Array.isArray(snap?.cuisines)
    ? (snap!.cuisines as CatererCuisine[])
    : seeded("cuisines");

  const services = Array.isArray(snap?.services)
    ? (snap!.services as CatererService[])
    : seeded("services");

  const features = Array.isArray(snap?.features)
    ? (snap!.features as CatererFeature[])
    : seeded("features");

  const testimonials = Array.isArray(snap?.testimonials)
    ? (snap!.testimonials as CatererTestimonial[])
    : seeded("testimonials");

  return {
    packages,
    gallery: Array.isArray(snap?.gallery) ? (snap!.gallery as CatererGalleryItem[]) : seeded("gallery"),
    venues,
    cuisines,
    services,
    features,
    testimonials,
    // Leads are visitor-generated, so an absent array means "none captured
    // yet" — never the seed data other collections fall back to.
    leads: Array.isArray(snap?.leads) ? (snap!.leads as CatererLead[]) : [],
    about: snap?.about && typeof snap.about === "object" ? (snap.about as CatererAbout) : seeded("about"),
    settings:
      snap?.settings && typeof snap.settings === "object"
        ? { ...DEFAULT_SETTINGS, ...(snap.settings as CatererSettings) }
        : { ...DEFAULT_SETTINGS },
    site:
      snap?.site && typeof snap.site === "object"
        ? { ...DEFAULT_SITE, ...(snap.site as CatererSite) }
        : { ...DEFAULT_SITE },
  };
}

// The full store expressed as shard path → file contents. Diffing two of these
// is what turns "save the store" into "write the one record that changed".
function buildShardMap(data: CatererStoreData): Map<string, string> {
  const shards = new Map<string, string>();

  for (const name of SHARDED_COLLECTIONS) {
    for (const record of data[name] as { id: string }[]) {
      shards.set(`${name}/${shardFileName(record.id)}`, JSON.stringify(record, null, 2));
    }
  }
  for (const [section, file] of Object.entries(SINGLETON_FILES)) {
    shards.set(file, JSON.stringify(data[section as SingletonSection], null, 2));
  }

  // The manifest carries a digest of every other shard, so one small read tells
  // an instance whether the copy it hydrated is still current — see
  // revalidate(). It is a content hash rather than a timestamp so that a save
  // which changes nothing also changes no shard, and the diff in writeToStorage
  // still collapses to zero writes.
  shards.set(MANIFEST_PATH, JSON.stringify({ version: SHARD_VERSION, rev: revisionOf(shards) }, null, 2));
  return shards;
}

function revisionOf(shards: Map<string, string>): string {
  const hash = crypto.createHash("sha1");
  for (const rel of [...shards.keys()].sort()) {
    hash.update(rel).update("\0").update(shards.get(rel)!).update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

function revisionIn(manifest: unknown): string | null {
  const rev = (manifest as { rev?: unknown } | null)?.rev;
  return typeof rev === "string" ? rev : null;
}

async function deleteShards(rels: string[]): Promise<void> {
  // Already gone is the outcome we wanted; anything else is not worth failing
  // the save the caller already applied in memory — StorageBackend.remove
  // swallows both.
  await mapWithConcurrency(rels, WRITE_CONCURRENCY, (rel) => storage().remove(rel));
}

async function writeToStorage(data: CatererStoreData): Promise<void> {
  const state = getState();
  const desired = buildShardMap(data);
  const previous = state.shards;

  const changed = [...desired].filter(([rel, text]) => previous.get(rel) !== text);
  const removed = [...previous.keys()].filter((rel) => !desired.has(rel));
  if (!changed.length && !removed.length) return;

  // The manifest goes last, on its own. It is what another instance reads to
  // decide whether to re-hydrate, so publishing the new revision before the
  // records behind it have landed would invite exactly the stale-then-correct
  // flicker this is here to remove.
  const records = changed.filter(([rel]) => rel !== MANIFEST_PATH);
  await mapWithConcurrency(records, WRITE_CONCURRENCY, ([rel, text]) => storage().write(rel, text));
  if (removed.length) await deleteShards(removed);
  const manifest = desired.get(MANIFEST_PATH)!;
  if (previous.get(MANIFEST_PATH) !== manifest) await storage().write(MANIFEST_PATH, manifest);

  // Only after every write landed. A throw above leaves the baseline stale, so
  // the next save re-attempts the whole diff instead of assuming it succeeded.
  state.shards = desired;
  // This instance is by definition current with what it just wrote, so its
  // freshness window restarts here rather than at the last hydration.
  state.rev = revisionIn(JSON.parse(manifest));
  state.checkedAt = Date.now();
}

// The hydrated snapshot lives on globalThis, so it outlives a hot reload: a dev
// server that was running before a new section shipped keeps serving a `data`
// with that key missing, and every read path throws on it. readFromStorage
// already fills the gaps for a fresh hydration; this repeats the fill for a
// snapshot that predates the module it is now being read by.
function backfillSections(data: CatererStoreData): CatererStoreData {
  data.packages ??= [];
  data.gallery ??= [];
  data.venues ??= [];
  data.cuisines ??= [];
  data.services ??= [];
  data.features ??= [];
  data.testimonials ??= [];
  data.leads ??= [];
  data.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
  data.site = { ...DEFAULT_SITE, ...(data.site ?? {}) };
  return data;
}

// How long a hydrated snapshot is trusted before storage is asked whether it has
// moved on. The check reads the manifest and nothing else, so it costs one small
// request; what it buys is that a save made on one serverless instance reaches
// every other within this window, instead of surviving there until its next cold
// start. That staleness is what made saved packages look like they vanished:
// the instance that took the edit had it, the instance that answered the next
// page load did not.
const REVALIDATE_MS = 10_000;

// Stands in for "this snapshot cannot be trusted". It is not a valid revision —
// those are hex — so revalidate() always finds it different from what storage
// reports and rebuilds.
const STALE_REV = " stale";

function revFromBaseline(baseline: Map<string, string>): string | null {
  const text = baseline.get(MANIFEST_PATH);
  if (!text) return null;
  try {
    return revisionIn(JSON.parse(text));
  } catch {
    return null;
  }
}

function hydrate(): Promise<void> {
  const s = getState();
  if (!s.hydration) {
    s.hydration = (async () => {
      const { data, baseline } = await readFromStorage();
      s.data = data;
      s.shards = baseline;
      s.rev = revFromBaseline(baseline);
      s.checkedAt = Date.now();
    })().catch((err) => {
      // A rejected hydration must not stay cached, or one failed storage call
      // would poison this instance for every request that follows it.
      s.hydration = null;
      throw err;
    });
  }
  return s.hydration;
}

// Refresh the snapshot if storage has moved on since it was taken. Errors are
// swallowed: an instance holding a slightly stale copy should keep serving it
// rather than 500 because one manifest read failed. `checkedAt` is left alone in
// that case, so the next request tries again.
async function revalidate(): Promise<void> {
  const s = getState();
  if (s.writesInFlight > 0) return;
  if (Date.now() - s.checkedAt < REVALIDATE_MS) return;

  try {
    const manifest = await readShard(MANIFEST_PATH);
    const rev = revisionIn(manifest?.value);
    if (s.writesInFlight > 0) return;
    s.checkedAt = Date.now();
    if (rev === s.rev) return;

    // Read fully, then swap in one go. Clearing `s.hydration` and re-running it
    // instead would let a request still awaiting the previous hydration land its
    // older snapshot on top of this one.
    const { data, baseline } = await readFromStorage();
    if (s.writesInFlight > 0) return;
    s.data = data;
    s.shards = baseline;
    s.rev = revFromBaseline(baseline);
    s.checkedAt = Date.now();
  } catch {
    return;
  }
}

async function ensureHydrated(): Promise<void> {
  const s = getState();
  await hydrate();
  await revalidate();
  if (s.data) backfillSections(s.data);
}

function mutateStore<T>(mutator: (data: CatererStoreData) => T | Promise<T>): Promise<T> {
  const s = getState();
  const run = s.writeQueue.then(async () => {
    // Before the flag goes up, so a save that follows another instance's edit
    // starts from that edit rather than overwriting the store's view of it.
    await ensureHydrated();
    s.writesInFlight++;
    try {
      const result = await mutator(s.data!);
      await writeToStorage(s.data!);
      return result;
    } catch (err) {
      // The mutator has already applied its change in memory. If the write did
      // not land, that change is a phantom the admin would be shown as saved —
      // so mark the snapshot stale and let the next read rebuild it from
      // storage. A sentinel rather than null, because null is also the honest
      // revision of a store that has never been written.
      s.rev = STALE_REV;
      s.checkedAt = 0;
      throw err;
    } finally {
      s.writesInFlight--;
    }
  });
  // The queue must stay chainable whichever way this settles: one failed save
  // rejecting it would block every save after it for the life of the instance.
  s.writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// ---------------------------------------------------------------------------
// Store Operations (Packages)
// ---------------------------------------------------------------------------

export async function getAllPackages(): Promise<CatererPackage[]> {
  await ensureHydrated();
  const data = getState().data!;
  return [...data.packages].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getPackageById(id: string): Promise<CatererPackage | null> {
  await ensureHydrated();
  const data = getState().data!;
  return data.packages.find((p) => p.id === id) ?? null;
}

export async function createPackage(
  input: Omit<CatererPackage, "id"> & { id?: string }
): Promise<CatererPackage> {
  return mutateStore((data) => {
    const now = new Date().toISOString();
    const newPkg: CatererPackage = {
      ...input,
      id: input.id || `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    data.packages.push(newPkg);
    return newPkg;
  });
}

export async function updatePackage(
  id: string,
  updates: Partial<CatererPackage>
): Promise<CatererPackage | null> {
  return mutateStore((data) => {
    const idx = data.packages.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const existing = data.packages[idx];
    const updated: CatererPackage = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable
      updatedAt: new Date().toISOString(),
    };
    data.packages[idx] = updated;
    return updated;
  });
}

export async function deletePackage(id: string): Promise<boolean> {
  return mutateStore((data) => {
    const initialLen = data.packages.length;
    data.packages = data.packages.filter((p) => p.id !== id);
    return data.packages.length < initialLen;
  });
}

// ---------------------------------------------------------------------------
// Store Operations (Gallery)
// ---------------------------------------------------------------------------

export async function getAllGalleryItems(): Promise<CatererGalleryItem[]> {
  await ensureHydrated();
  const data = getState().data!;
  return [...data.gallery].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getGalleryItemById(id: string): Promise<CatererGalleryItem | null> {
  await ensureHydrated();
  const data = getState().data!;
  return data.gallery.find((g) => g.id === id) ?? null;
}

export async function createGalleryItem(
  input: Omit<CatererGalleryItem, "id"> & { id?: string }
): Promise<CatererGalleryItem> {
  return mutateStore((data) => {
    const now = new Date().toISOString();
    const newItem: CatererGalleryItem = {
      ...input,
      id: input.id || `gal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    data.gallery.push(newItem);
    return newItem;
  });
}

export async function updateGalleryItem(
  id: string,
  updates: Partial<CatererGalleryItem>
): Promise<CatererGalleryItem | null> {
  return mutateStore((data) => {
    const idx = data.gallery.findIndex((g) => g.id === id);
    if (idx === -1) return null;

    const existing = data.gallery[idx];
    const updated: CatererGalleryItem = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };
    data.gallery[idx] = updated;
    return updated;
  });
}

export async function deleteGalleryItem(id: string): Promise<boolean> {
  return mutateStore((data) => {
    const initialLen = data.gallery.length;
    data.gallery = data.gallery.filter((g) => g.id !== id);
    return data.gallery.length < initialLen;
  });
}

// ---------------------------------------------------------------------------
// Store Operations (Venues)
// ---------------------------------------------------------------------------

export async function getAllVenues(): Promise<CatererVenue[]> {
  await ensureHydrated();
  const data = getState().data!;
  return [...data.venues].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getVenueById(id: string): Promise<CatererVenue | null> {
  await ensureHydrated();
  const data = getState().data!;
  return data.venues.find((v) => v.id === id) ?? null;
}

export async function createVenue(
  input: Omit<CatererVenue, "id"> & { id?: string }
): Promise<CatererVenue> {
  return mutateStore((data) => {
    const now = new Date().toISOString();
    const newVenue: CatererVenue = {
      ...input,
      id: input.id || `ven-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    data.venues.push(newVenue);
    return newVenue;
  });
}

export async function updateVenue(
  id: string,
  updates: Partial<CatererVenue>
): Promise<CatererVenue | null> {
  return mutateStore((data) => {
    const idx = data.venues.findIndex((v) => v.id === id);
    if (idx === -1) return null;

    const existing = data.venues[idx];
    const updated: CatererVenue = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable
      updatedAt: new Date().toISOString(),
    };
    data.venues[idx] = updated;
    return updated;
  });
}

export async function deleteVenue(id: string): Promise<boolean> {
  return mutateStore((data) => {
    const initialLen = data.venues.length;
    data.venues = data.venues.filter((v) => v.id !== id);
    return data.venues.length < initialLen;
  });
}

// ---------------------------------------------------------------------------
// Store Operations (Photo-card collections: Cuisines, Services, Features)
// ---------------------------------------------------------------------------

// All three collections hold the same record and need the same five
// operations, so they are written once and bound to a collection key. The
// per-collection names below are what the API routes import — the indirection
// stays inside this file.
function photoCardOps(collection: PhotoCardCollection, idPrefix: string) {
  return {
    async getAll(): Promise<CatererPhotoCard[]> {
      await ensureHydrated();
      const data = getState().data!;
      return [...data[collection]].sort((a, b) => a.sortOrder - b.sortOrder);
    },

    async getById(id: string): Promise<CatererPhotoCard | null> {
      await ensureHydrated();
      const data = getState().data!;
      return data[collection].find((c) => c.id === id) ?? null;
    },

    async create(
      input: Omit<CatererPhotoCard, "id"> & { id?: string }
    ): Promise<CatererPhotoCard> {
      return mutateStore((data) => {
        const now = new Date().toISOString();
        const created: CatererPhotoCard = {
          ...input,
          id: input.id || `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: now,
          updatedAt: now,
        };
        data[collection].push(created);
        return created;
      });
    },

    async update(
      id: string,
      updates: Partial<CatererPhotoCard>
    ): Promise<CatererPhotoCard | null> {
      return mutateStore((data) => {
        const idx = data[collection].findIndex((c) => c.id === id);
        if (idx === -1) return null;

        const existing = data[collection][idx];
        const updated: CatererPhotoCard = {
          ...existing,
          ...updates,
          id: existing.id, // Immutable
          updatedAt: new Date().toISOString(),
        };
        data[collection][idx] = updated;
        return updated;
      });
    },

    async remove(id: string): Promise<boolean> {
      return mutateStore((data) => {
        const initialLen = data[collection].length;
        data[collection] = data[collection].filter((c) => c.id !== id);
        return data[collection].length < initialLen;
      });
    },
  };
}

const cuisineOps = photoCardOps("cuisines", "cui");
const serviceOps = photoCardOps("services", "srv");
const featureOps = photoCardOps("features", "feat");

export const getAllCuisines = cuisineOps.getAll;
export const getCuisineById = cuisineOps.getById;
export const createCuisine = cuisineOps.create;
export const updateCuisine = cuisineOps.update;
export const deleteCuisine = cuisineOps.remove;

export const getAllServices = serviceOps.getAll;
export const getServiceById = serviceOps.getById;
export const createService = serviceOps.create;
export const updateService = serviceOps.update;
export const deleteService = serviceOps.remove;

export const getAllFeatures = featureOps.getAll;
export const getFeatureById = featureOps.getById;
export const createFeature = featureOps.create;
export const updateFeature = featureOps.update;
export const deleteFeature = featureOps.remove;

// Bound by collection name so an API route can resolve its own operations from
// its URL segment without a switch at every call site.
export const PHOTO_CARD_OPS: Record<PhotoCardCollection, ReturnType<typeof photoCardOps>> = {
  cuisines: cuisineOps,
  services: serviceOps,
  features: featureOps,
};

// ---------------------------------------------------------------------------
// Store Operations (Testimonials)
// ---------------------------------------------------------------------------

export async function getAllTestimonials(): Promise<CatererTestimonial[]> {
  await ensureHydrated();
  const data = getState().data!;
  return [...data.testimonials].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getTestimonialById(id: string): Promise<CatererTestimonial | null> {
  await ensureHydrated();
  const data = getState().data!;
  return data.testimonials.find((t) => t.id === id) ?? null;
}

export async function createTestimonial(
  input: Omit<CatererTestimonial, "id"> & { id?: string }
): Promise<CatererTestimonial> {
  return mutateStore((data) => {
    const now = new Date().toISOString();
    const newItem: CatererTestimonial = {
      ...input,
      id: input.id || `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    data.testimonials.push(newItem);
    return newItem;
  });
}

export async function updateTestimonial(
  id: string,
  updates: Partial<CatererTestimonial>
): Promise<CatererTestimonial | null> {
  return mutateStore((data) => {
    const idx = data.testimonials.findIndex((t) => t.id === id);
    if (idx === -1) return null;

    const existing = data.testimonials[idx];
    const updated: CatererTestimonial = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable
      updatedAt: new Date().toISOString(),
    };
    data.testimonials[idx] = updated;
    return updated;
  });
}

export async function deleteTestimonial(id: string): Promise<boolean> {
  return mutateStore((data) => {
    const initialLen = data.testimonials.length;
    data.testimonials = data.testimonials.filter((t) => t.id !== id);
    return data.testimonials.length < initialLen;
  });
}

// ---------------------------------------------------------------------------
// Store Operations (Leads)
// ---------------------------------------------------------------------------

// The entire store is one JSON document rewritten on every mutation, and the
// lead-capture endpoint is public — an uncapped list would let visitors grow
// the document until every read and write slows down. Oldest rows drop first.
const MAX_LEADS = 1000;

export type CatererLeadInput = Omit<
  CatererLead,
  "id" | "status" | "createdAt" | "updatedAt"
>;

export async function getAllLeads(): Promise<CatererLead[]> {
  await ensureHydrated();
  const data = getState().data!;
  // Newest first: an owner works the top of an enquiry list, not the bottom.
  return [...data.leads].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function getLeadById(id: string): Promise<CatererLead | null> {
  await ensureHydrated();
  const data = getState().data!;
  return data.leads.find((l) => l.id === id) ?? null;
}

export async function createLead(input: CatererLeadInput): Promise<CatererLead> {
  return mutateStore((data) => {
    const now = new Date().toISOString();

    // Subscribing twice must not pile up rows, so a repeat newsletter signup
    // folds into the existing record (and fills in a phone number the first
    // attempt lacked). Inquiries always get their own row — each one carries a
    // different message and deserves to be worked separately.
    if (input.source === "newsletter") {
      const email = input.email.toLowerCase();
      const existing = data.leads.find(
        (l) =>
          l.source === "newsletter" &&
          ((email && l.email.toLowerCase() === email) ||
            (!email && !!input.phone && l.phone === input.phone))
      );
      if (existing) {
        existing.email = input.email || existing.email;
        existing.phone = input.phone || existing.phone;
        existing.name = input.name || existing.name;
        existing.updatedAt = now;
        return existing;
      }
    }

    const lead: CatererLead = {
      ...input,
      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: "new",
      createdAt: now,
      updatedAt: now,
    };
    data.leads.push(lead);
    if (data.leads.length > MAX_LEADS) {
      data.leads = data.leads.slice(-MAX_LEADS);
    }
    return lead;
  });
}

export async function updateLead(
  id: string,
  updates: Partial<Pick<CatererLead, "status">>
): Promise<CatererLead | null> {
  return mutateStore((data) => {
    const idx = data.leads.findIndex((l) => l.id === id);
    if (idx === -1) return null;

    const updated: CatererLead = {
      ...data.leads[idx],
      ...updates,
      id: data.leads[idx].id,
      updatedAt: new Date().toISOString(),
    };
    data.leads[idx] = updated;
    return updated;
  });
}

export async function deleteLead(id: string): Promise<boolean> {
  return mutateStore((data) => {
    const initialLen = data.leads.length;
    data.leads = data.leads.filter((l) => l.id !== id);
    return data.leads.length < initialLen;
  });
}

// ---------------------------------------------------------------------------
// Store Operations (Settings / Branding)
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<CatererSettings> {
  await ensureHydrated();
  return getState().data!.settings;
}

export async function updateSettings(
  updates: Partial<CatererSettings>
): Promise<CatererSettings> {
  return mutateStore((data) => {
    data.settings = {
      ...data.settings,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return data.settings;
  });
}

// ---------------------------------------------------------------------------
// Store Operations (Site Content)
// ---------------------------------------------------------------------------

export async function getSiteContent(): Promise<CatererSite> {
  await ensureHydrated();
  return getState().data!.site;
}

export async function updateSiteContent(
  updates: Partial<CatererSite>
): Promise<CatererSite> {
  return mutateStore((data) => {
    data.site = {
      ...data.site,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return data.site;
  });
}

// ---------------------------------------------------------------------------
// Store Operations (About)
// ---------------------------------------------------------------------------

export async function getAboutRecord(): Promise<CatererAbout> {
  await ensureHydrated();
  return getState().data!.about;
}

export async function updateAboutRecord(updates: Partial<CatererAbout>): Promise<CatererAbout> {
  return mutateStore((data) => {
    const now = new Date().toISOString();
    data.about = {
      ...data.about,
      ...updates,
      id: "default",
      slug: "default",
      updatedAt: now,
    };
    return data.about;
  });
}

// ---------------------------------------------------------------------------
// Public Content Summary Function
// ---------------------------------------------------------------------------

export async function getCatererContentPublic() {
  await ensureHydrated();
  const data = getState().data!;
  const packages = data.packages
    .filter((p) => p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameHi: p.nameHi,
      price: p.price,
      priceMode: p.priceMode ?? "amount",
      basisPax: p.basisPax ?? 400,
      priceUnitEn: p.priceUnitEn,
      priceUnitHi: p.priceUnitHi,
      badgeEn: p.badgeEn,
      badgeHi: p.badgeHi,
      featuresEn: p.featuresEn,
      featuresHi: p.featuresHi,
      sortOrder: p.sortOrder,
    }));

  const gallery = data.gallery
    .filter((g) => g.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({
      id: g.id,
      imageUrl: g.imageUrl,
      captionEn: g.captionEn,
      captionHi: g.captionHi,
      sortOrder: g.sortOrder,
    }));

  const venues = data.venues
    .filter((v) => v.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => ({
      id: v.id,
      nameEn: v.nameEn,
      nameHi: v.nameHi,
      areaEn: v.areaEn,
      areaHi: v.areaHi,
      capacity: v.capacity,
      imageUrl: v.imageUrl ?? "",
      notesEn: v.notesEn,
      notesHi: v.notesHi,
      sortOrder: v.sortOrder,
    }));

  // Cuisines, services and features are the same card, so one projection
  // serves all three.
  const publicPhotoCards = (items: CatererPhotoCard[]) =>
    items
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        id: c.id,
        nameEn: c.nameEn,
        nameHi: c.nameHi,
        descEn: c.descEn,
        descHi: c.descHi,
        imageUrl: c.imageUrl ?? "",
        sortOrder: c.sortOrder,
      }));

  const cuisines = publicPhotoCards(data.cuisines);
  const services = publicPhotoCards(data.services);
  const features = publicPhotoCards(data.features);

  const testimonials = data.testimonials
    .filter((t) => t.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      id: t.id,
      quoteEn: t.quoteEn,
      quoteHi: t.quoteHi,
      authorName: t.authorName,
      eventEn: t.eventEn,
      eventHi: t.eventHi,
      rating: t.rating,
      sortOrder: t.sortOrder,
    }));

  return {
    packages,
    gallery,
    venues,
    cuisines,
    services,
    features,
    testimonials,
    about: data.about,
    settings: data.settings,
    site: data.site,
  };
}
