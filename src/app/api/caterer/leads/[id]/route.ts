import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { deleteLead, getLeadById, updateLead } from "@/lib/caterer/store";

export const runtime = "nodejs";

// PATCH /api/caterer/leads/[id] — Mark a lead new / contacted
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid or missing lead ID." }, { status: 400 });
    }

    const existing = await getLeadById(id);
    if (!existing) {
      return NextResponse.json({ error: `Lead with ID '${id}' not found.` }, { status: 404 });
    }

    const body = await req.json();
    // Status is the only mutable field: the rest is what the visitor typed and
    // stays as submitted.
    if (body.status !== "new" && body.status !== "contacted") {
      return NextResponse.json(
        { error: "Field 'status' must be 'new' or 'contacted'." },
        { status: 400 }
      );
    }

    const updated = await updateLead(id, { status: body.status });
    return NextResponse.json({ lead: updated });
  } catch (err: unknown) {
    console.error("PATCH /api/caterer/leads/[id] error:", err);
    return NextResponse.json({ error: "Failed to update lead." }, { status: 500 });
  }
}

// DELETE /api/caterer/leads/[id] — Remove a lead
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid or missing lead ID." }, { status: 400 });
    }

    const existing = await getLeadById(id);
    if (!existing) {
      return NextResponse.json({ error: `Lead with ID '${id}' not found.` }, { status: 404 });
    }

    await deleteLead(id);
    return NextResponse.json({ ok: true, deletedId: id });
  } catch (err: unknown) {
    console.error("DELETE /api/caterer/leads/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete lead." }, { status: 500 });
  }
}
