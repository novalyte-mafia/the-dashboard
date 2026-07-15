import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const state = params.get("state");
  const timezone = params.get("timezone");
  const priority = params.get("priority");
  const service = params.get("service");
  const withinHours = params.get("withinHours") === "true";
  const neverContacted = params.get("neverContacted") === "true";

  // Default queue: ready_to_call + follow_up_required + attempted (needs retry), excluding DNC/archived
  const where: Prisma.ClinicWhereInput = {
    archived: false,
    doNotCall: false,
    pipelineStage: { in: ["ready_to_call", "follow_up_required", "attempted", "connected"] },
  };
  if (state) where.state = state;
  if (timezone) where.timezone = timezone;
  if (priority) where.priority = priority;
  if (service) where.services = { some: { service: { slug: service } } };
  if (neverContacted) where.lastContactedAt = null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const clinics = await db.clinic.findMany({
    where,
    include: {
      contacts: { where: { archived: false }, orderBy: [{ isPrimary: "desc" }, { isDecisionMaker: "desc" }] },
      services: { include: { service: { select: { name: true, slug: true } } } },
      followUps: { where: { status: { in: ["open", "in_progress"] } }, orderBy: { dueDate: "asc" }, take: 1 },
    },
    orderBy: [{ priority: "desc" }, { readinessScore: "desc" }, { callAttempts: "asc" }],
    take: 100,
  });

  const queue = clinics.map((c) => {
    const dm = c.contacts.find((ct) => ct.isDecisionMaker) ?? c.contacts[0] ?? null;
    const lastCall = c.callAttempts;
    return {
      id: c.id,
      name: c.name,
      city: c.city,
      state: c.state,
      timezone: c.timezone,
      primaryPhone: c.primaryPhone,
      pipelineStage: c.pipelineStage,
      priority: c.priority,
      readinessScore: c.readinessScore,
      callAttempts: lastCall,
      lastContactedAt: c.lastContactedAt,
      nextAction: c.nextAction,
      nextActionAt: c.nextActionAt,
      services: c.services.map((s) => s.service),
      decisionMaker: dm,
      followUp: c.followUps[0] ?? null,
    };
  });

  return NextResponse.json({ queue });
}
