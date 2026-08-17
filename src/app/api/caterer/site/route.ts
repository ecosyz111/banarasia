import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  getSiteContent,
  updateSiteContent,
  type CatererHeroBadge,
  type CatererSite,
} from "@/lib/caterer/store";

export const runtime = "nodejs";

// Plain text fields. Everything here is written into the page with textContent,
// so the only handling they need is trimming.
const TEXT_FIELDS = [
  "heroEyebrowEn",
  "heroEyebrowHi",
  "heroTitleLine1",
  "heroTitleLine2",
  "heroMottoEn",
  "heroMottoHi",
  "heroDescEn",
  "heroDescHi",
  "phonePrimary",
  "phoneSecondary",
  "addressEn",
  "addressHi",
  "hoursEn",
  "hoursHi",
  "footerDescEn",
  "footerDescHi",
  "copyrightEn",
  "copyrightHi",
  "footerTaglineEn",
  "footerTaglineHi",
] as const;

// These become an iframe src and a set of <a href>s. Same rule as the images:
// https:// only, so a saved value can never be a `javascript:` payload. An
// empty string is allowed and means "no link" — the social icons ship hidden
// and only appear once one is saved.
const URL_FIELDS = [
  "mapEmbedUrl",
  "mapLinkUrl",
  "youtubeUrl",
  "facebookUrl",
  "instagramUrl",
] as const;

function isSafeUrl(url: string): boolean {
  return url.startsWith("https://");
}

// Four badges is what the hero grid is laid out for; more would wrap into a
// ragged second row, so the extras are dropped rather than rendered badly.
const MAX_HERO_BADGES = 4;

function normaliseBadges(input: unknown): CatererHeroBadge[] | null {
  if (!Array.isArray(input)) return null;
  return input
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .map((b) => ({
      value: typeof b.value === "string" ? b.value.trim() : "",
      labelEn: typeof b.labelEn === "string" ? b.labelEn.trim() : "",
      labelHi: typeof b.labelHi === "string" ? b.labelHi.trim() : "",
    }))
    .filter((b) => b.value || b.labelEn || b.labelHi)
    .slice(0, MAX_HERO_BADGES);
}

// GET /api/caterer/site — Hero, contact and footer copy for the admin console
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const site = await getSiteContent();
    return NextResponse.json({ site });
  } catch (err: unknown) {
    console.error("GET /api/caterer/site error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve site content." },
      { status: 500 }
    );
  }
}

// PUT /api/caterer/site — Update hero, contact and footer copy
export async function PUT(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const updateData: Partial<CatererSite> = {};

    for (const key of TEXT_FIELDS) {
      const value = body?.[key];
      // An empty string is a deliberate "leave this line off the page", so it
      // is saved as-is; only a missing or non-string field is skipped.
      if (typeof value === "string") updateData[key] = value.trim();
    }

    for (const key of URL_FIELDS) {
      const value = body?.[key];
      if (typeof value !== "string") continue;
      const url = value.trim();
      if (url && !isSafeUrl(url)) {
        return NextResponse.json(
          { error: `${key} must be an https:// URL.` },
          { status: 400 }
        );
      }
      updateData[key] = url;
    }

    const badges = normaliseBadges(body?.heroBadges);
    if (badges) updateData.heroBadges = badges;

    const site = await updateSiteContent(updateData);
    return NextResponse.json({ site });
  } catch (err: unknown) {
    console.error("PUT /api/caterer/site error:", err);
    return NextResponse.json(
      { error: "Failed to update site content." },
      { status: 500 }
    );
  }
}
