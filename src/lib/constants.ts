// Centralized business configuration for Novalyte Admin.
// Do not hardcode stage logic elsewhere — import from here.

export type StageCategory = "lead" | "outreach" | "engaged" | "directory" | "commercial" | "closed";

export interface StageConfig {
  id: string;
  label: string;
  order: number;
  category: StageCategory;
  color: string; // tailwind text/bg token base, e.g. "slate"
  active: boolean;
  nextStages: string[];
  defaultFollowUpDays?: number;
}

// Clinic pipeline stages
export const PIPELINE_STAGES: StageConfig[] = [
  { id: "imported", label: "Imported", order: 0, category: "lead", color: "slate", active: true, nextStages: ["needs_research", "invalid", "do_not_call"] },
  { id: "needs_research", label: "Needs Research", order: 1, category: "lead", color: "slate", active: true, nextStages: ["research_complete", "invalid"] },
  { id: "research_complete", label: "Research Complete", order: 2, category: "lead", color: "slate", active: true, nextStages: ["ready_to_call", "do_not_call", "invalid"], defaultFollowUpDays: 1 },
  { id: "ready_to_call", label: "Ready to Call", order: 3, category: "outreach", color: "teal", active: true, nextStages: ["attempted", "do_not_call", "invalid"] },
  { id: "attempted", label: "Attempted", order: 4, category: "outreach", color: "amber", active: true, nextStages: ["connected", "follow_up_required", "do_not_call", "invalid"], defaultFollowUpDays: 2 },
  { id: "connected", label: "Connected", order: 5, category: "outreach", color: "amber", active: true, nextStages: ["decision_maker_reached", "follow_up_required", "not_interested"] },
  { id: "decision_maker_reached", label: "Decision-Maker Reached", order: 6, category: "engaged", color: "teal", active: true, nextStages: ["follow_up_required", "meeting_booked", "interested", "not_interested"] },
  { id: "follow_up_required", label: "Follow-Up Required", order: 7, category: "engaged", color: "amber", active: true, nextStages: ["connected", "meeting_booked", "interested", "not_interested"], defaultFollowUpDays: 3 },
  { id: "meeting_booked", label: "Meeting Booked", order: 8, category: "engaged", color: "teal", active: true, nextStages: ["interested", "not_interested", "follow_up_required"] },
  { id: "interested", label: "Interested", order: 9, category: "engaged", color: "teal", active: true, nextStages: ["pilot_proposed", "proposal_sent", "not_interested"] },
  { id: "directory_approved", label: "Directory Approved", order: 10, category: "directory", color: "violet", active: true, nextStages: ["pilot_proposed", "proposal_sent"] },
  { id: "patient_demand_presented", label: "Patient Demand Presented", order: 11, category: "commercial", color: "teal", active: true, nextStages: ["pilot_proposed", "proposal_sent"] },
  { id: "pilot_proposed", label: "Pilot Proposed", order: 12, category: "commercial", color: "teal", active: true, nextStages: ["pilot_active", "proposal_sent", "not_interested"] },
  { id: "pilot_active", label: "Pilot Active", order: 13, category: "commercial", color: "teal", active: true, nextStages: ["proposal_sent", "paid"] },
  { id: "proposal_sent", label: "Proposal Sent", order: 14, category: "commercial", color: "teal", active: true, nextStages: ["paid", "not_interested"], defaultFollowUpDays: 5 },
  { id: "negotiation", label: "Negotiation", order: 15, category: "commercial", color: "amber", active: true, nextStages: ["paid", "not_interested"] },
  { id: "paid", label: "Paid", order: 16, category: "closed", color: "green", active: true, nextStages: [] },
  { id: "won", label: "Won", order: 17, category: "closed", color: "green", active: true, nextStages: [] },
  { id: "not_interested", label: "Not Interested", order: 18, category: "closed", color: "rose", active: true, nextStages: [] },
  { id: "invalid", label: "Invalid", order: 19, category: "closed", color: "slate", active: true, nextStages: [] },
  { id: "do_not_call", label: "Do Not Call", order: 20, category: "closed", color: "rose", active: true, nextStages: [] },
  { id: "lost", label: "Lost", order: 21, category: "closed", color: "slate", active: true, nextStages: [] },
];

