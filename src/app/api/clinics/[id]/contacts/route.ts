import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { logActivity, recalcReadiness } from "@/lib/data";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  if (!body.firstName || !body.lastName) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const clinic = await db.clinic.findUnique({ where: { id } });
  if (!clinic) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });

  const contact = await db.clinicContact.create({
    data: {
      clinicId: id,
      firstName: String(body.firstName),
      lastName: String(body.lastName),
      title: body.title ? String(body.title) : null,
      contactType: String(body.contactType ?? "general_contact"),
      email: body.email ? String(body.email) : null,
      directPhone: body.directPhone ? String(body.directPhone) : null,
      mobilePhone: body.mobilePhone ? String(body.mobilePhone) : null,
      linkedinUrl: body.linkedinUrl ? String(body.linkedinUrl) : null,
      preferredContactMethod: String(body.preferredContactMethod ?? "phone"),
      isDecisionMaker: Boolean(body.isDecisionMaker ?? false),
      isPrimary: Boolean(body.isPrimary ?? false),
      notes: body.notes ? String(body.notes) : null,
    },
  });

  await recalcReadiness(id);
  await logActivity({
    entityType: "clinic",
    entityId: id,
    action: "contact_added",
    summary: `Contact added — ${contact.firstName} ${contact.lastName}`,
    adminId: admin.id,
    metadata: { contactId: contact.id, contactType: contact.contactType, isDecisionMaker: contact.isDecisionMaker },
  });

  return NextResponse.json({ contact });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as { contactId: string; data: Record<string, unknown> };
  const updated = await db.clinicContact.update({ where: { id: body.contactId }, data: body.data as never });
  await recalcReadiness(id);
  await logActivity({
    entityType: "clinic",
    entityId: id,
    action: "contact_updated",
    summary: `Contact updated — ${updated.firstName} ${updated.lastName}`,
    adminId: admin.id,
  });
  return NextResponse.json({ contact: updated });
}
