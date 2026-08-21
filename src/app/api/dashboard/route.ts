import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionAdmin } from "@/lib/auth";
import { PIPELINE_STAGES } from "@/lib/constants";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    readyToCall,
    callsCompletedToday,
    followUpsDueToday,
    overdueFollowUps,
    decisionMakersReached,
    meetingsBooked,
    interestedClinics,
    activeDeals,
    proposalsOutstanding,
    pipelineValueAgg,
    revenueWonAgg,
    clinicCount,
    unclaimedDirectoryCount,
    todayFollowUps,
    overdueTasks,
    recentActivity,
    stageCountsRaw,
    callSessionsToday,
  ] = await Promise.all([
    db.clinic.count({ where: { pipelineStage: "ready_to_call", archived: false, doNotCall: false } }),
    db.callSession.count({ where: { startedAt: { gte: startOfToday, lte: endOfToday }, answered: true } }),
    db.followUpTask.count({ where: { status: { in: ["open", "in_progress"] }, dueDate: { gte: startOfToday, lte: endOfToday } } }),
    db.followUpTask.count({ where: { status: { in: ["open", "in_progress"] }, dueDate: { lt: startOfToday } } }),
    db.clinicContact.count({ where: { isDecisionMaker: true, archived: false } }),
    db.clinic.count({ where: { pipelineStage: "meeting_booked", archived: false } }),
    db.clinic.count({ where: { interested: true, archived: false } }),
    db.deal.count({ where: { archived: false, stage: { notIn: ["won", "lost"] } } }),
    db.deal.count({ where: { stage: "proposal_sent", archived: false } }),
    db.deal.aggregate({ _sum: { estimatedTotalValue: true }, where: { archived: false, stage: { notIn: ["won", "lost"] } } }),
    db.deal.aggregate({ _sum: { estimatedTotalValue: true }, where: { stage: { in: ["won", "active"] } } }),
    db.clinic.count({ where: { archived: false } }),
    db.clinic.count({ where: { archived: false, directoryStatus: { in: ["unclaimed", "imported"] } } }),
    db.followUpTask.findMany({
      where: { status: { in: ["open", "in_progress"] }, dueDate: { gte: startOfToday, lte: endOfToday } },
      include: { clinic: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    db.followUpTask.findMany({
      where: { status: { in: ["open", "in_progress"] }, dueDate: { lt: startOfToday } },
      include: { clinic: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    db.activity.findMany({ orderBy: { timestamp: "desc" }, take: 12, include: { admin: { select: { firstName: true, lastName: true } } } }),
    db.clinic.groupBy({ by: ["pipelineStage"], where: { archived: false }, _count: true }),
    db.callSession.findMany({ where: { startedAt: { gte: startOfToday, lte: endOfToday } }, include: { clinic: { select: { name: true, city: true, state: true } } }, orderBy: { startedAt: "desc" }, take: 6 }),
  ]);

  // Build priorities dynamically
  const priorities: { label: string; count: number; href: string; tone: string }[] = [];
  if (readyToCall > 0) priorities.push({ label: "Call ready-to-call clinics", count: readyToCall, href: "call-queue", tone: "teal" });
  if (overdueFollowUps > 0) priorities.push({ label: "Complete overdue follow-ups", count: overdueFollowUps, href: "follow-ups", tone: "rose" });
  if (followUpsDueToday > 0) priorities.push({ label: "Complete today's follow-ups", count: followUpsDueToday, href: "follow-ups", tone: "amber" });
  if (interestedClinics > 0) priorities.push({ label: "Review interested clinics", count: interestedClinics, href: "clinics", tone: "teal" });
  if (proposalsOutstanding > 0) priorities.push({ label: "Send requested proposals", count: proposalsOutstanding, href: "deals", tone: "amber" });
  if (unclaimedDirectoryCount > 0) priorities.push({ label: "Complete directory profiles", count: unclaimedDirectoryCount, href: "directory", tone: "violet" });
  if (meetingsBooked > 0) priorities.push({ label: "Prep upcoming meetings", count: meetingsBooked, href: "follow-ups", tone: "teal" });

  // Pipeline snapshot (only active outreach stages)
  const snapshotStages = ["ready_to_call", "attempted", "connected", "follow_up_required", "meeting_booked", "interested", "proposal_sent", "paid"];
  const stageCounts: Record<string, number> = {};
  for (const s of stageCountsRaw) stageCounts[s.pipelineStage] = s._count;
  const pipelineSnapshot = snapshotStages.map((id) => ({
    stage: id,
    label: PIPELINE_STAGES.find((s) => s.id === id)?.label ?? id,
    count: stageCounts[id] ?? 0,
  }));

  // Revenue won this month
  const revenueWonThisMonth = await db.deal.aggregate({
    _sum: { estimatedTotalValue: true },
    where: { stage: { in: ["won", "active"] }, updatedAt: { gte: startOfMonth } },
  });

  return NextResponse.json({
    metrics: {
      readyToCall,
      callsCompletedToday,
      followUpsDue: followUpsDueToday,
      followUpsDueToday,
      overdueFollowUps,
      decisionMakersReached,
      meetingsBooked,
      interestedClinics,
      activeOpportunities: activeDeals,
      proposalsOutstanding,
      estimatedPipelineValue: pipelineValueAgg._sum.estimatedTotalValue ?? 0,
      revenueWonThisMonth: revenueWonThisMonth._sum.estimatedTotalValue ?? 0,
      revenueWon: revenueWonAgg._sum.estimatedTotalValue ?? 0,
      clinicCount,
      patientLeads: 0,
      qualifiedPatientLeads: 0,
    },
    conversionMetrics: {
      dialToConnect: 0,
      connectToConversation: 0,
      conversationToInterest: 0,
      interestToMeeting: 0,
      meetingToProposal: 0,
      proposalToClose: 0,
      leadToBooking: 0,
      followUpCompletion: 0,
      avgDealValue: 0,
      avgSalesCycle: 0,
    },
    priorities,
    pipelineSnapshot,
    todayFollowUps,
    overdueTasks,
    recentActivity,
    callSessionsToday,
    recentCalls: callSessionsToday,
    dealAlerts: [],
    patientDemandAlerts: [],
    nextBestCall: null,
  });
}
