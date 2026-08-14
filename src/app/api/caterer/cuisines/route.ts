import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getAllCuisines, createCuisine } from "@/lib/caterer/store";

export const runtime = "nodejs";

// GET /api/caterer/cuisines — All cuisine tiles (active and inactive) for admin
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const cuisines = await getAllCuisines();
    return NextResponse.json({ cuisines });
  } catch (err: unknown) {
    console.error("GET /api/caterer/cuisines error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve cuisines." },
      { status: 500 }
    );
  }
}

// POST /api/caterer/cuisines — Creates a new cuisine tile
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { nameEn, nameHi, descEn, descHi, imageUrl, sortOrder, isActive } = body ?? {};

    if (!nameEn || typeof nameEn !== "string" || !nameEn.trim()) {
      return NextResponse.json({ error: "Field 'nameEn' is required." }, { status: 400 });
    }
    if (!nameHi || typeof nameHi !== "string" || !nameHi.trim()) {
      return NextResponse.json({ error: "Field 'nameHi' is required." }, { status: 400 });
    }

    const created = await createCuisine({
      nameEn: nameEn.trim(),
      nameHi: nameHi.trim(),
      descEn: typeof descEn === "string" ? descEn.trim() : "",
      descHi: typeof descHi === "string" ? descHi.trim() : "",
      // Blank is a valid choice, not a missing value — it renders the gradient
      // tile instead of a photo card.
      imageUrl: typeof imageUrl === "string" ? imageUrl.trim() : "",
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    return NextResponse.json({ cuisine: created }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/caterer/cuisines error:", err);
    return NextResponse.json(
      { error: "Failed to create cuisine." },
      { status: 500 }
    );
  }
}
