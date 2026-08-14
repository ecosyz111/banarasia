"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

type PriceMode = "amount" | "quote";

type CatererPackage = {
  id: string;
  nameEn: string;
  nameHi: string;
  price: number;
  priceMode?: PriceMode;
  basisPax?: number;
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

type CatererGalleryItem = {
  id: string;
  imageUrl: string;
  captionEn: string;
  captionHi: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type CatererVenue = {
  id: string;
  nameEn: string;
  nameHi: string;
  areaEn: string;
  areaHi: string;
  capacity: string;
  notesEn: string;
  notesHi: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type CatererSettings = {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
};

type CatererStat = {
  labelEn: string;
  labelHi: string;
  value: string;
};

type CatererExpertise = {
  textEn: string;
  textHi: string;
};

type CatererAbout = {
  id?: string;
  slug?: string;
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
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

// ---------------------------------------------------------------------------
// Form State Interfaces
// ---------------------------------------------------------------------------

type PackageFormFeature = { en: string; hi: string };

type PackageFormData = {
  nameEn: string;
  nameHi: string;
  price: string;
  priceMode: PriceMode;
  basisPax: string;
  priceUnitEn: string;
  priceUnitHi: string;
  badgeEn: string;
  badgeHi: string;
  features: PackageFormFeature[];
  sortOrder: string;
  isActive: boolean;
};

type VenueFormData = {
  nameEn: string;
  nameHi: string;
  areaEn: string;
  areaHi: string;
  capacity: string;
  notesEn: string;
  notesHi: string;
  sortOrder: string;
  isActive: boolean;
};

type GalleryFormData = {
  imageUrl: string;
  captionEn: string;
  captionHi: string;
  sortOrder: string;
  isActive: boolean;
};

type AboutFormData = {
  storyTitleEn: string;
  storyTitleHi: string;
  titleEn: string;
  titleHi: string;
  descriptionEn: string;
  descriptionHi: string;
  mottoEn: string;
  mottoHi: string;
  subMottoEn: string;
  subMottoHi: string;
  establishedYear: string;
  stats: CatererStat[];
  expertise: CatererExpertise[];
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_PACKAGE_FORM: PackageFormData = {
  nameEn: "",
  nameHi: "",
  price: "",
  priceMode: "amount",
  basisPax: "400",
  priceUnitEn: "/ Plate",
  priceUnitHi: "/ प्लेट",
  badgeEn: "",
  badgeHi: "",
  features: [{ en: "", hi: "" }],
  sortOrder: "0",
  isActive: true,
};

const DEFAULT_VENUE_FORM: VenueFormData = {
  nameEn: "",
  nameHi: "",
  areaEn: "",
  areaHi: "",
  capacity: "",
  notesEn: "",
  notesHi: "",
  sortOrder: "0",
  isActive: true,
};

const DEFAULT_SETTINGS_FORM: CatererSettings = {
  logoUrl: "/sample-caterer/tl.png",
  primaryColor: "#ea580c",
  accentColor: "#eab308",
};

const DEFAULT_GALLERY_FORM: GalleryFormData = {
  imageUrl: "",
  captionEn: "",
  captionHi: "",
  sortOrder: "0",
  isActive: true,
};

const DEFAULT_ABOUT_FORM: AboutFormData = {
  storyTitleEn: "Our Story",
  storyTitleHi: "हमारी कहानी",
  titleEn: "Crafting Memorable Celebrations",
  titleHi: "स्मरणोत्सवों को खास बनाना",
  descriptionEn:
    "We are serving fresh food with good service for more than 10 years. Har event mein humari koshish hoti hai ki aapke mehman khush hokar jaayein.",
  descriptionHi:
    "हम 10 से अधिक वर्षों से अच्छी सेवा के साथ ताज़ा भोजन परोस रहे हैं। हर कार्यक्रम में हमारी कोशिश होती है कि आपके मेहमान खुश होकर जाएं।",
  mottoEn: '"Swad Adab Se Chakhayenge"',
  mottoHi: '"स्वाद अदब से चखायेंगे"',
  subMottoEn: "That's why we proudly say",
  subMottoHi: "इसलिए हम गर्व से कहते हैं",
  establishedYear: "2015",
  stats: [
    { labelEn: "Since", labelHi: "स्थापना", value: "2015" },
    { labelEn: "Events Done", labelHi: "संपन्न कार्यक्रम", value: "500+" },
    { labelEn: "Guest Capacity", labelHi: "अतिथि क्षमता", value: "10,000+" },
    { labelEn: "% Happy Clients", labelHi: "% संतुष्ट ग्राहक", value: "98%" },
  ],
  expertise: [
    { textEn: "Wedding & More", textHi: "शादी एवं अन्य" },
    { textEn: "Home Parties", textHi: "होम पार्टी" },
    { textEn: "Special Baina Boxes", textHi: "विशेष बैना बॉक्स" },
    { textEn: "Corporate Parties", textHi: "कॉर्पोरेट पार्टी" },
    { textEn: "Single Food Stall", textHi: "सिंगल फूड स्टॉल" },
    { textEn: "Bulk Food Boxes", textHi: "बल्क फूड बॉक्स" },
  ],
};

// ---------------------------------------------------------------------------
// Main Admin Component
// ---------------------------------------------------------------------------

export default function CatererAdminDashboard() {
  const router = useRouter();

  // Auth gate status
  const [authChecked, setAuthChecked] = useState(false);

  // Tabs: 'packages' | 'venues' | 'gallery' | 'about' | 'branding'
  const [activeTab, setActiveTab] = useState<
    "packages" | "venues" | "gallery" | "about" | "branding"
  >("packages");

  // Notifications
  const [toast, setToast] = useState<ToastState>(null);

  // Data states
  const [packages, setPackages] = useState<CatererPackage[]>([]);
  const [gallery, setGallery] = useState<CatererGalleryItem[]>([]);
  const [venues, setVenues] = useState<CatererVenue[]>([]);

  // Loading states
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [loadingAbout, setLoadingAbout] = useState(false);
  const [loadingVenues, setLoadingVenues] = useState(false);

  // Modals & form state for Venues
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [venueForm, setVenueForm] = useState<VenueFormData>(DEFAULT_VENUE_FORM);
  const [submittingVenue, setSubmittingVenue] = useState(false);
  const [deletingVenue, setDeletingVenue] = useState<CatererVenue | null>(null);
  const [deletingVenueLoading, setDeletingVenueLoading] = useState(false);

  // Form state for Branding
  const [settingsForm, setSettingsForm] = useState<CatererSettings>(DEFAULT_SETTINGS_FORM);
  const [submittingSettings, setSubmittingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Modals & form state for Packages
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState<PackageFormData>(DEFAULT_PACKAGE_FORM);
  const [submittingPackage, setSubmittingPackage] = useState(false);
  const [deletingPackage, setDeletingPackage] = useState<CatererPackage | null>(null);
  const [deletingPackageLoading, setDeletingPackageLoading] = useState(false);

  // Modals & form state for Gallery
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [editingGalleryId, setEditingGalleryId] = useState<string | null>(null);
  const [galleryForm, setGalleryForm] = useState<GalleryFormData>(DEFAULT_GALLERY_FORM);
  const [submittingGallery, setSubmittingGallery] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingGalleryItem, setDeletingGalleryItem] = useState<CatererGalleryItem | null>(null);
  const [deletingGalleryLoading, setDeletingGalleryLoading] = useState(false);

  // Form state for About
  const [aboutForm, setAboutForm] = useState<AboutFormData>(DEFAULT_ABOUT_FORM);
  const [submittingAbout, setSubmittingAbout] = useState(false);

  // Toast helper
  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // Fetch wrapper with 401 handling
  const apiFetch = useCallback(
    async (url: string, options?: RequestInit) => {
      try {
        const res = await fetch(url, options);
        if (res.status === 401) {
          showToast("error", "Session expired or unauthorized. Redirecting to login...");
          router.replace("/admin/login?next=/caterer-admin");
          throw new Error("Unauthorized");
        }
        return res;
      } catch (err) {
        if ((err as Error).message === "Unauthorized") throw err;
        throw new Error("Network error or server unavailable.");
      }
    },
    [router, showToast]
  );

  // ---------------------------------------------------------------------------
  // Auth Check (Client UX Guard)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let authed = false;
    try {
      authed = localStorage.getItem("oi_admin") === "1";
    } catch {
      // ignore storage errors
    }
    if (!authed) {
      router.replace("/admin/login?next=/caterer-admin");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  // ---------------------------------------------------------------------------
  // Data Fetchers
  // ---------------------------------------------------------------------------

  const fetchPackages = useCallback(async () => {
    setLoadingPackages(true);
    try {
      const res = await apiFetch("/api/caterer/packages", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPackages(data.packages ?? []);
      } else {
        showToast("error", "Failed to fetch packages.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "Unable to load packages. Please try again.");
      }
    } finally {
      setLoadingPackages(false);
    }
  }, [apiFetch, showToast]);

  const fetchGallery = useCallback(async () => {
    setLoadingGallery(true);
    try {
      const res = await apiFetch("/api/caterer/gallery", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setGallery(data.gallery ?? []);
      } else {
        showToast("error", "Failed to fetch gallery items.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "Unable to load gallery items. Please try again.");
      }
    } finally {
      setLoadingGallery(false);
    }
  }, [apiFetch, showToast]);

  const fetchAbout = useCallback(async () => {
    setLoadingAbout(true);
    try {
      const res = await apiFetch("/api/caterer/about", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const ab = data.about as CatererAbout | undefined;
        if (ab) {
          setAboutForm({
            storyTitleEn: ab.storyTitleEn ?? "Our Story",
            storyTitleHi: ab.storyTitleHi ?? "हमारी कहानी",
            titleEn: ab.titleEn ?? "Crafting Memorable Celebrations",
            titleHi: ab.titleHi ?? "स्मरणोत्सवों को खास बनाना",
            descriptionEn: ab.descriptionEn ?? "",
            descriptionHi: ab.descriptionHi ?? "",
            mottoEn: ab.mottoEn ?? "",
            mottoHi: ab.mottoHi ?? "",
            subMottoEn: ab.subMottoEn ?? "",
            subMottoHi: ab.subMottoHi ?? "",
            establishedYear: ab.establishedYear ? String(ab.establishedYear) : "2015",
            stats: Array.isArray(ab.stats) && ab.stats.length > 0 ? ab.stats : DEFAULT_ABOUT_FORM.stats,
            expertise: Array.isArray(ab.expertise) && ab.expertise.length > 0 ? ab.expertise : DEFAULT_ABOUT_FORM.expertise,
          });
        }
      } else {
        showToast("error", "Failed to fetch About content.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "Unable to load About section. Please try again.");
      }
    } finally {
      setLoadingAbout(false);
    }
  }, [apiFetch, showToast]);

  const fetchVenues = useCallback(async () => {
    setLoadingVenues(true);
    try {
      const res = await apiFetch("/api/caterer/venues", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setVenues(data.venues ?? []);
      } else {
        showToast("error", "Failed to fetch venues.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "Unable to load venues. Please try again.");
      }
    } finally {
      setLoadingVenues(false);
    }
  }, [apiFetch, showToast]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await apiFetch("/api/caterer/settings", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettingsForm({ ...DEFAULT_SETTINGS_FORM, ...data.settings });
        }
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "Unable to load branding settings.");
      }
    }
  }, [apiFetch, showToast]);

  // Initial fetch once auth checked
  useEffect(() => {
    if (!authChecked) return;
    fetchPackages();
    fetchGallery();
    fetchAbout();
    fetchVenues();
    fetchSettings();
  }, [authChecked, fetchPackages, fetchGallery, fetchAbout, fetchVenues, fetchSettings]);

  // Logout handler
  const handleLogout = () => {
    try {
      localStorage.removeItem("oi_admin");
    } catch {
      // ignore
    }
    router.replace("/admin/login");
  };

  // ---------------------------------------------------------------------------
  // Packages Handlers
  // ---------------------------------------------------------------------------

  const openAddPackageModal = () => {
    setEditingPackageId(null);
    setPackageForm({ ...DEFAULT_PACKAGE_FORM, features: [{ en: "", hi: "" }] });
    setPackageModalOpen(true);
  };

  const openEditPackageModal = (pkg: CatererPackage) => {
    setEditingPackageId(pkg.id);
    const maxLen = Math.max(pkg.featuresEn.length, pkg.featuresHi.length, 1);
    const mappedFeatures: PackageFormFeature[] = [];
    for (let i = 0; i < maxLen; i++) {
      mappedFeatures.push({
        en: pkg.featuresEn[i] ?? "",
        hi: pkg.featuresHi[i] ?? "",
      });
    }
    setPackageForm({
      nameEn: pkg.nameEn,
      nameHi: pkg.nameHi,
      price: String(pkg.price),
      priceMode: pkg.priceMode === "quote" ? "quote" : "amount",
      basisPax: String(pkg.basisPax ?? 400),
      priceUnitEn: pkg.priceUnitEn ?? "/ Plate",
      priceUnitHi: pkg.priceUnitHi ?? "/ प्लेट",
      badgeEn: pkg.badgeEn ?? "",
      badgeHi: pkg.badgeHi ?? "",
      features: mappedFeatures,
      sortOrder: String(pkg.sortOrder ?? 0),
      isActive: pkg.isActive ?? true,
    });
    setPackageModalOpen(true);
  };

  const handleAddFeatureRow = () => {
    setPackageForm((prev) => ({
      ...prev,
      features: [...prev.features, { en: "", hi: "" }],
    }));
  };

  const handleRemoveFeatureRow = (index: number) => {
    setPackageForm((prev) => {
      const updated = prev.features.filter((_, i) => i !== index);
      return {
        ...prev,
        features: updated.length > 0 ? updated : [{ en: "", hi: "" }],
      };
    });
  };

  const handleFeatureChange = (index: number, field: "en" | "hi", val: string) => {
    setPackageForm((prev) => {
      const updated = [...prev.features];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, features: updated };
    });
  };

  const handlePackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingPackage) return;

    if (!packageForm.nameEn.trim()) {
      showToast("error", "Package English Name is required.");
      return;
    }
    if (!packageForm.nameHi.trim()) {
      showToast("error", "Package Hindi Name is required.");
      return;
    }
    // In quote mode the figure is never shown, so an empty box is valid and
    // stores as 0. In amount mode it is the headline number and must be real.
    const parsedPrice = parseFloat(packageForm.price);
    if (packageForm.priceMode === "amount" && (isNaN(parsedPrice) || parsedPrice < 0)) {
      showToast("error", "Please provide a valid non-negative price.");
      return;
    }
    const priceValue = isNaN(parsedPrice) || parsedPrice < 0 ? 0 : parsedPrice;

    setSubmittingPackage(true);

    // Keep positional matching, filter out entries where both EN & HI are blank
    const cleanFeatures = packageForm.features.filter(
      (f) => f.en.trim() !== "" || f.hi.trim() !== ""
    );
    const featuresEn = cleanFeatures.map((f) => f.en.trim());
    const featuresHi = cleanFeatures.map((f) => f.hi.trim());

    const payload = {
      nameEn: packageForm.nameEn.trim(),
      nameHi: packageForm.nameHi.trim(),
      price: priceValue,
      priceMode: packageForm.priceMode,
      basisPax: parseInt(packageForm.basisPax, 10) || 0,
      priceUnitEn: packageForm.priceUnitEn.trim() || "/ Plate",
      priceUnitHi: packageForm.priceUnitHi.trim() || "/ प्लेट",
      badgeEn: packageForm.badgeEn.trim() || null,
      badgeHi: packageForm.badgeHi.trim() || null,
      featuresEn,
      featuresHi,
      sortOrder: parseInt(packageForm.sortOrder, 10) || 0,
      isActive: packageForm.isActive,
    };

    try {
      const url = editingPackageId
        ? `/api/caterer/packages/${editingPackageId}`
        : "/api/caterer/packages";
      const method = editingPackageId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(
          "success",
          editingPackageId ? "Package updated successfully!" : "New package created!"
        );
        setPackageModalOpen(false);
        fetchPackages();
      } else {
        const json = await res.json().catch(() => null);
        showToast("error", json?.error ?? "Failed to save package.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "An error occurred while saving the package.");
      }
    } finally {
      setSubmittingPackage(false);
    }
  };

  const handleDeletePackageConfirm = async () => {
    if (!deletingPackage || deletingPackageLoading) return;
    setDeletingPackageLoading(true);
    try {
      const res = await apiFetch(`/api/caterer/packages/${deletingPackage.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("success", `Package "${deletingPackage.nameEn}" deleted.`);
        setDeletingPackage(null);
        fetchPackages();
      } else {
        const json = await res.json().catch(() => null);
        showToast("error", json?.error ?? "Failed to delete package.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "An error occurred while deleting the package.");
      }
    } finally {
      setDeletingPackageLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Gallery Handlers
  // ---------------------------------------------------------------------------

  const openAddGalleryModal = () => {
    setEditingGalleryId(null);
    setGalleryForm(DEFAULT_GALLERY_FORM);
    setGalleryModalOpen(true);
  };

  const openEditGalleryModal = (item: CatererGalleryItem) => {
    setEditingGalleryId(item.id);
    setGalleryForm({
      imageUrl: item.imageUrl,
      captionEn: item.captionEn,
      captionHi: item.captionHi,
      sortOrder: String(item.sortOrder ?? 0),
      isActive: item.isActive ?? true,
    });
    setGalleryModalOpen(true);
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      showToast("error", "Invalid format. Only JPG, JPEG, PNG, and WebP images are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch("/api/caterer/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setGalleryForm((prev) => ({ ...prev, imageUrl: data.url }));
          showToast("success", "Image file uploaded successfully!");
        } else {
          showToast("error", "Failed to retrieve uploaded image URL.");
        }
      } else {
        const json = await res.json().catch(() => null);
        showToast("error", json?.error ?? "Image upload failed.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "An error occurred while uploading the image file.");
      }
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGallerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingGallery) return;

    if (!galleryForm.imageUrl.trim()) {
      showToast("error", "Image URL/Path is required.");
      return;
    }
    if (!galleryForm.captionEn.trim()) {
      showToast("error", "English Caption is required.");
      return;
    }
    if (!galleryForm.captionHi.trim()) {
      showToast("error", "Hindi Caption is required.");
      return;
    }

    setSubmittingGallery(true);

    const payload = {
      imageUrl: galleryForm.imageUrl.trim(),
      captionEn: galleryForm.captionEn.trim(),
      captionHi: galleryForm.captionHi.trim(),
      sortOrder: parseInt(galleryForm.sortOrder, 10) || 0,
      isActive: galleryForm.isActive,
    };

    try {
      const url = editingGalleryId
        ? `/api/caterer/gallery/${editingGalleryId}`
        : "/api/caterer/gallery";
      const method = editingGalleryId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(
          "success",
          editingGalleryId
            ? "Gallery item updated successfully!"
            : "New gallery image added!"
        );
        setGalleryModalOpen(false);
        fetchGallery();
      } else {
        const json = await res.json().catch(() => null);
        showToast("error", json?.error ?? "Failed to save gallery item.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "An error occurred while saving gallery item.");
      }
    } finally {
      setSubmittingGallery(false);
    }
  };

  const handleDeleteGalleryConfirm = async () => {
    if (!deletingGalleryItem || deletingGalleryLoading) return;
    setDeletingGalleryLoading(true);
    try {
      const res = await apiFetch(`/api/caterer/gallery/${deletingGalleryItem.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("success", "Gallery item deleted successfully.");
        setDeletingGalleryItem(null);
        fetchGallery();
      } else {
        const json = await res.json().catch(() => null);
        showToast("error", json?.error ?? "Failed to delete gallery item.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "An error occurred while deleting gallery item.");
      }
    } finally {
      setDeletingGalleryLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Venue Handlers
  // ---------------------------------------------------------------------------

  const openAddVenueModal = () => {
    setEditingVenueId(null);
    setVenueForm({ ...DEFAULT_VENUE_FORM });
    setVenueModalOpen(true);
  };

  const openEditVenueModal = (venue: CatererVenue) => {
    setEditingVenueId(venue.id);
    setVenueForm({
      nameEn: venue.nameEn,
      nameHi: venue.nameHi,
      areaEn: venue.areaEn ?? "",
      areaHi: venue.areaHi ?? "",
      capacity: venue.capacity ?? "",
      notesEn: venue.notesEn ?? "",
      notesHi: venue.notesHi ?? "",
      sortOrder: String(venue.sortOrder ?? 0),
      isActive: venue.isActive ?? true,
    });
    setVenueModalOpen(true);
  };

  const handleVenueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingVenue) return;

    if (!venueForm.nameEn.trim()) {
      showToast("error", "Venue English Name is required.");
      return;
    }
    if (!venueForm.nameHi.trim()) {
      showToast("error", "Venue Hindi Name is required.");
      return;
    }

    setSubmittingVenue(true);

    const payload = {
      nameEn: venueForm.nameEn.trim(),
      nameHi: venueForm.nameHi.trim(),
      areaEn: venueForm.areaEn.trim(),
      areaHi: venueForm.areaHi.trim(),
      capacity: venueForm.capacity.trim(),
      notesEn: venueForm.notesEn.trim(),
      notesHi: venueForm.notesHi.trim(),
      sortOrder: parseInt(venueForm.sortOrder, 10) || 0,
      isActive: venueForm.isActive,
    };

    try {
      const url = editingVenueId
        ? `/api/caterer/venues/${editingVenueId}`
        : "/api/caterer/venues";
      const method = editingVenueId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(
          "success",
          editingVenueId ? "Venue updated successfully!" : "New venue added!"
        );
        setVenueModalOpen(false);
        fetchVenues();
      } else {
        const json = await res.json().catch(() => null);
        showToast("error", json?.error ?? "Failed to save venue.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "An error occurred while saving the venue.");
      }
    } finally {
      setSubmittingVenue(false);
    }
  };

  const handleDeleteVenueConfirm = async () => {
    if (!deletingVenue || deletingVenueLoading) return;
    setDeletingVenueLoading(true);
    try {
      const res = await apiFetch(`/api/caterer/venues/${deletingVenue.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("success", "Venue deleted.");
        setDeletingVenue(null);
        fetchVenues();
      } else {
        showToast("error", "Failed to delete venue.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "An error occurred while deleting the venue.");
      }
    } finally {
      setDeletingVenueLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Branding Handlers
  // ---------------------------------------------------------------------------

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "logo");

      const res = await apiFetch("/api/caterer/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);

      if (res.ok && json?.url) {
        // Staged only — the URL is not live until Save Branding is pressed.
        setSettingsForm((prev) => ({ ...prev, logoUrl: json.url }));
        showToast("success", "Logo uploaded. Press Save Branding to apply it.");
      } else {
        showToast("error", json?.error ?? "Failed to upload logo.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "An error occurred while uploading the logo.");
      }
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingSettings) return;

    const hex = /^#[0-9a-fA-F]{6}$/;
    if (!hex.test(settingsForm.primaryColor) || !hex.test(settingsForm.accentColor)) {
      showToast("error", "Colours must be 6-digit hex values, e.g. #ea580c.");
      return;
    }

    setSubmittingSettings(true);
    try {
      const res = await apiFetch("/api/caterer/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });

      if (res.ok) {
        showToast("success", "Branding saved. Reload the public site to see it.");
        fetchSettings();
      } else {
        const json = await res.json().catch(() => null);
        showToast("error", json?.error ?? "Failed to save branding.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "An error occurred while saving branding.");
      }
    } finally {
      setSubmittingSettings(false);
    }
  };

  // ---------------------------------------------------------------------------
  // About Handlers
  // ---------------------------------------------------------------------------

  const handleAddStat = () => {
    setAboutForm((prev) => ({
      ...prev,
      stats: [...prev.stats, { labelEn: "", labelHi: "", value: "" }],
    }));
  };

  const handleRemoveStat = (index: number) => {
    setAboutForm((prev) => ({
      ...prev,
      stats: prev.stats.filter((_, i) => i !== index),
    }));
  };

  const handleStatChange = (
    index: number,
    field: keyof CatererStat,
    val: string
  ) => {
    setAboutForm((prev) => {
      const updated = [...prev.stats];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, stats: updated };
    });
  };

  const handleAddExpertise = () => {
    setAboutForm((prev) => ({
      ...prev,
      expertise: [...prev.expertise, { textEn: "", textHi: "" }],
    }));
  };

  const handleRemoveExpertise = (index: number) => {
    setAboutForm((prev) => ({
      ...prev,
      expertise: prev.expertise.filter((_, i) => i !== index),
    }));
  };

  const handleExpertiseChange = (
    index: number,
    field: keyof CatererExpertise,
    val: string
  ) => {
    setAboutForm((prev) => {
      const updated = [...prev.expertise];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, expertise: updated };
    });
  };

  const handleAboutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingAbout) return;

    if (!aboutForm.descriptionEn.trim()) {
      showToast("error", "Description in English is required.");
      return;
    }
    if (!aboutForm.descriptionHi.trim()) {
      showToast("error", "Description in Hindi is required.");
      return;
    }

    setSubmittingAbout(true);

    const parsedYear = parseInt(aboutForm.establishedYear, 10);

    const payload = {
      storyTitleEn: aboutForm.storyTitleEn.trim(),
      storyTitleHi: aboutForm.storyTitleHi.trim(),
      titleEn: aboutForm.titleEn.trim(),
      titleHi: aboutForm.titleHi.trim(),
      descriptionEn: aboutForm.descriptionEn.trim(),
      descriptionHi: aboutForm.descriptionHi.trim(),
      mottoEn: aboutForm.mottoEn.trim(),
      mottoHi: aboutForm.mottoHi.trim(),
      subMottoEn: aboutForm.subMottoEn.trim() || null,
      subMottoHi: aboutForm.subMottoHi.trim() || null,
      establishedYear: isNaN(parsedYear) ? 2015 : parsedYear,
      stats: aboutForm.stats.filter(
        (s) => s.labelEn.trim() || s.labelHi.trim() || s.value.trim()
      ),
      expertise: aboutForm.expertise.filter(
        (exp) => exp.textEn.trim() || exp.textHi.trim()
      ),
    };

    try {
      const res = await apiFetch("/api/caterer/about", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast("success", "About section changes saved successfully!");
      } else {
        const json = await res.json().catch(() => null);
        showToast("error", json?.error ?? "Failed to save About section.");
      }
    } catch (err) {
      if ((err as Error).message !== "Unauthorized") {
        showToast("error", "An error occurred while saving About section.");
      }
    } finally {
      setSubmittingAbout(false);
    }
  };

  // If auth check is pending, show loading state
  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5]">
        <div className="flex flex-col items-center gap-3 text-stone-600">
          <svg
            className="h-8 w-8 animate-spin text-orange-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm font-medium">Verifying session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#3D2518] antialiased selection:bg-orange-100 selection:text-orange-900">
      {/* ------------------------------------------------------------------ */}
      {/* Toast Notification Banner */}
      {/* ------------------------------------------------------------------ */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-md animate-bounce-short">
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3.5 shadow-xl border text-sm font-medium ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-rose-50 text-rose-900 border-rose-200"
            }`}
          >
            {toast.type === "success" ? (
              <svg
                className="h-5 w-5 text-emerald-600 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 text-rose-600 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-auto text-stone-400 hover:text-stone-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Top Header */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-white font-bold shadow-md shadow-orange-600/20">
              B
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#3D2518]">
                Banarasia Caterer CMS
              </h1>
              <p className="text-xs text-stone-500 font-medium">Content Management Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/sample-caterer"
              target="_blank"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              <span>View Site</span>
              <svg className="h-3.5 w-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-100"
            >
              <svg className="h-3.5 w-3.5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-6">
            <button
              onClick={() => setActiveTab("packages")}
              className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
                activeTab === "packages"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span>Packages</span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                {packages.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("venues")}
              className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
                activeTab === "venues"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Venues</span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                {venues.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("gallery")}
              className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
                activeTab === "gallery"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Gallery</span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                {gallery.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("about")}
              className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
                activeTab === "about"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>About Section</span>
            </button>

            <button
              onClick={() => setActiveTab("branding")}
              className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
                activeTab === "branding"
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828L11 19.172M7 17h.01" />
              </svg>
              <span>Logo &amp; Brand</span>
            </button>
          </nav>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Main Content Body */}
      {/* ------------------------------------------------------------------ */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ================================================================ */}
        {/* TAB 1: PACKAGES */}
        {/* ================================================================ */}
        {activeTab === "packages" && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#3D2518]">Catering Packages</h2>
                <p className="text-sm text-stone-500">
                  Manage active and inactive catering package offerings and pricing details.
                </p>
              </div>
              <button
                onClick={openAddPackageModal}
                className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 active:scale-95"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span>+ Add Package</span>
              </button>
            </div>

            {loadingPackages ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-stone-200 bg-white p-6 space-y-4"
                  >
                    <div className="h-6 w-1/2 bg-stone-200 rounded"></div>
                    <div className="h-4 w-1/3 bg-stone-100 rounded"></div>
                    <div className="h-16 bg-stone-100 rounded"></div>
                  </div>
                ))}
              </div>
            ) : packages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-stone-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <h3 className="mt-4 text-base font-bold text-stone-800">No Packages Found</h3>
                <p className="mt-1 text-sm text-stone-500">
                  Click the &quot;+ Add Package&quot; button above to create your first package.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`flex flex-col justify-between rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md ${
                      pkg.isActive ? "border-stone-200" : "border-stone-200 bg-stone-50/60 opacity-80"
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Status + Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            pkg.isActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-stone-100 text-stone-600 border border-stone-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              pkg.isActive ? "bg-emerald-500" : "bg-stone-400"
                            }`}
                          />
                          {pkg.isActive ? "Active" : "Inactive"}
                        </span>

                        {pkg.badgeEn && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                            {pkg.badgeEn}
                          </span>
                        )}
                      </div>

                      {/* Package Title */}
                      <div>
                        <h3 className="text-lg font-bold text-[#3D2518]">{pkg.nameEn}</h3>
                        <p className="text-sm font-medium text-stone-500">{pkg.nameHi}</p>
                      </div>

                      {/* Pricing — mirrors what the public page will show */}
                      <div className="rounded-xl bg-[#FAF8F5] p-3 border border-stone-100">
                        {pkg.priceMode === "quote" ? (
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-orange-600">
                              Get Price Quote
                            </span>
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                              Hidden
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-orange-600">₹{pkg.price}</span>
                            <span className="text-xs font-semibold text-stone-500">
                              {pkg.priceUnitEn} / {pkg.priceUnitHi}
                            </span>
                          </div>
                        )}
                        {(pkg.basisPax ?? 0) > 0 && (
                          <p className="mt-1 text-[11px] font-semibold text-stone-500">
                            Based on {pkg.basisPax} pax
                          </p>
                        )}
                      </div>

                      {/* Options / Features preview */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
                          <span>Included Options</span>
                          <span>{pkg.featuresEn.length} items</span>
                        </div>
                        <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1 text-xs text-stone-700">
                          {pkg.featuresEn.map((featEn, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <svg
                                className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <div>
                                <span>{featEn}</span>
                                {pkg.featuresHi[idx] && (
                                  <span className="block text-stone-400 font-medium">
                                    {pkg.featuresHi[idx]}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4">
                      <span className="text-xs text-stone-400 font-mono">
                        Sort Order: {pkg.sortOrder}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditPackageModal(pkg)}
                          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 hover:border-stone-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingPackage(pkg)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================================================================ */}
        {/* TAB: VENUES */}
        {/* ================================================================ */}
        {activeTab === "venues" && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#3D2518]">Venues</h2>
                <p className="text-sm text-stone-500">
                  Locations you cater at. These appear in the Venues section of the public site.
                </p>
              </div>
              <button
                onClick={openAddVenueModal}
                className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 active:scale-95"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span>+ Add Venue</span>
              </button>
            </div>

            {loadingVenues ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-stone-200 bg-white p-6 space-y-4"
                  >
                    <div className="h-6 w-1/2 bg-stone-200 rounded"></div>
                    <div className="h-4 w-1/3 bg-stone-100 rounded"></div>
                    <div className="h-12 bg-stone-100 rounded"></div>
                  </div>
                ))}
              </div>
            ) : venues.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-stone-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <h3 className="mt-4 text-base font-bold text-stone-800">No Venues Yet</h3>
                <p className="mt-1 text-sm text-stone-500">
                  Click &quot;+ Add Venue&quot; to list the first location.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {venues.map((venue) => (
                  <div
                    key={venue.id}
                    className={`flex flex-col justify-between rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md ${
                      venue.isActive ? "border-stone-200" : "border-stone-200 bg-stone-50/60 opacity-80"
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            venue.isActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-stone-100 text-stone-600 border border-stone-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              venue.isActive ? "bg-emerald-500" : "bg-stone-400"
                            }`}
                          />
                          {venue.isActive ? "Active" : "Inactive"}
                        </span>

                        {venue.capacity && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                            {venue.capacity} guests
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-[#3D2518]">{venue.nameEn}</h3>
                        <p className="text-sm font-medium text-stone-500">{venue.nameHi}</p>
                      </div>

                      {(venue.areaEn || venue.areaHi) && (
                        <div className="rounded-xl bg-[#FAF8F5] p-3 border border-stone-100 text-sm">
                          <p className="font-semibold text-stone-700">{venue.areaEn}</p>
                          <p className="text-stone-500">{venue.areaHi}</p>
                        </div>
                      )}

                      {venue.notesEn && (
                        <p className="text-xs text-stone-600 leading-relaxed">{venue.notesEn}</p>
                      )}
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4">
                      <span className="text-xs text-stone-400 font-mono">
                        Sort Order: {venue.sortOrder}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditVenueModal(venue)}
                          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 hover:border-stone-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingVenue(venue)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================================================================ */}
        {/* TAB 2: GALLERY */}
        {/* ================================================================ */}
        {activeTab === "gallery" && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#3D2518]">Gallery Images</h2>
                <p className="text-sm text-stone-500">
                  Manage food showcases, event photos, and gallery image paths.
                </p>
              </div>
              <button
                onClick={openAddGalleryModal}
                className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 active:scale-95"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span>+ Add Image</span>
              </button>
            </div>

            {loadingGallery ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-stone-200 bg-white overflow-hidden">
                    <div className="h-48 bg-stone-200"></div>
                    <div className="p-4 space-y-2">
                      <div className="h-4 w-3/4 bg-stone-100 rounded"></div>
                      <div className="h-3 w-1/2 bg-stone-100 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : gallery.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-stone-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="mt-4 text-base font-bold text-stone-800">No Gallery Items</h3>
                <p className="mt-1 text-sm text-stone-500">
                  Click &quot;+ Add Image&quot; to add image URLs and captions.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {gallery.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
                      item.isActive ? "border-stone-200" : "border-stone-200 opacity-75 bg-stone-50"
                    }`}
                  >
                    <div>
                      {/* Image Preview Container */}
                      <div className="relative h-48 w-full bg-stone-100 overflow-hidden group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.captionEn}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          onError={(e) => {
                            // Fallback image placeholder on broken URL
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1555244162-803834f70033?w=600&q=80";
                          }}
                        />
                        <div className="absolute top-3 right-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${
                              item.isActive
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-stone-100 text-stone-600 border border-stone-200"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                item.isActive ? "bg-emerald-500" : "bg-stone-400"
                              }`}
                            />
                            {item.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>

                      {/* Captions */}
                      <div className="p-4 space-y-1">
                        <h4 className="font-bold text-[#3D2518] text-sm line-clamp-1">
                          {item.captionEn}
                        </h4>
                        <p className="text-xs text-stone-500 font-medium line-clamp-1">
                          {item.captionHi}
                        </p>
                        <p className="text-[11px] text-stone-400 font-mono pt-1">
                          URL: <span className="truncate inline-block max-w-[220px] align-bottom">{item.imageUrl}</span>
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between border-t border-stone-100 p-4 bg-stone-50/50">
                      <span className="text-xs text-stone-400 font-mono">
                        Order: {item.sortOrder}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditGalleryModal(item)}
                          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 hover:border-stone-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingGalleryItem(item)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================================================================ */}
        {/* TAB 3: ABOUT */}
        {/* ================================================================ */}
        {activeTab === "about" && (
          <section className="space-y-6 max-w-4xl">
            <div>
              <h2 className="text-xl font-bold text-[#3D2518]">About Section Content</h2>
              <p className="text-sm text-stone-500">
                Edit story titles, descriptions, mottos, stats, and key expertise bullet points.
              </p>
            </div>

            {loadingAbout ? (
              <div className="animate-pulse space-y-6 rounded-2xl border border-stone-200 bg-white p-6">
                <div className="h-6 w-1/3 bg-stone-200 rounded"></div>
                <div className="h-20 bg-stone-100 rounded"></div>
                <div className="h-20 bg-stone-100 rounded"></div>
              </div>
            ) : (
              <form onSubmit={handleAboutSubmit} className="space-y-8">
                {/* 1. Main Titles & Story */}
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-[#3D2518] flex items-center gap-2 border-b border-stone-100 pb-3">
                    <span className="h-2 w-2 rounded-full bg-orange-600" />
                    Story & Main Titles
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Story Title (English)
                      </label>
                      <input
                        type="text"
                        value={aboutForm.storyTitleEn}
                        onChange={(e) =>
                          setAboutForm({ ...aboutForm, storyTitleEn: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Story Title (Hindi)
                      </label>
                      <input
                        type="text"
                        value={aboutForm.storyTitleHi}
                        onChange={(e) =>
                          setAboutForm({ ...aboutForm, storyTitleHi: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Main Title (English)
                      </label>
                      <input
                        type="text"
                        value={aboutForm.titleEn}
                        onChange={(e) =>
                          setAboutForm({ ...aboutForm, titleEn: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Main Title (Hindi)
                      </label>
                      <input
                        type="text"
                        value={aboutForm.titleHi}
                        onChange={(e) =>
                          setAboutForm({ ...aboutForm, titleHi: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                  </div>

                  {/* Description En & Hi */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Description (English) *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={aboutForm.descriptionEn}
                        onChange={(e) =>
                          setAboutForm({ ...aboutForm, descriptionEn: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Description (Hindi) *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={aboutForm.descriptionHi}
                        onChange={(e) =>
                          setAboutForm({ ...aboutForm, descriptionHi: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Motto & Established Year */}
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-[#3D2518] flex items-center gap-2 border-b border-stone-100 pb-3">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Motto & Founding Year
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Motto Tagline (English)
                      </label>
                      <input
                        type="text"
                        value={aboutForm.mottoEn}
                        onChange={(e) =>
                          setAboutForm({ ...aboutForm, mottoEn: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Motto Tagline (Hindi)
                      </label>
                      <input
                        type="text"
                        value={aboutForm.mottoHi}
                        onChange={(e) =>
                          setAboutForm({ ...aboutForm, mottoHi: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Sub-Motto Intro (English)
                      </label>
                      <input
                        type="text"
                        value={aboutForm.subMottoEn}
                        onChange={(e) =>
                          setAboutForm({ ...aboutForm, subMottoEn: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Sub-Motto Intro (Hindi)
                      </label>
                      <input
                        type="text"
                        value={aboutForm.subMottoHi}
                        onChange={(e) =>
                          setAboutForm({ ...aboutForm, subMottoHi: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Established Year
                      </label>
                      <input
                        type="number"
                        value={aboutForm.establishedYear}
                        onChange={(e) =>
                          setAboutForm({ ...aboutForm, establishedYear: e.target.value })
                        }
                        className="w-full max-w-xs rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Manageable Stats */}
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <h3 className="text-base font-bold text-[#3D2518] flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Key Stats Counters
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddStat}
                      className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Stat</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {aboutForm.stats.map((stat, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/50 p-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                          <input
                            type="text"
                            placeholder="Label (EN)"
                            value={stat.labelEn}
                            onChange={(e) => handleStatChange(idx, "labelEn", e.target.value)}
                            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Label (HI)"
                            value={stat.labelHi}
                            onChange={(e) => handleStatChange(idx, "labelHi", e.target.value)}
                            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Value (e.g. 500+)"
                            value={stat.value}
                            onChange={(e) => handleStatChange(idx, "value", e.target.value)}
                            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-orange-600 focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStat(idx)}
                          className="self-end sm:self-center p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          title="Remove Stat"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Manageable Expertise */}
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <h3 className="text-base font-bold text-[#3D2518] flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Areas of Expertise
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddExpertise}
                      className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {aboutForm.expertise.map((exp, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/50 p-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                          <input
                            type="text"
                            placeholder="English Text"
                            value={exp.textEn}
                            onChange={(e) => handleExpertiseChange(idx, "textEn", e.target.value)}
                            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Hindi Text"
                            value={exp.textHi}
                            onChange={(e) => handleExpertiseChange(idx, "textHi", e.target.value)}
                            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExpertise(idx)}
                          className="self-end sm:self-center p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          title="Remove Expertise Item"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submittingAbout}
                    className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingAbout ? (
                      <>
                        <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* ================================================================ */}
        {/* TAB: LOGO & BRAND */}
        {/* ================================================================ */}
        {activeTab === "branding" && (
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#3D2518]">Logo &amp; Brand Colours</h2>
              <p className="text-sm text-stone-500">
                Replace the logo and set the two colours the public site derives its accents from.
              </p>
            </div>

            <form onSubmit={handleSettingsSubmit} className="space-y-8">
              {/* Logo */}
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">Logo</h3>

                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-[#FAF8F5] p-2">
                    {settingsForm.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={settingsForm.logoUrl}
                        alt="Current logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-stone-400">No logo</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-3">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleLogoUpload}
                      className="block w-full text-sm text-stone-600 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-orange-700"
                    />
                    {uploadingLogo && (
                      <p className="text-xs font-semibold text-orange-600">Uploading logo…</p>
                    )}
                    <p className="text-xs text-stone-500">
                      JPG, PNG or WebP. A square transparent PNG works best. Uploading only stages
                      the file — press <strong>Save Branding</strong> below to make it live.
                    </p>

                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-500">
                        Logo URL
                      </label>
                      <input
                        type="text"
                        value={settingsForm.logoUrl}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({ ...prev, logoUrl: e.target.value }))
                        }
                        className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        placeholder="/sample-caterer/tl.png"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Colours */}
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">
                  Brand Colours
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {(
                    [
                      { key: "primaryColor", label: "Primary", hint: "Buttons, links, highlights" },
                      { key: "accentColor", label: "Accent", hint: "Gradients and secondary detail" },
                    ] as const
                  ).map((field) => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-500">
                        {field.label}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={settingsForm[field.key]}
                          onChange={(e) =>
                            setSettingsForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          className="h-11 w-14 cursor-pointer rounded-lg border border-stone-200 bg-white p-1"
                        />
                        <input
                          type="text"
                          value={settingsForm[field.key]}
                          onChange={(e) =>
                            setSettingsForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          className="w-full rounded-xl border border-stone-200 px-3 py-2 font-mono text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                          placeholder="#ea580c"
                        />
                      </div>
                      <p className="mt-1 text-xs text-stone-500">{field.hint}</p>
                    </div>
                  ))}
                </div>

                {/* Live preview */}
                <div className="rounded-xl border border-stone-100 bg-[#FAF8F5] p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">
                    Preview
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="rounded-full px-5 py-2 text-sm font-semibold text-white shadow"
                      style={{
                        background: `linear-gradient(to right, ${settingsForm.primaryColor}, ${settingsForm.accentColor})`,
                      }}
                    >
                      Book Catering
                    </span>
                    <span
                      className="rounded-full border-2 px-5 py-2 text-sm font-semibold"
                      style={{
                        borderColor: settingsForm.primaryColor,
                        color: settingsForm.primaryColor,
                      }}
                    >
                      Get Price Quote
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingSettings}
                  className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 active:scale-95 disabled:opacity-60"
                >
                  {submittingSettings ? (
                    <>
                      <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Branding</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT PACKAGE */}
      {/* ==================================================================== */}
      {packageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <h3 className="text-lg font-bold text-[#3D2518]">
                {editingPackageId ? "Edit Catering Package" : "Create New Package"}
              </h3>
              <button
                onClick={() => setPackageModalOpen(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handlePackageSubmit} className="space-y-4">
              {/* Name EN & HI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Shahi Buffet"
                    value={packageForm.nameEn}
                    onChange={(e) => setPackageForm({ ...packageForm, nameEn: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Name (Hindi) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. रॉयल शाही बुफे"
                    value={packageForm.nameHi}
                    onChange={(e) => setPackageForm({ ...packageForm, nameHi: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              {/* How the price is shown on the public site */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Price Display
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      {
                        mode: "amount" as const,
                        title: "Show price",
                        desc: "Public site shows ₹ and the unit",
                      },
                      {
                        mode: "quote" as const,
                        title: "Get Price Quote",
                        desc: "Hides the figure, shows a quote CTA",
                      },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() => setPackageForm({ ...packageForm, priceMode: opt.mode })}
                      className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                        packageForm.priceMode === opt.mode
                          ? "border-orange-500 bg-orange-50"
                          : "border-stone-200 bg-white hover:border-stone-300"
                      }`}
                    >
                      <span className="block text-sm font-bold text-stone-800">{opt.title}</span>
                      <span className="block text-xs text-stone-500">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Price & Price Units */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Price (₹) {packageForm.priceMode === "amount" ? "*" : "(hidden)"}
                  </label>
                  <input
                    type="number"
                    required={packageForm.priceMode === "amount"}
                    disabled={packageForm.priceMode === "quote"}
                    min="0"
                    step="1"
                    placeholder="1200"
                    value={packageForm.price}
                    onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:bg-stone-100 disabled:text-stone-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Basis (pax)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    placeholder="400"
                    value={packageForm.basisPax}
                    onChange={(e) => setPackageForm({ ...packageForm, basisPax: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                  <p className="mt-1 text-[11px] leading-tight text-stone-500">
                    Guest count this rate was costed on. 0 hides it.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Unit (English)
                  </label>
                  <input
                    type="text"
                    placeholder="/ Plate"
                    value={packageForm.priceUnitEn}
                    onChange={(e) => setPackageForm({ ...packageForm, priceUnitEn: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Unit (Hindi)
                  </label>
                  <input
                    type="text"
                    placeholder="/ प्लेट"
                    value={packageForm.priceUnitHi}
                    onChange={(e) => setPackageForm({ ...packageForm, priceUnitHi: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              {/* Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Badge (English)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Most Popular"
                    value={packageForm.badgeEn}
                    onChange={(e) => setPackageForm({ ...packageForm, badgeEn: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Badge (Hindi)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. सबसे लोकप्रिय"
                    value={packageForm.badgeHi}
                    onChange={(e) => setPackageForm({ ...packageForm, badgeHi: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              {/* Package Options / Features Manager */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Package Options &amp; Features (Position-Matched)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddFeatureRow}
                    className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>+ Add Option</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {packageForm.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-stone-400 w-5 shrink-0">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        placeholder="Option English"
                        value={feat.en}
                        onChange={(e) => handleFeatureChange(idx, "en", e.target.value)}
                        className="w-1/2 rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Option Hindi"
                        value={feat.hi}
                        onChange={(e) => handleFeatureChange(idx, "hi", e.target.value)}
                        className="w-1/2 rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFeatureRow(idx)}
                        className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                        title="Remove option"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sort Order & Active status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={packageForm.sortOrder}
                    onChange={(e) => setPackageForm({ ...packageForm, sortOrder: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="package-is-active"
                    checked={packageForm.isActive}
                    onChange={(e) => setPackageForm({ ...packageForm, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="package-is-active" className="text-sm font-semibold text-stone-700">
                    Active (visible on website)
                  </label>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setPackageModalOpen(false)}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPackage}
                  className="rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 disabled:opacity-60"
                >
                  {submittingPackage ? "Saving Package..." : editingPackageId ? "Update Package" : "Create Package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT GALLERY ITEM */}
      {/* ==================================================================== */}
      {galleryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <h3 className="text-lg font-bold text-[#3D2518]">
                {editingGalleryId ? "Edit Gallery Item" : "Add New Gallery Image"}
              </h3>
              <button
                onClick={() => setGalleryModalOpen(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleGallerySubmit} className="space-y-4">
              {/* File Upload Section */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Upload Image File (Device)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={handleImageFileUpload}
                    className="hidden"
                    id="caterer-file-upload-input"
                    disabled={uploadingImage || submittingGallery}
                  />
                  <label
                    htmlFor="caterer-file-upload-input"
                    className={`flex flex-1 items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-xs font-bold text-stone-700 cursor-pointer transition hover:border-orange-500 hover:bg-orange-50/50 ${
                      uploadingImage || submittingGallery ? "cursor-not-allowed opacity-60" : ""
                    }`}
                  >
                    {uploadingImage ? (
                      <>
                        <svg className="h-4 w-4 animate-spin text-orange-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-orange-600 font-bold">Uploading Image to Store...</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>Choose File from Device (JPG, PNG, WebP)</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Divider / Manual URL Input */}
              <div className="relative flex items-center my-2">
                <div className="flex-grow border-t border-stone-200" />
                <span className="flex-shrink mx-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                  Or enter URL / path manually
                </span>
                <div className="flex-grow border-t border-stone-200" />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Image URL / Path *
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://images.unsplash.com/... or /uploads/caterer/..."
                  value={galleryForm.imageUrl}
                  onChange={(e) => setGalleryForm({ ...galleryForm, imageUrl: e.target.value })}
                  disabled={uploadingImage || submittingGallery}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:opacity-60"
                />
              </div>

              {/* Image Preview Box */}
              {galleryForm.imageUrl.trim() && (
                <div className="relative h-36 w-full rounded-xl bg-stone-100 overflow-hidden border border-stone-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={galleryForm.imageUrl.trim()}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1555244162-803834f70033?w=600&q=80";
                    }}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Caption (English) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Wedding Buffet Setup"
                  value={galleryForm.captionEn}
                  onChange={(e) => setGalleryForm({ ...galleryForm, captionEn: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Caption (Hindi) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. शाही विवाह बुफे व्यवस्था"
                  value={galleryForm.captionHi}
                  onChange={(e) => setGalleryForm({ ...galleryForm, captionHi: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={galleryForm.sortOrder}
                    onChange={(e) => setGalleryForm({ ...galleryForm, sortOrder: e.target.value })}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="gallery-is-active"
                    checked={galleryForm.isActive}
                    onChange={(e) => setGalleryForm({ ...galleryForm, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                  />
                  <label htmlFor="gallery-is-active" className="text-sm font-semibold text-stone-700">
                    Active
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setGalleryModalOpen(false)}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingGallery || uploadingImage}
                  className="rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 disabled:opacity-60"
                >
                  {submittingGallery ? "Saving Image..." : uploadingImage ? "Uploading..." : editingGalleryId ? "Update Item" : "Add Image"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CONFIRMATION DIALOG: DELETE PACKAGE */}
      {/* ==================================================================== */}
      {deletingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-stone-900">Delete Package?</h3>
            </div>
            <p className="text-sm text-stone-600">
              Are you sure you want to delete package &quot;<strong className="text-stone-900">{deletingPackage.nameEn}</strong>&quot;?
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPackage(null)}
                disabled={deletingPackageLoading}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePackageConfirm}
                disabled={deletingPackageLoading}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 disabled:opacity-60"
              >
                {deletingPackageLoading ? "Deleting..." : "Yes, Delete Package"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD / EDIT VENUE */}
      {/* ==================================================================== */}
      {venueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleVenueSubmit}
            className="my-8 w-full max-w-2xl space-y-5 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <h3 className="text-lg font-bold text-[#3D2518]">
                {editingVenueId ? "Edit Venue" : "Add Venue"}
              </h3>
              <button
                type="button"
                onClick={() => setVenueModalOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Name (English) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Banarasia Lawn"
                  value={venueForm.nameEn}
                  onChange={(e) => setVenueForm({ ...venueForm, nameEn: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Name (Hindi) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="बनारसिया लॉन"
                  value={venueForm.nameHi}
                  onChange={(e) => setVenueForm({ ...venueForm, nameHi: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Area (English)
                </label>
                <input
                  type="text"
                  placeholder="Gomti Nagar, Lucknow"
                  value={venueForm.areaEn}
                  onChange={(e) => setVenueForm({ ...venueForm, areaEn: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Area (Hindi)
                </label>
                <input
                  type="text"
                  placeholder="गोमती नगर, लखनऊ"
                  value={venueForm.areaHi}
                  onChange={(e) => setVenueForm({ ...venueForm, areaHi: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Guest Capacity
                </label>
                <input
                  type="text"
                  placeholder="500-800"
                  value={venueForm.capacity}
                  onChange={(e) => setVenueForm({ ...venueForm, capacity: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={venueForm.sortOrder}
                  onChange={(e) => setVenueForm({ ...venueForm, sortOrder: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Notes (English)
                </label>
                <textarea
                  rows={3}
                  placeholder="Open lawn with covered dining area…"
                  value={venueForm.notesEn}
                  onChange={(e) => setVenueForm({ ...venueForm, notesEn: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-700">
                  Notes (Hindi)
                </label>
                <textarea
                  rows={3}
                  placeholder="खुला लॉन, ढका हुआ डाइनिंग क्षेत्र…"
                  value={venueForm.notesHi}
                  onChange={(e) => setVenueForm({ ...venueForm, notesHi: e.target.value })}
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm font-semibold text-stone-700">
              <input
                type="checkbox"
                checked={venueForm.isActive}
                onChange={(e) => setVenueForm({ ...venueForm, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
              />
              Active (visible on the public site)
            </label>

            <div className="flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
              <button
                type="button"
                onClick={() => setVenueModalOpen(false)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingVenue}
                className="rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 disabled:opacity-60"
              >
                {submittingVenue ? "Saving…" : editingVenueId ? "Save Venue" : "Create Venue"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CONFIRMATION DIALOG: DELETE VENUE */}
      {/* ==================================================================== */}
      {deletingVenue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-stone-900">Delete Venue?</h3>
            </div>
            <p className="text-sm text-stone-600">
              Are you sure you want to delete &quot;
              <strong className="text-stone-900">{deletingVenue.nameEn}</strong>&quot;? This action
              cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingVenue(null)}
                disabled={deletingVenueLoading}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteVenueConfirm}
                disabled={deletingVenueLoading}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 disabled:opacity-60"
              >
                {deletingVenueLoading ? "Deleting…" : "Yes, Delete Venue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CONFIRMATION DIALOG: DELETE GALLERY ITEM */}
      {/* ==================================================================== */}
      {deletingGalleryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-stone-900">Delete Gallery Item?</h3>
            </div>
            <p className="text-sm text-stone-600">
              Are you sure you want to delete this gallery item (&quot;<strong className="text-stone-900">{deletingGalleryItem.captionEn}</strong>&quot;)?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingGalleryItem(null)}
                disabled={deletingGalleryLoading}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteGalleryConfirm}
                disabled={deletingGalleryLoading}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 disabled:opacity-60"
              >
                {deletingGalleryLoading ? "Deleting..." : "Yes, Delete Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
