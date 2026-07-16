import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import { logActivity, recalcReadiness } from "@/lib/data";

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const stage = params.get("stage");
  const priority = params.get("priority");
  const state = params.get("state");
  const directoryStatus = params.get("directoryStatus");
  const interested = params.get("interested");
  const paid = params.get("paid");
  const doNotCall = params.get("doNotCall");
  const hasDecisionMaker = params.get("hasDecisionMaker");
  const neverContacted = params.get("neverContacted");
  const followUpDue = params.get("followUpDue");
  const followUpOverdue = params.get("followUpOverdue");
  const archived = params.get("archived") === "true";

  const where: any = { archived };

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { city: { contains: q } },
      { state: { contains: q } },
      { primaryPhone: { contains: q } },
      { generalEmail: { contains: q } },
    ];
  }
  if (stage) where.pipelineStage = stage;
  if (priority) where.priority = priority;
  if (state) where.state = state;
  if (directoryStatus) where.directoryStatus = directoryStatus;
  if (interested === "true") where.interested = true;
  if (paid === "true") where.paid = true;
  if (doNotCall === "true") where.doNotCall = true;
  if (neverContacted === "true") where.lastContactedAt = null;

  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(params.get("pageSize") ?? "25", 10)));
  const sortBy = params.get("sortBy") ?? "updatedAt";
  const sortDir = params.get("sortDir") === "asc" ? "asc" : "desc";

  const allowedSort = ["name", "city", "state", "pipelineStage", "priority", "readinessScore", "lastContactedAt", "nextActionAt", "callAttempts", "dealValue", "updatedAt", "createdAt"];
  const orderBy: any = { [allowedSort.includes(sortBy) ? sortBy : "updatedAt"]: sortDir };

  const [total, clinics] = await Promise.all([
    db.clinic.count({ where }),
    db.clinic.findMany({
      where,
      include: { contacts: true, services: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    clinics: clinics.map((c: any) => ({
      ...c,
      estimatedValue: c.dealValue ?? 0,
      tags: [],
      source: c.externalId ? "5k-accounts.csv" : "manual",
      verificationStatus: "pending",
      profileCompletion: c.directoryStatus === "published" ? 100 : 10,
      services: (c.services || []).map((s: any) => s.service?.slug || s.slug || s.serviceId).filter(Boolean),
      hasDecisionMaker: (c.contacts || []).some((ct: any) => ct.isDecisionMaker),
      primaryContact: (c.contacts || []).find((ct: any) => ct.isPrimary) ?? (c.contacts || [])[0] ?? null,
    })),
    total,
    page,
    pageSize,
  });
}

const createSchema = {
  parse(body: unknown) {
    if (typeof body !== "object" || body === null) throw new Error("Invalid body");
    const b = body as Record<string, unknown>;
    return {
      name: String(b.name ?? ""),
      website: b.website ? String(b.website) : null,
      primaryPhone: b.primaryPhone ? String(b.primaryPhone) : null,
      generalEmail: b.generalEmail ? String(b.generalEmail) : null,
      city: b.city ? String(b.city) : null,
      state: b.state ? String(b.state) : null,
      zip: b.zip ? String(b.zip) : null,
      timezone: b.timezone ? String(b.timezone) : "America/New_York",
      clinicType: b.clinicType ? String(b.clinicType) : "private_practice",
      telehealth: Boolean(b.telehealth),
      pipelineStage: b.pipelineStage ? String(b.pipelineStage) : "imported",
      priority: b.priority ? String(b.priority) : "normal",
      notes: b.notes ? String(b.notes) : null,
      services: Array.isArray(b.services) ? (b.services as string[]) : [],
    };
  },
};

export async function POST(req: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "sales"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = createSchema.parse(await req.json());
  if (!body.name?.trim()) return NextResponse.json({ error: "Clinic name is required." }, { status: 400 });

  const clinic = await db.clinic.create({
    data: {
      name: body.name,
      website: body.website,
      primaryPhone: body.primaryPhone,
      generalEmail: body.generalEmail,
      city: body.city,
      state: body.state,
      zip: body.zip,
      timezone: body.timezone,
      clinicType: body.clinicType,
      telehealth: body.telehealth,
      pipelineStage: body.pipelineStage,
      priority: body.priority,
      notes: body.notes,
      createdById: admin.id,
      updatedById: admin.id,
      ownerId: admin.id
    }
  });

  // Handle service mappings if provided
  if (body.services && body.services.length > 0) {
    for (const serviceSlug of body.services) {
      const taxonomy = await db.service.findUnique({ where: { slug: serviceSlug } });
      if (taxonomy) {
        await db.clinicService.create({
          data: {
            clinicId: clinic.id,
            serviceId: taxonomy.id,
            pricingModel: "unknown"
          }
        });
      }
    }
  }

  await recalcReadiness(clinic.id);
  
  await db.clinicPipelineHistory.create({
    data: { clinicId: clinic.id, toStage: body.pipelineStage, changedById: admin.id, notes: "Clinic created" },
  });

  await logActivity({
    entityType: "clinic",
    entityId: clinic.id,
    action: "clinic_created",
    summary: `Clinic "${clinic.name}" added`,
    adminId: admin.id,
    metadata: { stage: clinic.pipelineStage, city: clinic.city, state: clinic.state },
  });

  return NextResponse.json({ clinic });
}
