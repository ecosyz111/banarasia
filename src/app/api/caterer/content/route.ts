import { NextResponse } from "next/server";
import { getCatererContentPublic } from "@/lib/caterer/store";

export const runtime = "nodejs";

// Public endpoint: GET /api/caterer/content
// Returns active packages, active gallery items, and the About record.
export async function GET() {
  try {
    const data = await getCatererContentPublic();
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("GET /api/caterer/content error:", err);
    return NextResponse.json(
      { error: "Failed to fetch caterer content." },
      { status: 500 }
    );
  }
}
