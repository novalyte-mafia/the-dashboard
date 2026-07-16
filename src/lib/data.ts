import { db } from "@/lib/db";
import { getSessionAdmin, requireAdminRole } from "@/lib/auth";
import {
  formatCurrency,
  formatCurrencyFull,
  formatPhone,
  relativeTime,
  formatDate,
  formatDateTime,
  localTime,
  localHour,
  isWithinCallingHours,
  initials,
  fullName,
  stageLabel,
  contactTypeLabel,
  dealStageLabel,
  directoryStageLabel,
} from "@/lib/format";

// Re-export for server-side convenience
export {
  formatCurrency,
  formatCurrencyFull,
  formatPhone,
  relativeTime,
  formatDate,
  formatDateTime,
  localTime,
  localHour,
  isWithinCallingHours,
  initials,
  fullName,
  stageLabel,
  contactTypeLabel,
  dealStageLabel,
};

// Create an immutable activity event.
export async function logActivity(params: {
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  adminId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    return await db.activity.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        summary: params.summary,
        adminId: params.adminId ?? null,
        metadata: JSON.stringify(params.metadata ?? {}),
      },
    });
  } catch (e) {
    console.error("logActivity failed", e);
    return null;
  }
}

// Re-calculate a clinic's readiness score (0-100) from its data.
export async function recalcReadiness(clinicId: string) {
  const clinic = await db.clinic.findUnique({
    where: { id: clinicId },
    include: { contacts: true, services: true },
  });
  if (!clinic) return;

  let score = 0;

  if (clinic.website && /^https?:\/\//.test(clinic.website)) score += 12;
  if (clinic.primaryPhone && clinic.primaryPhone.replace(/\D/g, "").length >= 10) score += 10;
  if (clinic.contacts.some((c) => c.isDecisionMaker && !c.archived)) score += 18;
  if (clinic.generalEmail && /.+@.+\..+/.test(clinic.generalEmail)) score += 8;

  const hiPri = new Set(["trt", "glp-1", "medical-weight-loss", "peptide-therapy"]);
  if (clinic.services.some((s) => hiPri.has(s.service.slug))) score += 15;

  try {
    const q = JSON.parse(clinic.qualification || "{}");
    if (q.acceptingNewPatients === true) score += 8;
    if (q.growthInterest === "high" || q.growthInterest === "medium") score += 7;
  } catch {
    /* ignore */
  }
  if (clinic.telehealth) score += 5;
  if (clinic.numberOfLocations > 1) score += 6;
  if (clinic.interested) score += 11;

  score = Math.min(100, score);

  await db.clinic.update({
    where: { id: clinicId },
    data: { readinessScore: clinic.readinessOverride ?? score },
  });
  return score;
}

// Helper to require an active session in API routes
export async function requireAdmin() {
  return getSessionAdmin();
}

export { requireAdminRole };