export const STAGE_MAP: Record<string, StageConfig> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.id, s])
);

export function stageLabel(id: string): string {
  return STAGE_MAP[id]?.label ?? id;
}

// Color classes per stage color token (bg + text variants for badges)
export const STAGE_COLOR_CLASSES: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
};

export function stageBadgeClass(stageId: string): string {
  const c = STAGE_MAP[stageId]?.color ?? "slate";
  return STAGE_COLOR_CLASSES[c] ?? STAGE_COLOR_CLASSES.slate;
}

// ---------------------------------------------------------------------------
// Services catalog
// ---------------------------------------------------------------------------
export const SERVICE_CATALOG: { name: string; slug: string; category: string }[] = [
  { name: "Testosterone Replacement Therapy", slug: "trt", category: "core" },
  { name: "Hormone Optimization", slug: "hormone-optimization", category: "core" },
  { name: "Erectile Dysfunction Care", slug: "ed-care", category: "core" },
  { name: "Sexual Wellness", slug: "sexual-wellness", category: "core" },
  { name: "Medical Weight Loss", slug: "medical-weight-loss", category: "core" },
  { name: "GLP-1 Programs", slug: "glp-1", category: "core" },
  { name: "Peptide Therapy", slug: "peptide-therapy", category: "core" },
  { name: "Hair Restoration", slug: "hair-restoration", category: "core" },
  { name: "Longevity Medicine", slug: "longevity", category: "core" },
  { name: "Preventive Care", slug: "preventive-care", category: "core" },
  { name: "Performance & Recovery", slug: "performance-recovery", category: "core" },
  { name: "IV Therapy", slug: "iv-therapy", category: "core" },
  { name: "Mental Wellness", slug: "mental-wellness", category: "core" },
  { name: "Other", slug: "other", category: "other" },
];

// ---------------------------------------------------------------------------
// Priorities
// ---------------------------------------------------------------------------
export const PRIORITIES = [
  { id: "low", label: "Low", color: "bg-slate-100 text-slate-600 border-slate-200" },
  { id: "normal", label: "Normal", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { id: "high", label: "High", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "critical", label: "Critical", color: "bg-rose-50 text-rose-700 border-rose-200" },
] as const;

export function priorityBadgeClass(p: string): string {
  return PRIORITIES.find((x) => x.id === p)?.color ?? PRIORITIES[1].color;
}

// ---------------------------------------------------------------------------
// Call outcomes
// ---------------------------------------------------------------------------
export const CALL_OUTCOMES = [
  { id: "no_answer", label: "No Answer", connected: false, interested: false, color: "slate" },
  { id: "voicemail", label: "Voicemail", connected: false, interested: false, color: "slate" },
  { id: "busy", label: "Busy", connected: false, interested: false, color: "amber" },
  { id: "clinic_closed", label: "Clinic Closed", connected: false, interested: false, color: "amber" },
  { id: "gatekeeper", label: "Gatekeeper", connected: false, interested: false, color: "amber" },
  { id: "wrong_number", label: "Wrong Number", connected: false, interested: false, color: "rose" },
  { id: "disconnected_number", label: "Disconnected Number", connected: false, interested: false, color: "rose" },
  { id: "decision_maker_unavailable", label: "Decision-Maker Unavailable", connected: false, interested: false, color: "amber" },
  { id: "technical_failure", label: "Technical Failure", connected: false, interested: false, color: "rose" },
  { id: "call_back_requested", label: "Call Back Requested", connected: true, interested: false, color: "teal" },
  { id: "information_requested", label: "Information Requested", connected: true, interested: false, color: "teal" },
  { id: "connected", label: "Connected", connected: true, interested: false, color: "teal" },
  { id: "permission_granted", label: "Permission Granted", connected: true, interested: true, color: "teal" },
  { id: "permission_denied", label: "Permission Denied", connected: true, interested: false, color: "rose" },
  { id: "interested", label: "Interested", connected: true, interested: true, color: "teal" },
  { id: "meeting_booked", label: "Meeting Booked", connected: true, interested: true, color: "teal" },
  { id: "not_interested", label: "Not Interested", connected: true, interested: false, color: "rose" },
  { id: "already_has_provider", label: "Already Has Provider", connected: true, interested: false, color: "rose" },
  { id: "at_capacity", label: "At Capacity", connected: true, interested: false, color: "amber" },
  { id: "do_not_call", label: "Do Not Call", connected: true, interested: false, color: "rose" },
  { id: "other", label: "Other", connected: false, interested: false, color: "slate" },
];

export const OUTCOME_MAP: Record<string, (typeof CALL_OUTCOMES)[number]> = Object.fromEntries(
  CALL_OUTCOMES.map((o) => [o.id, o])
);

// ---------------------------------------------------------------------------
// Follow-up types
// ---------------------------------------------------------------------------
export const FOLLOWUP_TYPES = [
  { id: "phone_call", label: "Phone Call" },
  { id: "email", label: "Email" },
  { id: "meeting", label: "Meeting" },
  { id: "send_information", label: "Send Information" },
  { id: "send_directory_link", label: "Send Directory Link" },
  { id: "complete_listing", label: "Complete Listing" },
  { id: "prepare_proposal", label: "Prepare Proposal" },
  { id: "send_proposal", label: "Send Proposal" },
  { id: "proposal_follow_up", label: "Proposal Follow-Up" },
  { id: "patient_demand_update", label: "Patient Demand Update" },
  { id: "general_task", label: "General Task" },
];

export const FOLLOWUP_STATUSES = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "rescheduled", label: "Rescheduled" },
  { id: "cancelled", label: "Cancelled" },
  { id: "overdue", label: "Overdue" },
];

