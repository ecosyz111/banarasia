import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getAllVenues, createVenue } from "@/lib/caterer/store";

export const runtime = "nodejs";

// GET /api/caterer/venues — Returns all venues (active and inactive) for admin management
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const venues = await getAllVenues();
    return NextResponse.json({ venues });
  } catch (err: unknown) {
    console.error("GET /api/caterer/venues error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve venues." },
      { status: 500 }
    );
  }
}

// POST /api/caterer/venues — Creates a new venue
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const {
      nameEn,
      nameHi,
      areaEn,
      areaHi,
      capacity,
      imageUrl,
      notesEn,
      notesHi,
      sortOrder,
      isActive,
    } = body ?? {};

    if (!nameEn || typeof nameEn !== "string" || !nameEn.trim()) {
      return NextResponse.json(
        { error: "Field 'nameEn' is required." },
        { status: 400 }
      );
    }
    if (!nameHi || typeof nameHi !== "string" || !nameHi.trim()) {
      return NextResponse.json(
        { error: "Field 'nameHi' is required." },
        { status: 400 }
      );
    }

    const created = await createVenue({
      nameEn: nameEn.trim(),
      nameHi: nameHi.trim(),
      areaEn: typeof areaEn === "string" ? areaEn.trim() : "",
      areaHi: typeof areaHi === "string" ? areaHi.trim() : "",
      capacity: typeof capacity === "string" ? capacity.trim() : "",
      imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : "",
      notesEn: typeof notesEn === "string" ? notesEn.trim() : "",
      notesHi: typeof notesHi === "string" ? notesHi.trim() : "",
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    return NextResponse.json({ venue: created }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/caterer/venues error:", err);
    return NextResponse.json(
      { error: "Failed to create venue." },
      { status: 500 }
    );
  }
}
