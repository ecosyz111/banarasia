// Caterer CMS persistence — Dual-mode JSON/Vercel-Blob backend.
//
// Switches automatically based on BLOB_READ_WRITE_TOKEN:
//   - Token set:   Vercel Blob at key `system/caterer/content.json`
//   - Token unset: Local JSON file at `data/caterer/content.json` (/tmp on Vercel)
//
// Initial defaults (3 packages, 6 gallery items, 1 About record) are loaded
// from Banarasia website content if no store file exists yet.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { head, put } from "@vercel/blob";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CatererPackage = {
  id: string;
  nameEn: string;
  nameHi: string;
  price: number;
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

export type CatererStoreData = {
  packages: CatererPackage[];
  gallery: CatererGalleryItem[];
  about: CatererAbout;
};

// ---------------------------------------------------------------------------
// Initial Defaults (Banarasia extracted data)
// ---------------------------------------------------------------------------

const INITIAL_DEFAULTS: CatererStoreData = {
  packages: [
    {
      id: "pkg-silver",
      nameEn: "Silver Package",
      nameHi: "सिल्वर पैकेज",
      price: 900,
      priceUnitEn: "/ Plate",
      priceUnitHi: "/ प्लेट",
      badgeEn: "Popular",
      badgeHi: "लोकप्रिय",
      featuresEn: [
        "Standard Buffet Setup",
        "Service Staff Included",
        "Quality Tableware",
        "8+ Dishes Menu",
        "Jain Food Available",
      ],
      featuresHi: [
        "स्टैंडर्ड बफे सेटअप",
        "सर्विस स्टाफ शामिल",
        "उत्कृष्ट बर्तन व क्रॉकरी",
        "8+ व्यंजन मेनू",
        "जैन भोजन उपलब्ध",
      ],
      sortOrder: 1,
      isActive: true,
    },
    {
      id: "pkg-gold",
      nameEn: "Gold Package",
      nameHi: "गोल्ड पैकेज",
      price: 1200,
      priceUnitEn: "/ Plate",
      priceUnitHi: "/ प्लेट",
      badgeEn: "Best for Weddings",
      badgeHi: "शादियों के लिए बेस्ट",
      featuresEn: [
        "Premium Buffet Setup",
        "Professional Service Staff",
        "Premium Tableware",
        "2 Live Food Counters",
        "12+ Dishes Menu",
        "Jain & Custom Options",
      ],
      featuresHi: [
        "प्रीमियम बफे सेटअप",
        "प्रोफेशनल सर्विस स्टाफ",
        "प्रीमियम क्रॉकरी",
        "2 लाइव फूड काउंटर",
        "12+ व्यंजन मेनू",
        "जैन एवं कस्टम विकल्प",
      ],
      sortOrder: 2,
      isActive: true,
    },
    {
      id: "pkg-royal",
      nameEn: "Royal Package",
      nameHi: "रॉयल पैकेज",
      price: 1500,
      priceUnitEn: "/ Plate",
      priceUnitHi: "/ प्लेट",
      badgeEn: "Premium Choice",
      badgeHi: "शाही पसंद",
      featuresEn: [
        "Royal Luxury Setup",
        "Dedicated Service Team",
        "Designer Tableware",
        "4+ Live Food Counters",
        "18+ Dishes + Desserts",
        "Full Customization",
      ],
      featuresHi: [
        "रॉयल लक्जरी सेटअप",
        "समर्पित सर्विस टीम",
        "डिजाइनर क्रॉकरी",
        "4+ लाइव फूड काउंटर",
        "18+ व्यंजन + मिठाइयां",
        "पूर्ण कस्टमाइजेशन",
      ],
      sortOrder: 3,
      isActive: true,
    },
  ],
  gallery: [
    {
      id: "gal-1",
      imageUrl: "https://images.unsplash.com/photo-1555244162-803834f70033?w=600&q=80",
      captionEn: "Premium Buffet Setup",
      captionHi: "प्रीमियम बफे सेटअप",
      sortOrder: 1,
      isActive: true,
    },
    {
      id: "gal-2",
      imageUrl: "https://images.unsplash.com/photo-1530062845289-9109b2c9c868?w=600&q=80",
      captionEn: "Wedding Feast",
      captionHi: "वेडिंग दावत",
      sortOrder: 2,
      isActive: true,
    },
    {
      id: "gal-3",
      imageUrl: "https://images.unsplash.com/photo-1567521464027-f127ff144326?w=600&q=80",
      captionEn: "Event Catering",
      captionHi: "इवेंट कैटरिंग",
      sortOrder: 3,
      isActive: true,
    },
    {
      id: "gal-4",
      imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
      captionEn: "Live Food Counter",
      captionHi: "लाइव फूड काउंटर",
      sortOrder: 4,
      isActive: true,
    },
    {
      id: "gal-5",
      imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
      captionEn: "Traditional Dishes",
      captionHi: "पारंपरिक व्यंजन",
      sortOrder: 5,
      isActive: true,
    },
    {
      id: "gal-6",
      imageUrl: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=600&q=80",
      captionEn: "Banquet Arrangement",
      captionHi: "बैंक्वेट सजावट",
      sortOrder: 6,
      isActive: true,
    },
  ],
  about: {
    id: "default",
    slug: "default",
    storyTitleEn: "Our Story",
    storyTitleHi: "हमारी कहानी",
    titleEn: "Crafting Memorable Celebrations",
    titleHi: "यादगार उत्सवों का भव्य निर्माण",
    descriptionEn:
      "We are serving fresh food with good service for more than 10 years. Har event mein humari koshish hoti hai ki aapke mehman khush hokar jaayein.",
    descriptionHi:
      "हम 10 से अधिक वर्षों से ताज़ा भोजन और उत्तम सेवा प्रदान कर रहे हैं। हर इवेंट में हमारी कोशिश होती है कि आपके मेहमान खुश होकर जाएं।",
    mottoEn: '"Swad Adab Se Chakhayenge"',
    mottoHi: '"स्वाद अदब से चखायेंगे"',
    subMottoEn: "That's why we proudly say",
    subMottoHi: "इसलिए हम गर्व से कहते हैं",
    establishedYear: 2015,
    stats: [
      { labelEn: "Since", labelHi: "स्थापना वर्ष", value: "2015" },
      { labelEn: "Events Done", labelHi: "सफल कार्यक्रम", value: "500+" },
      { labelEn: "Guest Capacity", labelHi: "मेहमान क्षमता", value: "10,000+" },
      { labelEn: "% Happy Clients", labelHi: "% संतुष्ट ग्राहक", value: "98%" },
    ],
    expertise: [
      { textEn: "Wedding & More", textHi: "वेडिंग एवं अन्य आयोजन" },
      { textEn: "Home Parties", textHi: "होम पार्टीज़" },
      { textEn: "Special Baina Boxes", textHi: "स्पेशल बयना बॉक्स" },
      { textEn: "Corporate Parties", textHi: "कॉर्पोरेट पार्टीज़" },
      { textEn: "Single Food Stall", textHi: "सिंगल फूड स्टॉल" },
      { textEn: "Bulk Food Boxes", textHi: "थोक भोजन डिब्बे" },
    ],
  },
};