// ---------------------------------------------------------------------------
// Deal stages
// ---------------------------------------------------------------------------
export const DEAL_STAGES = [
  { id: "opportunity_identified", label: "Opportunity Identified", order: 0, color: "slate", probability: 10 },
  { id: "discovery_completed", label: "Discovery Completed", order: 1, color: "slate", probability: 20 },
  { id: "qualified", label: "Qualified", order: 2, color: "teal", probability: 30 },
  { id: "pilot_discussed", label: "Pilot Discussed", order: 3, color: "teal", probability: 40 },
  { id: "proposal_requested", label: "Proposal Requested", order: 4, color: "amber", probability: 45 },
  { id: "proposal_sent", label: "Proposal Sent", order: 5, color: "amber", probability: 55 },
  { id: "negotiation", label: "Negotiation", order: 6, color: "amber", probability: 65 },
  { id: "contract_sent", label: "Contract Sent", order: 7, color: "teal", probability: 80 },
  { id: "contract_signed", label: "Contract Signed", order: 8, color: "teal", probability: 90 },
  { id: "payment_pending", label: "Payment Pending", order: 9, color: "amber", probability: 95 },
  { id: "active", label: "Active", order: 10, color: "green", probability: 100 },
  { id: "won", label: "Won", order: 11, color: "green", probability: 100 },
  { id: "lost", label: "Lost", order: 12, color: "rose", probability: 0 },
  { id: "paused", label: "Paused", order: 13, color: "slate", probability: 15 },
];

export const DEAL_STAGE_MAP: Record<string, (typeof DEAL_STAGES)[number]> = Object.fromEntries(
  DEAL_STAGES.map((s) => [s.id, s])
);

export function dealStageLabel(id: string): string {
  return DEAL_STAGE_MAP[id]?.label ?? id;
}
export function dealStageBadgeClass(id: string): string {
  const c = DEAL_STAGE_MAP[id]?.color ?? "slate";
  return STAGE_COLOR_CLASSES[c] ?? STAGE_COLOR_CLASSES.slate;
}

