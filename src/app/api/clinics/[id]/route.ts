import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { logActivity, recalcReadiness } from "@/lib/data";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const clinic = await db.clinic.findUnique({
    where: { id },
    include: {
      locations: true,
      contacts: true,
      services: true,
      callSessions: true,
      followUps: true,
      deals: true,
      directoryProfile: true,
      pipelineHistory: true,
      ownerMember: true,
      createdBy: true,
    },
  });

  if (!clinic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const activities = await db.activity.findMany({
    where: { entityId: id },
    orderBy: { timestamp: "desc" },
    take: 30,
  });

  return NextResponse.json({ 
    clinic: { 
      ...clinic, 
      services: (clinic.services || []).map((s: any) => s.service || s), 
      activities 
    } 
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRole(["admin", "operations", "sales", "directory_reviewer"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await db.clinic.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = [
    "name", "legalName", "website", "primaryPhone", "secondaryPhone", "generalEmail",
    "address", "city", "state", "zip", "country", "timezone", "numberOfLocations",
    "clinicType", "telehealth", "operatingStatus", "priority", "directoryStatus",
    "interested", "paid", "doNotCall", "archived", "owner", "notes", "nextAction", "nextActionAt",
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }
  data.updatedById = admin.id;
  if ("nextActionAt" in body && body.nextActionAt === "") data.nextActionAt = null;

  const clinic = await db.clinic.update({
    where: { id },
    data: data,
  });

  // Handle services update if provided
  if (Array.isArray(body.services)) {
    await db.clinicService.delete({ where: { clinicId: id } }).catch(() => {});
    const slugs = body.services as string[];
    for (const slug of slugs) {
      const svc = await db.service.findUnique({ where: { slug } });
      if (svc) {
        await db.clinicService.create({ 
          data: { clinicId: id, serviceId: svc.id } 
        }).catch(() => {});
      }
    }
  }

  // Handle qualification update
  if (typeof body.qualification === "object" && body.qualification !== null) {
    await db.clinic.update({ where: { id }, data: { qualification: JSON.stringify(body.qualification) } });
  }

  // Readiness override
  if ("readinessOverride" in body) {
    await db.clinic.update({
      where: { id },
      data: {
        readinessOverride: body.readinessOverride === "" || body.readinessOverride === null ? null : Number(body.readinessOverride),
        readinessOverrideReason: (body.readinessOverrideReason as string) ?? null,
      },
    });
  }

  await recalcReadiness(id);
  await logActivity({
    entityType: "clinic",
    entityId: id,
    action: "clinic_updated",
    summary: `Clinic "${clinic.name}" updated`,
    adminId: admin.id,
    metadata: { fields: Object.keys(data) },
  });

  return NextResponse.json({ clinic });
}
