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

// A cuisine tile in the "Cuisine Specialization" grid. An empty imageUrl is
// meaningful rather than missing: it renders the gradient "Custom Menu" card
// the page has always ended the grid with.
export type CatererCuisine = {
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
  whatsappNumber: "919918629017",
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
// Initial Defaults (Banarasia extracted data)
// ---------------------------------------------------------------------------

const INITIAL_DEFAULTS: CatererStoreData = {
  packages: [
    {
      id: "pkg-silver",
      nameEn: "Silver Package",
      nameHi: "सिल्वर पैकेज",
      price: 900,
      // Listed, not hidden — the basisPax badge already tells the visitor the
      // rate is costed against a gathering size, so the figure can be shown.
      priceMode: "amount",
      basisPax: 400,
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
      priceMode: "amount",
      basisPax: 400,
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
      priceMode: "amount",
      basisPax: 400,
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
  venues: [
    {
      id: "ven-1",
      nameEn: "Banarasia Lawn",
      nameHi: "बनारसिया लॉन",
      areaEn: "Gomti Nagar, Lucknow",
      areaHi: "गोमती नगर, लखनऊ",
      capacity: "500-800",
      imageUrl:
        "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80",
      notesEn: "Open lawn with covered dining area and ample parking.",
      notesHi: "खुला लॉन, ढका हुआ डाइनिंग क्षेत्र एवं पर्याप्त पार्किंग।",
      sortOrder: 1,
      isActive: true,
    },
    {
      id: "ven-2",
      nameEn: "Banquet Hall",
      nameHi: "बैंक्वेट हॉल",
      areaEn: "Hazratganj, Lucknow",
      areaHi: "हजरतगंज, लखनऊ",
      capacity: "200-400",
      imageUrl:
        "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&q=80",
      notesEn: "Fully air-conditioned indoor hall, ideal for receptions.",
      notesHi: "पूर्ण वातानुकूलित इनडोर हॉल, रिसेप्शन के लिए आदर्श।",
      sortOrder: 2,
      isActive: true,
    },
    {
      id: "ven-3",
      nameEn: "Your Own Venue",
      nameHi: "आपका अपना वेन्यू",
      areaEn: "Anywhere in Lucknow & nearby",
      areaHi: "लखनऊ एवं आसपास कहीं भी",
      capacity: "50-2000",
      imageUrl:
        "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800&q=80",
      notesEn: "We bring the full setup, staff and live counters to your location.",
      notesHi: "हम पूरा सेटअप, स्टाफ एवं लाइव काउंटर आपके स्थान पर लाते हैं।",
      sortOrder: 3,
      isActive: true,
    },
  ],
  cuisines: [
    {
      id: "cui-north-indian",
      nameEn: "North Indian",
      nameHi: "नॉर्थ इंडियन",
      descEn: "Rich curries & tandoor specials",
      descHi: "स्वादिष्ट ग्रेवी और तंदूर स्पेशल",
      imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80",
      sortOrder: 1,
      isActive: true,
    },
    {
      id: "cui-south-indian",
      nameEn: "South Indian",
      nameHi: "साउथ इंडियन",
      descEn: "Authentic dosas & idlis",
      descHi: "प्रामाणिक डोसा और इडली",
      imageUrl: "https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&q=80",
      sortOrder: 2,
      isActive: true,
    },
    {
      id: "cui-chinese",
      nameEn: "Chinese",
      nameHi: "चाइनीज",
      descEn: "Indo-Chinese favorites",
      descHi: "इंडो-चाइनीज पसंदीदा व्यंजन",
      imageUrl: "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=400&q=80",
      sortOrder: 3,
      isActive: true,
    },
    {
      id: "cui-continental",
      nameEn: "Continental",
      nameHi: "कॉन्टिनेंटल",
      descEn: "Elegant international flavors",
      descHi: "अंतर्राष्ट्रीय स्वाद",
      imageUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80",
      sortOrder: 4,
      isActive: true,
    },
    {
      id: "cui-mughlai",
      nameEn: "Mughlai",
      nameHi: "मुगलई",
      descEn: "Royal Mughlai delicacies",
      descHi: "शाही मुगलई पकवान",
      imageUrl: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=400&q=80",
      sortOrder: 5,
      isActive: true,
    },
    {
      id: "cui-punjabi",
      nameEn: "Punjabi",
      nameHi: "पंजाबी",
      descEn: "Hearty Punjabi tadka",
      descHi: "चटपटा पंजाबी तड़का",
      imageUrl: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400&q=80",
      sortOrder: 6,
      isActive: true,
    },
    {
      id: "cui-bengali",
      nameEn: "Bengali",
      nameHi: "बंगाली",
      descEn: "Sweet & savory classics",
      descHi: "मीठे और नमकीन पारंपरिक व्यंजन",
      imageUrl: "https://images.unsplash.com/photo-1567337710282-00832b415979?w=400&q=80",
      sortOrder: 7,
      isActive: true,
    },
    {
      // No photo on purpose — this is the gradient card that closes the grid.
      id: "cui-custom",
      nameEn: "Custom Menu",
      nameHi: "कस्टम मेनू",
      descEn: "Aapki pasand, humari peshkash",
      descHi: "आपकी पसंद, हमारी पेशकश",
      imageUrl: "",
      sortOrder: 8,
      isActive: true,
    },
  ],
  testimonials: [
    {
      id: "rev-1",
      quoteEn: '"Amazing taste and professional service. Our wedding guests were truly impressed!"',
      quoteHi: '"अद्भुत स्वाद और बेहतरीन सर्विस। शादी के सभी मेहमान प्रभावित हुए!"',
      authorName: "Rajesh Gupta",
      eventEn: "Wedding, 2024",
      eventHi: "विवाह, 2024",
      rating: 5,
      sortOrder: 1,
      isActive: true,
    },
    {
      id: "rev-2",
      quoteEn: '"Guests loved the buffet presentation. Best catering in Lucknow!"',
      quoteHi: '"मेहमानों को बफे सेटअप बहुत पसंद आया। लखनऊ में सबसे बेहतरीन कैटरिंग!"',
      authorName: "Priya Sharma",
      eventEn: "Engagement, 2024",
      eventHi: "सगाई, 2024",
      rating: 5,
      sortOrder: 2,
      isActive: true,
    },
    {
      id: "rev-3",
      quoteEn: '"Perfect catering for our wedding. Sab kuch ekdum first class tha!"',
      quoteHi: '"हमारी शादी के लिए एकदम सही कैटरिंग। सब कुछ फर्स्ट क्लास था!"',
      authorName: "Amit Verma",
      eventEn: "Reception, 2023",
      eventHi: "रिसेप्शन, 2023",
      rating: 5,
      sortOrder: 3,
      isActive: true,
    },
    {
      id: "rev-4",
      quoteEn:
        '"Highly recommended for premium events. Quality aur quantity dono zabardast!"',
      quoteHi: '"प्रीमियम इवेंट्स के लिए अत्यधिक अनुशंसित। क्वालिटी और क्वांटिटी दोनों लाजवाब!"',
      authorName: "Sunita Agarwal",
      eventEn: "Corporate Event, 2024",
      eventHi: "कॉर्पोरेट इवेंट, 2024",
      rating: 5,
      sortOrder: 4,
      isActive: true,
    },
  ],
  leads: [],
  settings: { ...DEFAULT_SETTINGS },
  site: { ...DEFAULT_SITE },
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
      { textEn: "Lunch Box", textHi: "लंच बॉक्स" },
      { textEn: "Breakfast Stall", textHi: "ब्रेकफास्ट स्टॉल" },
      { textEn: "Lunch Stall", textHi: "लंच स्टॉल" },
      { textEn: "Dinner Stall", textHi: "डिनर स्टॉल" },
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

  // Snapshots written before venues/settings/priceMode existed are still valid
  // on disk and in Blob. Fill the gaps here so one old file cannot crash a read.
  const packages = Array.isArray(snap?.packages)
    ? (snap!.packages as CatererPackage[]).map((p) => ({
        ...p,
        priceMode: p.priceMode === "quote" ? "quote" : ("amount" as PriceMode),
        basisPax: typeof p.basisPax === "number" && p.basisPax >= 0 ? p.basisPax : 400,
      }))
    : INITIAL_DEFAULTS.packages;

  // Venues written before the photo field existed carry no imageUrl; normalise
  // it to "" so every read path can treat it as a plain string.
  const venues = Array.isArray(snap?.venues)
    ? (snap!.venues as CatererVenue[]).map((v) => ({
        ...v,
        imageUrl: typeof v.imageUrl === "string" ? v.imageUrl : "",
      }))
    : INITIAL_DEFAULTS.venues;

  // Cuisines and testimonials arrived after the first snapshots were written.
  // An absent array means "this store predates the feature", so it seeds from
  // the defaults — an emptied-out collection is saved as [] and stays empty,
  // which only an explicit array in the snapshot can express.
  const cuisines = Array.isArray(snap?.cuisines)
    ? (snap!.cuisines as CatererCuisine[])
    : INITIAL_DEFAULTS.cuisines;

  const testimonials = Array.isArray(snap?.testimonials)
    ? (snap!.testimonials as CatererTestimonial[])
    : INITIAL_DEFAULTS.testimonials;

  return {
    packages,
    gallery: Array.isArray(snap?.gallery) ? (snap!.gallery as CatererGalleryItem[]) : INITIAL_DEFAULTS.gallery,
    venues,
    cuisines,
    testimonials,
    // Leads are visitor-generated, so an absent array means "none captured
    // yet" — never the seed data other collections fall back to.
    leads: Array.isArray(snap?.leads) ? (snap!.leads as CatererLead[]) : [],
    about: snap?.about && typeof snap.about === "object" ? (snap.about as CatererAbout) : INITIAL_DEFAULTS.about,
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
  data.testimonials ??= [];
  data.leads ??= [];
  data.settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
  data.site = { ...DEFAULT_SITE, ...(data.site ?? {}) };
  return data;
}

function ensureHydrated(): Promise<void> {
  const s = getState();
  if (!s.hydration) {
    s.hydration = (async () => {
      s.data = await readFromStorage();
    })();
  }
  return s.hydration.then(() => {
    if (s.data) backfillSections(s.data);
  });
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
// Store Operations (Cuisines)
// ---------------------------------------------------------------------------

export async function getAllCuisines(): Promise<CatererCuisine[]> {
  await ensureHydrated();
  const data = getState().data!;
  return [...data.cuisines].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCuisineById(id: string): Promise<CatererCuisine | null> {
  await ensureHydrated();
  const data = getState().data!;
  return data.cuisines.find((c) => c.id === id) ?? null;
}

export async function createCuisine(
  input: Omit<CatererCuisine, "id"> & { id?: string }
): Promise<CatererCuisine> {
  return mutateStore((data) => {
    const now = new Date().toISOString();
    const newCuisine: CatererCuisine = {
      ...input,
      id: input.id || `cui-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    data.cuisines.push(newCuisine);
    return newCuisine;
  });
}

export async function updateCuisine(
  id: string,
  updates: Partial<CatererCuisine>
): Promise<CatererCuisine | null> {
  return mutateStore((data) => {
    const idx = data.cuisines.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    const existing = data.cuisines[idx];
    const updated: CatererCuisine = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable
      updatedAt: new Date().toISOString(),
    };
    data.cuisines[idx] = updated;
    return updated;
  });
}

export async function deleteCuisine(id: string): Promise<boolean> {
  return mutateStore((data) => {
    const initialLen = data.cuisines.length;
    data.cuisines = data.cuisines.filter((c) => c.id !== id);
    return data.cuisines.length < initialLen;
  });
}

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

  const cuisines = data.cuisines
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
    testimonials,
    about: data.about,
    settings: data.settings,
    site: data.site,
  };
}
