// Seed / Import script for sample-caterer CMS database content.
//
// Idempotent data migration script that extracts existing hardcoded content
// from public/sample-caterer/index.html (bilingual EN/HI content) and populates
// the PostgreSQL database via Prisma without creating duplicates or overwriting
// existing admin modifications.
//
// Usage:
//   node scripts/seed-caterer.mjs

import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ---------------------------------------------------------------------------
// Environment Loader (.env / .env.local / .env.preprod / .env.prod)
// ---------------------------------------------------------------------------
function loadEnv() {
  const root = process.cwd();
  const envFiles = [".env.local", ".env.preprod", ".env.prod", ".env"];
  for (const file of envFiles) {
    const fullPath = path.join(root, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqPos = trimmed.indexOf("=");
        if (eqPos > 0) {
          const key = trimmed.slice(0, eqPos).trim();
          let value = trimmed.slice(eqPos + 1).trim();
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Supabase Root CA for Postgres TLS (Same as src/lib/supabase-ca.ts)
// ---------------------------------------------------------------------------
const SUPABASE_ROOT_CA_2021 = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
ZHBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

function createPrismaClient() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set in environment or .env file. Please configure process.env.DATABASE_URL before running the seed script."
    );
  }
  let connectionString = raw;
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    connectionString = u.toString();
  } catch {
    /* not a parseable URL */
  }
  const adapter = new PrismaPg({
    connectionString,
    ssl: {
      ca: [...tls.rootCertificates, SUPABASE_ROOT_CA_2021],
      rejectUnauthorized: true,
    },
  });
  return new PrismaClient({ adapter });
}

// ---------------------------------------------------------------------------
// Seed Data extracted from public/sample-caterer/index.html & i18nDict
// ---------------------------------------------------------------------------

const SEED_PACKAGES = [
  {
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
];

const SEED_GALLERY = [
  {
    imageUrl: "https://images.unsplash.com/photo-1555244162-803834f70033?w=600&q=80",
    captionEn: "Premium Buffet Setup",
    captionHi: "प्रीमियम बफे सेटअप",
    sortOrder: 1,
    isActive: true,
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1530062845289-9109b2c9c868?w=600&q=80",
    captionEn: "Wedding Feast",
    captionHi: "वेडिंग दावत",
    sortOrder: 2,
    isActive: true,
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1567521464027-f127ff144326?w=600&q=80",
    captionEn: "Event Catering",
    captionHi: "इवेंट कैटरिंग",
    sortOrder: 3,
    isActive: true,
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80",
    captionEn: "Live Food Counter",
    captionHi: "लाइव फूड काउंटर",
    sortOrder: 4,
    isActive: true,
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
    captionEn: "Traditional Dishes",
    captionHi: "पारंपरिक व्यंजन",
    sortOrder: 5,
    isActive: true,
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=600&q=80",
    captionEn: "Banquet Arrangement",
    captionHi: "बैंक्वेट सजावट",
    sortOrder: 6,
    isActive: true,
  },
];

const SEED_ABOUT = {
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
};

// ---------------------------------------------------------------------------
// Main Seed Function
// ---------------------------------------------------------------------------
async function main() {
  console.log("=================================================");
  console.log(" Starting sample-caterer CMS Database Seed/Import");
  console.log("=================================================");

  const prisma = createPrismaClient();

  try {
    // 1. Seed Packages
    console.log("\n--- [1/3] Processing Packages ---");
    let packagesCreated = 0;
    let packagesSkipped = 0;

    for (const pkg of SEED_PACKAGES) {
      const existing = await prisma.catererPackage.findFirst({
        where: { nameEn: pkg.nameEn },
      });
      if (existing) {
        console.log(`[Package] Exists: '${pkg.nameEn}' — skipping (preserving existing data).`);
        packagesSkipped++;
      } else {
        const created = await prisma.catererPackage.create({ data: pkg });
        console.log(`[Package] Created: '${created.nameEn}' (id: ${created.id}, price: ₹${created.price})`);
        packagesCreated++;
      }
    }

    // 2. Seed Gallery
    console.log("\n--- [2/3] Processing Gallery Items ---");
    let galleryCreated = 0;
    let gallerySkipped = 0;

    for (const item of SEED_GALLERY) {
      const existing = await prisma.catererGalleryItem.findFirst({
        where: { imageUrl: item.imageUrl },
      });
      if (existing) {
        console.log(`[Gallery] Exists: '${item.captionEn}' — skipping (preserving existing data).`);
        gallerySkipped++;
      } else {
        const created = await prisma.catererGalleryItem.create({ data: item });
        console.log(`[Gallery] Created: '${created.captionEn}' (id: ${created.id})`);
        galleryCreated++;
      }
    }

    // 3. Seed About
    console.log("\n--- [3/3] Processing About Section ---");
    let aboutStatus = "skipped";
    const existingAbout = await prisma.catererAbout.findUnique({
      where: { slug: "default" },
    });

    if (existingAbout) {
      console.log("[About] Default record 'slug=default' already exists — skipping (preserving existing data).");
      aboutStatus = "already exists";
    } else {
      const createdAbout = await prisma.catererAbout.create({
        data: SEED_ABOUT,
      });
      console.log(`[About] Created default record (id: ${createdAbout.id}, year: ${createdAbout.establishedYear}).`);
      aboutStatus = "created";
    }

    console.log("\n=================================================");
    console.log(" Seed / Import Execution Summary:");
    console.log(` - Packages: ${packagesCreated} created, ${packagesSkipped} skipped`);
    console.log(` - Gallery Items: ${galleryCreated} created, ${gallerySkipped} skipped`);
    console.log(` - About Record: ${aboutStatus}`);
    console.log("=================================================\n");
  } catch (err) {
    console.error("\n[Seed Error] Failed to execute seed script:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