// ---------------------------------------------------------------------------
// Directory stages
// ---------------------------------------------------------------------------
export const DIRECTORY_STAGES = [
  { id: "imported", label: "Imported", color: "slate" },
  { id: "unclaimed", label: "Unclaimed", color: "slate" },
  { id: "claim_requested", label: "Claim Requested", color: "amber" },
  { id: "identity_review", label: "Identity Review", color: "amber" },
  { id: "information_required", label: "Information Required", color: "amber" },
  { id: "approved", label: "Approved", color: "teal" },
  { id: "published", label: "Published", color: "green" },
  { id: "needs_update", label: "Needs Update", color: "amber" },
  { id: "suspended", label: "Suspended", color: "rose" },
  { id: "archived", label: "Archived", color: "slate" },
];

export const DIRECTORY_STAGE_MAP: Record<string, (typeof DIRECTORY_STAGES)[number]> = Object.fromEntries(
  DIRECTORY_STAGES.map((s) => [s.id, s])
);
export function directoryStageLabel(id: string): string {
  return DIRECTORY_STAGE_MAP[id]?.label ?? id;
}
export function directoryStageBadgeClass(id: string): string {
  const c = DIRECTORY_STAGE_MAP[id]?.color ?? "slate";
  return STAGE_COLOR_CLASSES[c] ?? STAGE_COLOR_CLASSES.slate;
}

// ---------------------------------------------------------------------------
// Contact types
// ---------------------------------------------------------------------------
export const CONTACT_TYPES = [
  { id: "owner", label: "Owner" },
  { id: "founder", label: "Founder" },
  { id: "medical_director", label: "Medical Director" },
  { id: "practice_manager", label: "Practice Manager" },
  { id: "operations_manager", label: "Operations Manager" },
  { id: "marketing_director", label: "Marketing Director" },
  { id: "clinical_director", label: "Clinical Director" },
  { id: "front_desk", label: "Front Desk" },
  { id: "general_contact", label: "General Contact" },
  { id: "other", label: "Other" },
];

export function contactTypeLabel(id: string): string {
  return CONTACT_TYPES.find((c) => c.id === id)?.label ?? id;
}

// ---------------------------------------------------------------------------
// Admin roles
// ---------------------------------------------------------------------------
export const ADMIN_ROLES = [
  { id: "founder", label: "Founder" },
  { id: "admin", label: "Admin" },
  { id: "sales", label: "Sales" },
  { id: "operations", label: "Operations" },
  { id: "directory_reviewer", label: "Directory Reviewer" },
];

export function roleLabel(id: string): string {
  return ADMIN_ROLES.find((r) => r.id === id)?.label ?? id;
}

// ---------------------------------------------------------------------------
// Saved view defaults
// ---------------------------------------------------------------------------
export const DEFAULT_SAVED_VIEWS: { name: string; filters: Record<string, unknown> }[] = [
  { name: "Ready to Call", filters: { pipelineStage: "ready_to_call" } },
  { name: "High Priority", filters: { priority: "high" } },
  { name: "Never Contacted", filters: { neverContacted: true } },
  { name: "Follow-Up Due", filters: { followUpDue: true } },
  { name: "Follow-Up Overdue", filters: { followUpOverdue: true } },
  { name: "Decision-Maker Identified", filters: { hasDecisionMaker: true } },
  { name: "Interested Clinics", filters: { interested: true } },
  { name: "Meeting Booked", filters: { pipelineStage: "meeting_booked" } },
  { name: "Proposal Outstanding", filters: { pipelineStage: "proposal_sent" } },
  { name: "Paid Clinics", filters: { paid: true } },
  { name: "Directory Unclaimed", filters: { directoryStatus: "unclaimed" } },
  { name: "Invalid Records", filters: { pipelineStage: "invalid" } },
  { name: "Do Not Call", filters: { pipelineStage: "do_not_call" } },
];

// ---------------------------------------------------------------------------
// US timezones for calling
// ---------------------------------------------------------------------------
export const US_TIMEZONES = [
  { id: "America/New_York", label: "Eastern (ET)" },
  { id: "America/Chicago", label: "Central (CT)" },
  { id: "America/Denver", label: "Mountain (MT)" },
  { id: "America/Los_Angeles", label: "Pacific (PT)" },
  { id: "America/Phoenix", label: "Arizona (MST)" },
];

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export const SESSION_COOKIE = "novalyte_admin_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
