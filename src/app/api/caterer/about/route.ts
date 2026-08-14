import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getAboutRecord, updateAboutRecord } from "@/lib/caterer/store";

export const runtime = "nodejs";

// GET /api/caterer/about — Returns the default About record for admin
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const about = await getAboutRecord();
    return NextResponse.json({ about });
  } catch (err: unknown) {
    console.error("GET /api/caterer/about error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve About record." },
      { status: 500 }
    );
  }
}

// PUT /api/caterer/about — Updates the single default About record
export async function PUT(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const {
      storyTitleEn,
      storyTitleHi,
      titleEn,
      titleHi,
      descriptionEn,
      descriptionHi,
      mottoEn,
      mottoHi,
      subMottoEn,
      subMottoHi,
      establishedYear,
      stats,
      expertise,
    } = body ?? {};

    if (!descriptionEn || typeof descriptionEn !== "string" || !descriptionEn.trim()) {
      return NextResponse.json(
        { error: "Field 'descriptionEn' is required." },
        { status: 400 }
      );
    }
    if (!descriptionHi || typeof descriptionHi !== "string" || !descriptionHi.trim()) {
      return NextResponse.json(
        { error: "Field 'descriptionHi' is required." },
        { status: 400 }
      );
    }

    const currentAbout = await getAboutRecord();

    const updateData = {
      storyTitleEn: typeof storyTitleEn === "string" && storyTitleEn.trim() ? storyTitleEn.trim() : "Our Story",
      storyTitleHi: typeof storyTitleHi === "string" && storyTitleHi.trim() ? storyTitleHi.trim() : "हमारी कहानी",
      titleEn: typeof titleEn === "string" && titleEn.trim() ? titleEn.trim() : "Crafting Memorable Celebrations",
      titleHi: typeof titleHi === "string" && titleHi.trim() ? titleHi.trim() : "स्मरणोत्सवों को खास बनाना",
      descriptionEn: descriptionEn.trim(),
      descriptionHi: descriptionHi.trim(),
      mottoEn: typeof mottoEn === "string" && mottoEn.trim() ? mottoEn.trim() : '"Swad Adab Se Chakhayenge"',
      mottoHi: typeof mottoHi === "string" && mottoHi.trim() ? mottoHi.trim() : '"स्वाद अदब से चखायेंगे"',
      subMottoEn: subMottoEn === null ? null : typeof subMottoEn === "string" ? subMottoEn.trim() : "That's why we proudly say",
      subMottoHi: subMottoHi === null ? null : typeof subMottoHi === "string" ? subMottoHi.trim() : "इसलिए हम गर्व से कहते हैं",
      establishedYear: typeof establishedYear === "number" && !isNaN(establishedYear) ? establishedYear : 2015,
      stats: Array.isArray(stats) ? stats : currentAbout.stats,
      expertise: Array.isArray(expertise) ? expertise : currentAbout.expertise,
    };

    const updated = await updateAboutRecord(updateData);

    return NextResponse.json({ about: updated });
  } catch (err: unknown) {
    console.error("PUT /api/caterer/about error:", err);
    return NextResponse.json(
      { error: "Failed to update About record." },
      { status: 500 }
    );
  }
}