// ---------------------------------------------------------------------------
// File & Blob Paths
// ---------------------------------------------------------------------------

const DATA_FILE = process.env.VERCEL
  ? path.join("/tmp", "caterer", "content.json")
  : path.join(process.cwd(), "data", "caterer", "content.json");

const BLOB_KEY = "system/caterer/content.json";

function isBlobEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

// ---------------------------------------------------------------------------
// Singleton State
// ---------------------------------------------------------------------------

type StoreState = {
  data: CatererStoreData | null;
  hydration: Promise<void> | null;
  writeQueue: Promise<void>;
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
    };
  }
  return globalThis.__catererStore__;
}

// ---------------------------------------------------------------------------
// Low-level Read / Write Snapshot
// ---------------------------------------------------------------------------

async function readFromStorage(): Promise<CatererStoreData> {
  let parsed: unknown;
  if (isBlobEnabled()) {
    try {
      const meta = await head(BLOB_KEY);
      if (!meta?.url) return INITIAL_DEFAULTS;
      const res = await fetch(meta.url, { cache: "no-store" });
      if (!res.ok) return INITIAL_DEFAULTS;
      parsed = await res.json();
    } catch {
      return INITIAL_DEFAULTS;
    }
  } else {
    try {
      const buf = await fs.readFile(DATA_FILE, "utf-8");
      parsed = JSON.parse(buf);
    } catch {
      return INITIAL_DEFAULTS;
    }
  }

  const snap = parsed as Partial<CatererStoreData> | null;
  return {
    packages: Array.isArray(snap?.packages) ? (snap!.packages as CatererPackage[]) : INITIAL_DEFAULTS.packages,
    gallery: Array.isArray(snap?.gallery) ? (snap!.gallery as CatererGalleryItem[]) : INITIAL_DEFAULTS.gallery,
    about: snap?.about && typeof snap.about === "object" ? (snap.about as CatererAbout) : INITIAL_DEFAULTS.about,
  };
}

async function writeToStorage(data: CatererStoreData): Promise<void> {
  if (isBlobEnabled()) {
    await put(BLOB_KEY, JSON.stringify(data, null, 2), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
    return;
  }

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function ensureHydrated(): Promise<void> {
  const s = getState();
  if (!s.hydration) {
    s.hydration = (async () => {
      s.data = await readFromStorage();
    })();
  }
  return s.hydration;
}

function mutateStore<T>(mutator: (data: CatererStoreData) => T | Promise<T>): Promise<T> {
  const s = getState();
  let result: T;
  s.writeQueue = s.writeQueue.then(async () => {
    await ensureHydrated();
    result = await mutator(s.data!);
    await writeToStorage(s.data!);
  });
  return s.writeQueue.then(() => result);
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

  return {
    packages,
    gallery,
    about: data.about,
  };
}
