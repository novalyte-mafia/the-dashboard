/**
 * Novalyte Admin — Centralized Mock Data
 *
 * All mock data lives here. Repositories read from these arrays when
 * appConfig.mockMode is true. Replace with real API calls when backend
 * services are connected.
 */
import type {
  AdminMember, Clinic, ClinicContact, CallSession, FollowUpTask, Deal,
  DirectoryProfile, PatientLead, ClinicMatch, MarketData, Campaign,
  Professional, JobListing, JobApplication, Product, Order, Article,
  Automation, AIUsageRecord, Integration, AuditEvent, NotificationItem,
  ActivityEvent,
} from "@/types";

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000).toISOString();
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600000).toISOString();
const hoursFromNow = (n: number) => new Date(now.getTime() + n * 3600000).toISOString();

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------
export const mockAdmins: AdminMember[] = [
  { id: "adm_1", email: "founder@novalyte.io", role: "founder", status: "active", firstName: "Jamil", lastName: "Yakasai", lastLoginAt: hoursAgo(2), createdAt: daysAgo(120) },
  { id: "adm_2", email: "ops@novalyte.io", role: "admin", status: "active", firstName: "Amani", lastName: "Okafor", lastLoginAt: daysAgo(1), createdAt: daysAgo(90) },
  { id: "adm_3", email: "sales@novalyte.io", role: "sales", status: "active", firstName: "Devon", lastName: "Marsh", lastLoginAt: daysAgo(3), createdAt: daysAgo(60) },
];

// ---------------------------------------------------------------------------
// Clinics + Contacts
// ---------------------------------------------------------------------------
function makeContact(partial: Partial<ClinicContact> & { firstName: string; lastName: string }): ClinicContact {
  return {
    id: `ct_${Math.random().toString(36).slice(2, 9)}`,
    clinicId: "",
    contactType: "general_contact",
    preferredContactMethod: "phone",
    isDecisionMaker: false,
    isPrimary: false,
    consentStatus: "unknown",
    archived: false,
    ...partial,
  };
}

interface SeedClinic {
  name: string; city: string; state: string; zip: string; timezone: string;
  website?: string; phone?: string; email?: string; clinicType?: string;
  telehealth?: boolean; locations?: number; providers?: number;
  stage: string; priority: string; readiness: number; opportunity?: number;
  lastContactedDaysAgo?: number; nextAction?: string; nextActionDays?: number;
  callAttempts?: number; interested?: boolean; paid?: boolean; dnc?: boolean;
  directoryStatus?: string; verification?: string; profileCompletion?: number;
  estimatedValue?: number; owner?: string; services: string[];
  contacts: (Partial<ClinicContact> & { firstName: string; lastName: string })[];
  lat?: number; lng?: number; tags?: string[]; source?: string;
}

const clinicSeeds: SeedClinic[] = [
  {
    name: "Summit Vitality Clinic", city: "Austin", state: "TX", zip: "78701", timezone: "America/Chicago",
    website: "https://summitvitality.com", phone: "(512) 555-0142", email: "info@summitvitality.com",
    clinicType: "group", telehealth: true, locations: 3, providers: 5,
    stage: "proposal_sent", priority: "critical", readiness: 88, opportunity: 92,
    lastContactedDaysAgo: 2, nextAction: "Follow up on proposal", nextActionDays: 0,
    callAttempts: 4, interested: true, directoryStatus: "approved", verification: "verified",
    profileCompletion: 92, estimatedValue: 96000, owner: "Jamil Yakasai",
    services: ["trt", "glp-1", "peptide-therapy", "iv-therapy"],
    tags: ["high-value", "expansion"], source: "manual_research",
    contacts: [
      { firstName: "Marcus", lastName: "Cole", title: "Medical Director", contactType: "medical_director", email: "mcole@summitvitality.com", directPhone: "(512) 555-0143", isDecisionMaker: true, isPrimary: true },
      { firstName: "Priya", lastName: "Shah", title: "Practice Manager", contactType: "practice_manager", email: "priya@summitvitality.com", directPhone: "(512) 555-0144" },
    ],
  },
  {
    name: "Pacific Men's Health", city: "Los Angeles", state: "CA", zip: "90024", timezone: "America/Los_Angeles",
    website: "https://pacificmenshealth.com", phone: "(310) 555-0198", email: "hello@pacificmenshealth.com",
    clinicType: "group", telehealth: true, locations: 2, providers: 4,
    stage: "meeting_booked", priority: "high", readiness: 81, opportunity: 78,
    lastContactedDaysAgo: 4, nextAction: "Discovery call with founder", nextActionDays: 1,
    callAttempts: 3, interested: true, directoryStatus: "approved", verification: "pending",
    profileCompletion: 70, estimatedValue: 54000, owner: "Jamil Yakasai",
    services: ["trt", "ed-care", "sexual-wellness", "peptide-therapy"],
    contacts: [{ firstName: "David", lastName: "Lin", title: "Founder", contactType: "founder", email: "david@pacificmenshealth.com", mobilePhone: "(310) 555-0199", isDecisionMaker: true, isPrimary: true }],
  },
  {
    name: "Evergreen Hormone Clinic", city: "Seattle", state: "WA", zip: "98101", timezone: "America/Los_Angeles",
    website: "https://evergreenhormone.com", phone: "(206) 555-0121", email: "care@evergreenhormone.com",
    clinicType: "private_practice", telehealth: true,
    stage: "interested", priority: "high", readiness: 74, opportunity: 68,
    lastContactedDaysAgo: 6, nextAction: "Send proposal", nextActionDays: 2,
    callAttempts: 5, interested: true, directoryStatus: "unclaimed", verification: "pending",
    profileCompletion: 35, estimatedValue: 42000, owner: "Devon Marsh",
    services: ["hormone-optimization", "trt", "longevity"],
    contacts: [
      { firstName: "Rachel", lastName: "Owens", title: "Owner / NP", contactType: "owner", email: "rachel@evergreenhormone.com", directPhone: "(206) 555-0122", isDecisionMaker: true, isPrimary: true },
      { firstName: "Tara", lastName: "Mills", title: "Front Desk", contactType: "front_desk", directPhone: "(206) 555-0121" },
    ],
  },
  {
    name: "Cardinal Performance Medicine", city: "Columbus", state: "OH", zip: "43215", timezone: "America/New_York",
    website: "https://cardinalperformance.com", phone: "(614) 555-0177",
    clinicType: "private_practice", telehealth: false, providers: 3,
    stage: "pilot_active", priority: "critical", readiness: 90, opportunity: 95,
    lastContactedDaysAgo: 1, nextAction: "Check pilot metrics", nextActionDays: 2,
    callAttempts: 6, interested: true, paid: true, directoryStatus: "published", verification: "verified",
    profileCompletion: 98, estimatedValue: 120000, owner: "Jamil Yakasai",
    services: ["trt", "performance-recovery", "peptide-therapy", "iv-therapy"],
    contacts: [{ firstName: "Andre", lastName: "Brooks", title: "Medical Director", contactType: "medical_director", email: "andre@cardinalperformance.com", directPhone: "(614) 555-0178", isDecisionMaker: true, isPrimary: true }],
  },
  {
    name: "Gulf Coast Wellness Center", city: "Houston", state: "TX", zip: "77002", timezone: "America/Chicago",
    website: "https://gulfcoastwellness.com", phone: "(713) 555-0150", email: "admin@gulfcoastwellness.com",
    clinicType: "group", telehealth: true, locations: 4, providers: 8,
    stage: "decision_maker_reached", priority: "high", readiness: 79, opportunity: 82,
    lastContactedDaysAgo: 3, nextAction: "Follow up with operations manager", nextActionDays: 1,
    callAttempts: 3, interested: true, directoryStatus: "unclaimed", verification: "pending",
    profileCompletion: 40, estimatedValue: 60000, owner: "Devon Marsh",
    services: ["medical-weight-loss", "glp-1", "iv-therapy", "mental-wellness"],
    contacts: [
      { firstName: "Vanessa", lastName: "Reyes", title: "Operations Manager", contactType: "operations_manager", email: "vanessa@gulfcoastwellness.com", directPhone: "(713) 555-0151", isDecisionMaker: true, isPrimary: true },
      { firstName: "Greg", lastName: "Patterson", title: "Owner", contactType: "owner", email: "greg@gulfcoastwellness.com" },
    ],
  },
  {
    name: "Northstar TRT Clinic", city: "Minneapolis", state: "MN", zip: "55401", timezone: "America/Chicago",
    website: "https://northstartrt.com", phone: "(612) 555-0166",
    clinicType: "private_practice", telehealth: true,
    stage: "ready_to_call", priority: "high", readiness: 72, opportunity: 65,
    callAttempts: 0, directoryStatus: "imported", verification: "pending",
    profileCompletion: 20, estimatedValue: 0, owner: "Devon Marsh",
    services: ["trt", "hormone-optimization"],
    contacts: [{ firstName: "Unknown", lastName: "Decision Maker", contactType: "general_contact", directPhone: "(612) 555-0166" }],
  },
  {
    name: "Meridian Aesthetics & Wellness", city: "Phoenix", state: "AZ", zip: "85012", timezone: "America/Phoenix",
    website: "https://meridianaesthetics.com", phone: "(602) 555-0188", email: "info@meridianaesthetics.com",
    clinicType: "group", telehealth: false, locations: 2,
    stage: "ready_to_call", priority: "normal", readiness: 66, opportunity: 55,
    callAttempts: 0, directoryStatus: "imported", verification: "pending",
    profileCompletion: 15, estimatedValue: 0, owner: "Devon Marsh",
    services: ["hair-restoration", "iv-therapy", "sexual-wellness", "peptide-therapy"],
    contacts: [{ firstName: "Info", lastName: "Desk", contactType: "front_desk", email: "info@meridianaesthetics.com", directPhone: "(602) 555-0188" }],
  },
  {
    name: "Brightside Longevity Clinic", city: "Miami", state: "FL", zip: "33101", timezone: "America/New_York",
    website: "https://brightsidelongevity.com", phone: "(305) 555-0133", email: "contact@brightsidelongevity.com",
    clinicType: "private_practice", telehealth: true,
    stage: "attempted", priority: "high", readiness: 70, opportunity: 72,
    lastContactedDaysAgo: 1, nextAction: "Retry call — DM unavailable", nextActionDays: 0,
    callAttempts: 2, directoryStatus: "imported", verification: "pending",
    profileCompletion: 25, estimatedValue: 0, owner: "Jamil Yakasai",
    services: ["longevity", "trt", "peptide-therapy", "preventive-care"],
    contacts: [{ firstName: "Elena", lastName: "Castro", title: "Owner", contactType: "owner", email: "elena@brightsidelongevity.com", directPhone: "(305) 555-0134", isDecisionMaker: true, isPrimary: true }],
  },
  {
    name: "Rocky Mountain Men's Health", city: "Denver", state: "CO", zip: "80202", timezone: "America/Denver",
    website: "https://rmmenshealth.com", phone: "(303) 555-0144",
    clinicType: "group", telehealth: true, locations: 3,
    stage: "follow_up_required", priority: "high", readiness: 77, opportunity: 74,
    lastContactedDaysAgo: 8, nextAction: "Send information packet", nextActionDays: -1,
    callAttempts: 3, interested: true, directoryStatus: "unclaimed", verification: "pending",
    profileCompletion: 40, estimatedValue: 48000, owner: "Devon Marsh",
    services: ["trt", "ed-care", "hormone-optimization"],
    contacts: [{ firstName: "Tom", lastName: "Becker", title: "Practice Manager", contactType: "practice_manager", email: "tom@rmmenshealth.com", directPhone: "(303) 555-0145", isDecisionMaker: true, isPrimary: true }],
  },
  {
    name: "Coastal Medical Weight Loss", city: "Charleston", state: "SC", zip: "29401", timezone: "America/New_York",
    website: "https://coastalweightloss.com", phone: "(843) 555-0190", email: "team@coastalweightloss.com",
    clinicType: "private_practice", telehealth: true,
    stage: "connected", priority: "normal", readiness: 64, opportunity: 58,
    lastContactedDaysAgo: 2, nextAction: "Qualify decision-maker", nextActionDays: 2,
    callAttempts: 2, directoryStatus: "imported", verification: "pending",
    profileCompletion: 18, estimatedValue: 0, owner: "Devon Marsh",
    services: ["medical-weight-loss", "glp-1"],
    contacts: [{ firstName: "Dana", lastName: "Whitfield", title: "Front Desk", contactType: "front_desk", directPhone: "(843) 555-0190" }],
  },
  {
    name: "Apex IV & Recovery", city: "Las Vegas", state: "NV", zip: "89101", timezone: "America/Los_Angeles",
    website: "https://apexivrecovery.com", phone: "(702) 555-0125",
    clinicType: "group", telehealth: false, locations: 2,
    stage: "research_complete", priority: "normal", readiness: 58, opportunity: 52,
    callAttempts: 0, directoryStatus: "imported", verification: "pending",
    profileCompletion: 12, estimatedValue: 0, owner: "Devon Marsh",
    services: ["iv-therapy", "performance-recovery", "peptide-therapy"],
    contacts: [],
  },
  {
    name: "Lone Star Vitality", city: "Dallas", state: "TX", zip: "75201", timezone: "America/Chicago",
    website: "https://lonestarvitality.com", phone: "(214) 555-0119",
    clinicType: "private_practice", telehealth: true,
    stage: "needs_research", priority: "normal", readiness: 40, opportunity: 35,
    callAttempts: 0, directoryStatus: "imported", verification: "pending",
    profileCompletion: 8, estimatedValue: 0, owner: "Devon Marsh",
    services: ["trt", "hormone-optimization"],
    contacts: [],
  },
  {
    name: "Harbor Wellness Collective", city: "Portland", state: "OR", zip: "97201", timezone: "America/Los_Angeles",
    website: "https://harborwellnessco.com", phone: "(503) 555-0157",
    clinicType: "private_practice", telehealth: true,
    stage: "imported", priority: "low", readiness: 30, opportunity: 25,
    callAttempts: 0, directoryStatus: "imported", verification: "pending",
    profileCompletion: 5, estimatedValue: 0, owner: "Devon Marsh",
    services: ["mental-wellness", "iv-therapy"],
    contacts: [],
  },
  {
    name: "Summit Edge Anti-Aging", city: "Salt Lake City", state: "UT", zip: "84101", timezone: "America/Denver",
    website: "https://summitedgeantiaging.com", phone: "(801) 555-0132",
    clinicType: "private_practice", telehealth: false,
    stage: "not_interested", priority: "low", readiness: 52, opportunity: 30,
    lastContactedDaysAgo: 10, callAttempts: 2, directoryStatus: "imported", verification: "pending",
    profileCompletion: 22, estimatedValue: 0, owner: "Devon Marsh",
    services: ["hormone-optimization", "longevity"],
    contacts: [{ firstName: "Karen", lastName: "Bishop", title: "Owner", contactType: "owner", directPhone: "(801) 555-0132", isDecisionMaker: true, isPrimary: true }],
  },
  {
    name: "Bluegrass Men's Clinic", city: "Lexington", state: "KY", zip: "40507", timezone: "America/New_York",
    website: "https://bluegrassmensclinic.com", phone: "(859) 555-0148",
    clinicType: "private_practice", telehealth: true,
    stage: "do_not_call", priority: "low", readiness: 20, opportunity: 5,
    lastContactedDaysAgo: 20, callAttempts: 1, dnc: true, directoryStatus: "archived", verification: "pending",
    profileCompletion: 10, estimatedValue: 0, owner: "Devon Marsh",
    services: ["trt", "ed-care"],
    contacts: [],
  },
  {
    name: "Pioneer Health & Hormone", city: "Oklahoma City", state: "OK", zip: "73102", timezone: "America/Chicago",
    website: "https://pioneerhealthhormone.com", phone: "(405) 555-0163", email: "office@pioneerhealthhormone.com",
    clinicType: "private_practice", telehealth: true,
    stage: "paid", priority: "normal", readiness: 92, opportunity: 90,
    lastContactedDaysAgo: 5, nextAction: "Quarterly check-in", nextActionDays: 30,
    callAttempts: 8, interested: true, paid: true, directoryStatus: "published", verification: "verified",
    profileCompletion: 95, estimatedValue: 48000, owner: "Jamil Yakasai",
    services: ["trt", "hormone-optimization", "peptide-therapy"],
    contacts: [{ firstName: "Henry", lastName: "Walsh", title: "Owner", contactType: "owner", email: "henry@pioneerhealthhormone.com", directPhone: "(405) 555-0164", isDecisionMaker: true, isPrimary: true }],
  },
];

export const mockClinics: Clinic[] = clinicSeeds.map((s, i) => {
  const id = `cln_${i + 1}`;
  const contacts = s.contacts.map((c) => makeContact({ ...c, clinicId: id }));
  return {
    id,
    name: s.name,
    legalName: s.name + " LLC",
    website: s.website,
    primaryPhone: s.phone,
    generalEmail: s.email,
    address: `${100 + i} Main St`,
    city: s.city,
    state: s.state,
    zip: s.zip,
    country: "US",
    latitude: 25 + i * 1.5,
    longitude: -80 - i * 1.2,
    timezone: s.timezone,
    numberOfLocations: s.locations ?? 1,
    numberOfProviders: s.providers,
    clinicType: (s.clinicType as Clinic["clinicType"]) ?? "private_practice",
    telehealth: s.telehealth ?? false,
    operatingStatus: "operating",
    pipelineStage: s.stage as Clinic["pipelineStage"],
    priority: s.priority as Clinic["priority"],
    readinessScore: s.readiness,
    opportunityScore: s.opportunity,
    leadScore: Math.round(s.readiness * 0.8),
    callAttempts: s.callAttempts ?? 0,
    lastContactedAt: s.lastContactedDaysAgo != null ? daysAgo(s.lastContactedDaysAgo) : undefined,
    nextAction: s.nextAction,
    nextActionAt: s.nextActionDays != null ? daysFromNow(s.nextActionDays) : undefined,
    interested: s.interested ?? false,
    paid: s.paid ?? false,
    doNotCall: s.dnc ?? false,
    archived: false,
    directoryStatus: (s.directoryStatus ?? "imported") as Clinic["directoryStatus"],
    verificationStatus: (s.verification ?? "pending") as Clinic["verificationStatus"],
    profileCompletion: s.profileCompletion ?? 0,
    estimatedValue: s.estimatedValue ?? 0,
    owner: s.owner,
    tags: s.tags ?? [],
    source: s.source ?? "import",
    services: s.services,
    contacts,
    dateImported: daysAgo(30 - i),
    createdAt: daysAgo(30 - i),
    updatedAt: daysAgo(Math.max(0, (s.lastContactedDaysAgo ?? 1) - 1)),
  };
});

// ---------------------------------------------------------------------------
// Call Sessions
// ---------------------------------------------------------------------------
export const mockCalls: CallSession[] = [
  { id: "call_1", clinicId: "cln_1", clinicName: "Summit Vitality Clinic", contactName: "Marcus Cole", startedAt: hoursAgo(48), endedAt: hoursAgo(48), durationSec: 1320, direction: "outbound", attemptNumber: 4, answered: true, decisionMakerReached: true, outcome: "connected", interestLevel: "hot", followUpRequired: false, objections: [], notes: "Reviewed proposal terms, asked for patient demand report.", nextAction: "Send patient demand update", adminName: "Jamil Yakasai" },
  { id: "call_2", clinicId: "cln_2", clinicName: "Pacific Men's Health", contactName: "David Lin", startedAt: hoursAgo(96), endedAt: hoursAgo(96), durationSec: 1800, direction: "outbound", attemptNumber: 3, answered: true, decisionMakerReached: true, outcome: "meeting_booked", interestLevel: "hot", followUpRequired: false, objections: [], notes: "Booked discovery call.", adminName: "Jamil Yakasai" },
  { id: "call_3", clinicId: "cln_4", clinicName: "Cardinal Performance Medicine", contactName: "Andre Brooks", startedAt: hoursAgo(24), endedAt: hoursAgo(24), durationSec: 720, direction: "outbound", attemptNumber: 6, answered: true, decisionMakerReached: true, outcome: "connected", interestLevel: "hot", followUpRequired: false, objections: [], notes: "Pilot going well, +18% inquiries.", adminName: "Jamil Yakasai" },
  { id: "call_4", clinicId: "cln_8", clinicName: "Brightside Longevity Clinic", contactName: "Elena Castro", startedAt: hoursAgo(24), durationSec: 180, direction: "outbound", attemptNumber: 2, answered: true, decisionMakerReached: false, outcome: "decision_maker_unavailable", interestLevel: "unknown", followUpRequired: false, objections: [], notes: "Front desk said Elena traveling.", adminName: "Jamil Yakasai" },
  { id: "call_5", clinicId: "cln_9", clinicName: "Rocky Mountain Men's Health", contactName: "Tom Becker", startedAt: hoursAgo(192), durationSec: 660, direction: "outbound", attemptNumber: 3, answered: true, decisionMakerReached: true, outcome: "call_back_requested", interestLevel: "warm", followUpRequired: false, objections: ["Want to think about it"], notes: "Wants info before next talk.", adminName: "Devon Marsh" },
  { id: "call_6", clinicId: "cln_3", clinicName: "Evergreen Hormone Clinic", contactName: "Rachel Owens", startedAt: hoursAgo(144), durationSec: 1500, direction: "outbound", attemptNumber: 5, answered: true, decisionMakerReached: true, outcome: "interested", interestLevel: "hot", followUpRequired: false, objections: [], notes: "Ready for proposal.", adminName: "Devon Marsh" },
  { id: "call_7", clinicId: "cln_14", clinicName: "Summit Edge Anti-Aging", contactName: "Karen Bishop", startedAt: hoursAgo(240), durationSec: 300, direction: "outbound", attemptNumber: 2, answered: true, decisionMakerReached: true, outcome: "not_interested", interestLevel: "cold", followUpRequired: false, objections: ["Marketing budget frozen", "Already has agency"], notes: "Budget frozen.", adminName: "Devon Marsh" },
  { id: "call_8", clinicId: "cln_5", clinicName: "Gulf Coast Wellness Center", contactName: "Vanessa Reyes", startedAt: hoursAgo(72), durationSec: 1140, direction: "outbound", attemptNumber: 3, answered: true, decisionMakerReached: true, outcome: "connected", interestLevel: "warm", followUpRequired: false, objections: [], notes: "Vanessa interested, will discuss with owner.", adminName: "Devon Marsh" },
];

// ---------------------------------------------------------------------------
// Follow-up Tasks
// ---------------------------------------------------------------------------
export const mockFollowUps: FollowUpTask[] = [
  { id: "fu_1", title: "Send patient demand report to Marcus", clinicId: "cln_1", clinicName: "Summit Vitality Clinic", taskType: "patient_demand_update", priority: "critical", dueDate: daysFromNow(0), status: "open", notes: "He asked for ZIP-level demand data.", assignedAdminName: "Jamil Yakasai", createdAt: daysAgo(2) },
  { id: "fu_2", title: "Proposal follow-up call", clinicId: "cln_1", clinicName: "Summit Vitality Clinic", taskType: "proposal_follow_up", priority: "critical", dueDate: daysFromNow(3), status: "open", assignedAdminName: "Jamil Yakasai", createdAt: daysAgo(2) },
  { id: "fu_3", title: "Discovery call with David Lin", clinicId: "cln_2", clinicName: "Pacific Men's Health", taskType: "meeting", priority: "high", dueDate: daysFromNow(1), status: "open", assignedAdminName: "Jamil Yakasai", createdAt: daysAgo(4) },
  { id: "fu_4", title: "Prepare proposal for Evergreen", clinicId: "cln_3", clinicName: "Evergreen Hormone Clinic", taskType: "prepare_proposal", priority: "high", dueDate: daysFromNow(2), status: "in_progress", assignedAdminName: "Devon Marsh", createdAt: daysAgo(3) },
  { id: "fu_5", title: "Send information packet to Tom", clinicId: "cln_9", clinicName: "Rocky Mountain Men's Health", taskType: "send_information", priority: "high", dueDate: daysAgo(1), status: "open", notes: "OVERDUE — promised by yesterday.", assignedAdminName: "Devon Marsh", createdAt: daysAgo(5) },
  { id: "fu_6", title: "Retry call to Elena Castro", clinicId: "cln_8", clinicName: "Brightside Longevity Clinic", taskType: "phone_call", priority: "high", dueDate: daysFromNow(0), status: "open", assignedAdminName: "Jamil Yakasai", createdAt: daysAgo(1) },
  { id: "fu_7", title: "Review pilot performance report", clinicId: "cln_4", clinicName: "Cardinal Performance Medicine", taskType: "general_task", priority: "high", dueDate: daysFromNow(2), status: "open", assignedAdminName: "Jamil Yakasai", createdAt: daysAgo(1) },
  { id: "fu_8", title: "Call Vanessa re: owner discussion", clinicId: "cln_5", clinicName: "Gulf Coast Wellness Center", taskType: "phone_call", priority: "high", dueDate: daysFromNow(1), status: "open", assignedAdminName: "Devon Marsh", createdAt: daysAgo(3) },
  { id: "fu_9", title: "Directory claim reminder", clinicId: "cln_3", clinicName: "Evergreen Hormone Clinic", taskType: "send_directory_link", priority: "normal", dueDate: daysFromNow(5), status: "open", assignedAdminName: "Devon Marsh", createdAt: daysAgo(2) },
  { id: "fu_10", title: "Quarterly check-in with Henry", clinicId: "cln_16", clinicName: "Pioneer Health & Hormone", taskType: "phone_call", priority: "normal", dueDate: daysFromNow(30), status: "open", assignedAdminName: "Jamil Yakasai", createdAt: daysAgo(5) },
  { id: "fu_11", title: "Completed: Sent directory link to Cardinal", clinicId: "cln_4", clinicName: "Cardinal Performance Medicine", taskType: "send_directory_link", priority: "normal", dueDate: daysAgo(7), status: "completed", completedAt: daysAgo(6), assignedAdminName: "Jamil Yakasai", createdAt: daysAgo(10) },
];

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------
export const mockDeals: Deal[] = [
  { id: "deal_1", name: "Summit Vitality — Annual Partnership", clinicId: "cln_1", clinicName: "Summit Vitality Clinic", contactName: "Marcus Cole", offer: "Directory Premium + Lead Gen Pilot", ownerName: "Jamil Yakasai", stage: "proposal_sent", estimatedMonthlyValue: 8000, setupFee: 5000, performanceFee: 0, estimatedTotalValue: 96000, probability: 65, expectedCloseDate: daysFromNow(14), pilotStartDate: daysFromNow(21), archived: false, contractStatus: "drafting", paymentStatus: "none", createdAt: daysAgo(15), updatedAt: daysAgo(2) },
  { id: "deal_2", name: "Pacific Men's Health — Directory + Leads", clinicId: "cln_2", clinicName: "Pacific Men's Health", contactName: "David Lin", offer: "Directory Premium", ownerName: "Jamil Yakasai", stage: "discovery_completed", estimatedMonthlyValue: 4500, setupFee: 0, performanceFee: 0, estimatedTotalValue: 54000, probability: 35, expectedCloseDate: daysFromNow(28), archived: false, contractStatus: "none", paymentStatus: "none", createdAt: daysAgo(10), updatedAt: daysAgo(4) },
  { id: "deal_3", name: "Evergreen — Lead Gen + Directory", clinicId: "cln_3", clinicName: "Evergreen Hormone Clinic", contactName: "Rachel Owens", offer: "Directory Premium + Lead Pilot", ownerName: "Devon Marsh", stage: "proposal_requested", estimatedMonthlyValue: 3500, setupFee: 1500, performanceFee: 0, estimatedTotalValue: 42000, probability: 40, expectedCloseDate: daysFromNow(30), archived: false, contractStatus: "none", paymentStatus: "none", createdAt: daysAgo(8), updatedAt: daysAgo(3) },
  { id: "deal_4", name: "Cardinal — Pilot to Annual", clinicId: "cln_4", clinicName: "Cardinal Performance Medicine", contactName: "Andre Brooks", offer: "Lead Gen Pilot → Annual", ownerName: "Jamil Yakasai", stage: "active", estimatedMonthlyValue: 10000, setupFee: 3000, performanceFee: 0, estimatedTotalValue: 120000, probability: 95, expectedCloseDate: daysFromNow(45), pilotStartDate: daysAgo(10), archived: false, contractStatus: "signed", paymentStatus: "paid", createdAt: daysAgo(40), updatedAt: daysAgo(1) },
  { id: "deal_5", name: "Gulf Coast — Multi-location Rollout", clinicId: "cln_5", clinicName: "Gulf Coast Wellness Center", contactName: "Vanessa Reyes", offer: "Directory + Lead Gen (4 locations)", ownerName: "Devon Marsh", stage: "qualified", estimatedMonthlyValue: 5000, setupFee: 4000, performanceFee: 0, estimatedTotalValue: 60000, probability: 35, expectedCloseDate: daysFromNow(35), archived: false, contractStatus: "none", paymentStatus: "none", createdAt: daysAgo(7), updatedAt: daysAgo(3) },
  { id: "deal_6", name: "Pioneer — Annual Partnership", clinicId: "cln_16", clinicName: "Pioneer Health & Hormone", contactName: "Henry Walsh", offer: "Directory Premium + Lead Gen", ownerName: "Jamil Yakasai", stage: "active", estimatedMonthlyValue: 4000, setupFee: 0, performanceFee: 0, estimatedTotalValue: 48000, probability: 100, expectedCloseDate: daysAgo(5), archived: false, contractStatus: "signed", paymentStatus: "paid", createdAt: daysAgo(60), updatedAt: daysAgo(5) },
  { id: "deal_7", name: "Rocky Mountain — Directory Trial", clinicId: "cln_9", clinicName: "Rocky Mountain Men's Health", contactName: "Tom Becker", offer: "Directory Basic", ownerName: "Devon Marsh", stage: "negotiation", estimatedMonthlyValue: 2000, setupFee: 1000, performanceFee: 0, estimatedTotalValue: 24000, probability: 50, expectedCloseDate: daysFromNow(21), archived: false, contractStatus: "reviewing", paymentStatus: "none", createdAt: daysAgo(12), updatedAt: daysAgo(8) },
  { id: "deal_8", name: "Brightside — Longevity Package", clinicId: "cln_8", clinicName: "Brightside Longevity Clinic", contactName: "Elena Castro", offer: "Directory Premium", ownerName: "Jamil Yakasai", stage: "opportunity_identified", estimatedMonthlyValue: 3000, setupFee: 0, performanceFee: 0, estimatedTotalValue: 36000, probability: 20, expectedCloseDate: daysFromNow(45), archived: false, contractStatus: "none", paymentStatus: "none", createdAt: daysAgo(5), updatedAt: daysAgo(1) },
];

// ---------------------------------------------------------------------------
// Directory Profiles
// ---------------------------------------------------------------------------
export const mockDirectory: DirectoryProfile[] = mockClinics.map((c, i) => {
  const completion = c.profileCompletion;
  const fields = ["servicesCompleted", "providersCompleted", "locationCompleted", "hoursCompleted", "pricingCompleted", "imagesCompleted", "bookingLinkCompleted"];
  const completed = Math.round((completion / 100) * fields.length);
  const data: Record<string, boolean> = {};
  fields.forEach((f, idx) => { data[f] = idx < completed; });
  return {
    id: `dir_${i + 1}`,
    clinicId: c.id,
    clinicName: c.name,
    listingStatus: c.directoryStatus,
    claimStatus: c.directoryStatus === "published" || c.directoryStatus === "approved" ? "verified" : c.directoryStatus === "unclaimed" ? "unclaimed" : "requested",
    verificationStatus: c.verificationStatus,
    profileCompleteness: completion,
    servicesCompleted: data.servicesCompleted ?? false,
    providersCompleted: data.providersCompleted ?? false,
    locationCompleted: data.locationCompleted ?? false,
    hoursCompleted: data.hoursCompleted ?? false,
    pricingCompleted: data.pricingCompleted ?? false,
    imagesCompleted: data.imagesCompleted ?? false,
    bookingLinkCompleted: data.bookingLinkCompleted ?? false,
    lastReviewedAt: c.verificationStatus === "verified" ? daysAgo(3) : undefined,
    reviewedByName: c.verificationStatus === "verified" ? "Jamil Yakasai" : undefined,
    publicationStatus: c.directoryStatus === "published" ? "published" : c.directoryStatus === "approved" ? "ready" : "draft",
  };
});

// ---------------------------------------------------------------------------
// Patient Leads
// ---------------------------------------------------------------------------
const treatmentOptions = ["trt", "glp-1", "medical-weight-loss", "ed-care", "peptide-therapy", "hormone-optimization", "iv-therapy"];
const leadSources = ["google_ads", "organic_search", "directory", "referral", "facebook", "direct"];
const cities = [["Austin","TX"],["Miami","FL"],["Denver","CO"],["Phoenix","AZ"],["Houston","TX"],["Dallas","TX"],["Seattle","WA"],["Atlanta","GA"],["Charlotte","NC"],["Nashville","TN"]];

export const mockPatientLeads: PatientLead[] = Array.from({ length: 24 }, (_, i) => {
  const cityIdx = i % cities.length;
  const [city, state] = cities[cityIdx];
  const treatment = treatmentOptions[i % treatmentOptions.length];
  const statuses: PatientLead["status"][] = ["new","qualified","contacted","routed","booked","lost","disqualified","duplicate"];
  const status = i < 6 ? "new" : statuses[i % statuses.length];
  const names = ["James Wilson","Michael Chen","Robert Taylor","David Martinez","Chris Anderson","Daniel Lee","Matthew Thompson","Anthony Garcia","Mark Davis","Steven Lopez","Brian Carter","Kevin Nguyen","Jason Reed","Ryan Murphy","Eric Phillips","Thomas Wright","Andrew Scott","Nicholas Hall","Joshua Allen","Justin Young","Brandon King","Nathan Green","Tyler Adams","Caleb Baker"];
  return {
    id: `pl_${i + 1}`,
    name: names[i],
    email: `patient${i + 1}@email.com`,
    phone: `(${200 + i}) 555-${1000 + i}`,
    city, state, zip: `${10001 + i * 7}`,
    age: 30 + (i % 30),
    treatmentInterest: treatment,
    symptoms: i % 3 === 0 ? "Fatigue, low energy" : i % 3 === 1 ? "Weight gain despite exercise" : "Low libido",
    assessmentScore: 60 + (i % 40),
    preferredContact: i % 3 === 0 ? "phone" : i % 3 === 1 ? "email" : "sms",
    availability: i % 2 === 0 ? "Weekday mornings" : "Evenings",
    insurancePreference: i % 3 === 0 ? "self_pay" : i % 3 === 1 ? "insurance" : "unsure",
    telehealthPreference: i % 2 === 0,
    distancePreference: 10 + (i % 40),
    consentStatus: i % 5 === 0 ? "opted_out" : "opted_in",
    leadSource: leadSources[i % leadSources.length],
    campaignSource: i < 8 ? "TRT_Search_Q3" : i < 16 ? "GLP1_Display_Q3" : "Directory_Organic",
    qualificationScore: 40 + (i % 60),
    urgencyScore: 20 + (i % 80),
    status,
    assignedClinicId: status === "routed" || status === "booked" ? `cln_${(i % 16) + 1}` : undefined,
    assignedClinicName: status === "routed" || status === "booked" ? mockClinics[i % 16].name : undefined,
    referralStatus: status === "routed" ? "sent" : status === "booked" ? "booked" : undefined,
    bookingOutcome: status === "booked" ? "appointment_scheduled" : undefined,
    notes: i % 4 === 0 ? "High intent — ready to book" : undefined,
    createdAt: daysAgo(i),
  };
});

export const mockClinicMatches: ClinicMatch[] = mockPatientLeads.slice(0, 6).flatMap((lead, idx) => {
  return mockClinics.slice(0, 4).map((clinic, i) => ({
    id: `match_${idx}_${i}`,
    patientLeadId: lead.id,
    clinicId: clinic.id,
    clinicName: clinic.name,
    matchScore: 90 - i * 15 - (idx % 10),
    geographicFit: 100 - i * 20,
    treatmentFit: clinic.services.includes(lead.treatmentInterest) ? 95 : 40,
    capacityFit: 70 + (i * 5),
    telehealthFit: lead.telehealthPreference && clinic.telehealth ? 100 : 50,
    bookingFit: 80 - i * 10,
    priceFit: 60 + (i * 8),
    verificationStatus: clinic.verificationStatus === "rejected" ? "unverified" : clinic.verificationStatus,
    explanation: `Geographic fit ${100 - i * 20}%, treatment ${clinic.services.includes(lead.treatmentInterest) ? "matches" : "partial match"}, ${clinic.telehealth ? "telehealth available" : "in-person only"}.`,
  }));
});

// ---------------------------------------------------------------------------
// Demand Intelligence / Markets
// ---------------------------------------------------------------------------
const marketSeeds = [
  { geo: "Austin, TX", type: "city", state: "TX", city: "Austin", vol: 14800, trend: 24, cpc: 4.2, comp: 68, supply: 12, demand: 85 },
  { geo: "Miami, FL", type: "city", state: "FL", city: "Miami", vol: 18200, trend: 31, cpc: 5.1, comp: 72, supply: 18, demand: 92 },
  { geo: "Dallas, TX", type: "city", state: "TX", city: "Dallas", vol: 12600, trend: 18, cpc: 3.8, comp: 64, supply: 15, demand: 78 },
  { geo: "Denver, CO", type: "city", state: "CO", city: "Denver", vol: 9800, trend: 22, cpc: 4.5, comp: 60, supply: 8, demand: 72 },
  { geo: "Phoenix, AZ", type: "city", state: "AZ", city: "Phoenix", vol: 11400, trend: 15, cpc: 3.5, comp: 58, supply: 10, demand: 68 },
  { geo: "Houston, TX", type: "city", state: "TX", city: "Houston", vol: 13500, trend: 19, cpc: 3.9, comp: 66, supply: 14, demand: 80 },
  { geo: "Seattle, WA", type: "city", state: "WA", city: "Seattle", vol: 8200, trend: 12, cpc: 4.8, comp: 62, supply: 7, demand: 65 },
  { geo: "Atlanta, GA", type: "city", state: "GA", city: "Atlanta", vol: 10100, trend: 27, cpc: 3.6, comp: 55, supply: 9, demand: 74 },
  { geo: "75201 (Dallas)", type: "zip", state: "TX", zip: "75201", vol: 3200, trend: 34, cpc: 4.1, comp: 50, supply: 3, demand: 88 },
  { geo: "33101 (Miami)", type: "zip", state: "FL", zip: "33101", vol: 4100, trend: 38, cpc: 5.3, comp: 65, supply: 5, demand: 94 },
  { geo: "Texas", type: "state", state: "TX", vol: 52000, trend: 21, cpc: 3.9, comp: 66, supply: 41, demand: 82 },
  { geo: "Florida", type: "state", state: "FL", vol: 48000, trend: 29, cpc: 4.7, comp: 70, supply: 35, demand: 90 },
  { geo: "California", type: "state", state: "CA", vol: 61000, trend: 14, cpc: 5.5, comp: 78, supply: 52, demand: 76 },
];

export const mockMarkets: MarketData[] = marketSeeds.map((m, i) => {
  const gap = m.demand - m.supply;
  return {
    id: `mkt_${i + 1}`,
    geography: m.geo,
    type: m.type as "state" | "city" | "zip",
    state: m.state,
    city: m.city,
    zip: m.zip,
    searchVolume: m.vol,
    searchTrend: m.trend,
    topTreatments: ["trt", "glp-1", "medical-weight-loss"].slice(0, 2 + (i % 2)),
    topKeywords: [
      { keyword: "trt clinic near me", volume: Math.round(m.vol * 0.3), cpc: m.cpc * 1.2 },
      { keyword: "testosterone replacement therapy", volume: Math.round(m.vol * 0.25), cpc: m.cpc * 1.1 },
      { keyword: "glp-1 weight loss", volume: Math.round(m.vol * 0.2), cpc: m.cpc * 0.9 },
    ],
    avgCpc: m.cpc,
    competitionScore: m.comp,
    commercialIntent: 70 + (i % 25),
    clinicSupply: m.supply,
    patientDemand: m.demand,
    supplyDemandGap: gap,
    opportunityScore: Math.min(100, Math.round(gap * 1.2 + m.trend)),
    rising: m.trend > 20,
  };
});

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------
export const mockCampaigns: Campaign[] = [
  { id: "cmp_1", name: "TRT Search — National", platform: "google", status: "active", budget: 15000, spent: 12400, impressions: 420000, clicks: 8400, conversions: 312, leads: 180, costPerLead: 69, ctr: 2.0, conversionRate: 3.7, startDate: daysAgo(30), targeting: "Search — TRT keywords, US" },
  { id: "cmp_2", name: "GLP-1 Display — TX & FL", platform: "meta", status: "active", budget: 8000, spent: 6200, impressions: 310000, clicks: 6200, conversions: 248, leads: 142, costPerLead: 44, ctr: 2.0, conversionRate: 4.0, startDate: daysAgo(25), targeting: "Display — Weight loss, TX+FL" },
  { id: "cmp_3", name: "Directory Retargeting", platform: "meta", status: "active", budget: 3000, spent: 2100, impressions: 180000, clicks: 2700, conversions: 89, leads: 45, costPerLead: 47, ctr: 1.5, conversionRate: 3.3, startDate: daysAgo(20), targeting: "Retargeting — Directory visitors" },
  { id: "cmp_4", name: "TRT TikTok — Men 35-55", platform: "tiktok", status: "paused", budget: 5000, spent: 4800, impressions: 520000, clicks: 7800, conversions: 156, leads: 78, costPerLead: 62, ctr: 1.5, conversionRate: 2.0, startDate: daysAgo(45), endDate: daysAgo(10), targeting: "Men 35-55, TRT interest" },
  { id: "cmp_5", name: "Email — Nurture Sequence", platform: "email", status: "active", budget: 500, spent: 0, impressions: 12000, clicks: 1800, conversions: 96, leads: 96, costPerLead: 0, ctr: 15.0, conversionRate: 5.3, startDate: daysAgo(60), targeting: "Existing leads — nurture" },
  { id: "cmp_6", name: "LinkedIn — Clinic Outreach", platform: "linkedin", status: "draft", budget: 2000, spent: 0, impressions: 0, clicks: 0, conversions: 0, leads: 0, costPerLead: 0, ctr: 0, conversionRate: 0, targeting: "Clinic owners & medical directors" },
];

// ---------------------------------------------------------------------------
// Workforce
// ---------------------------------------------------------------------------
export const mockProfessionals: Professional[] = [
  { id: "pro_1", name: "Dr. Sarah Mitchell", role: "Nurse Practitioner", specialty: "TRT & Hormone Optimization", city: "Austin", state: "TX", licenses: ["TX APRN-12345"], certifications: ["AANP", "Hormone Therapy Cert"], yearsExperience: 8, availability: "available", linkedinUrl: "https://linkedin.com/in/sarahmitchell", credentialStatus: "verified", verificationStatus: "verified", matchScore: 92, createdAt: daysAgo(20) },
  { id: "pro_2", name: "Dr. James Okonkwo", role: "Medical Director", specialty: "Men's Health", city: "Miami", state: "FL", licenses: ["FL MD-67890"], certifications: ["Board Certified IM"], yearsExperience: 12, availability: "open", linkedinUrl: "https://linkedin.com/in/jamesokonkwo", credentialStatus: "pending", verificationStatus: "pending", matchScore: 88, createdAt: daysAgo(15) },
  { id: "pro_3", name: "Lisa Chen, PA-C", role: "Physician Assistant", specialty: "Weight Loss & GLP-1", city: "Denver", state: "CO", licenses: ["CO PA-54321"], certifications: ["NCCPA", "Obesity Medicine"], yearsExperience: 6, availability: "available", credentialStatus: "verified", verificationStatus: "verified", matchScore: 85, createdAt: daysAgo(10) },
  { id: "pro_4", name: "Dr. Marcus Bell", role: "Physician", specialty: "Peptide Therapy & Longevity", city: "Phoenix", state: "AZ", licenses: ["AZ MD-11111"], certifications: ["Board Certified FM"], yearsExperience: 15, availability: "placed", credentialStatus: "verified", verificationStatus: "verified", createdAt: daysAgo(45) },
  { id: "pro_5", name: "Rachel Torres, NP", role: "Nurse Practitioner", specialty: "IV Therapy & Wellness", city: "Houston", state: "TX", licenses: ["TX APRN-99999"], certifications: ["AANP"], yearsExperience: 4, availability: "open", credentialStatus: "expired", verificationStatus: "pending", matchScore: 72, createdAt: daysAgo(8) },
  { id: "pro_6", name: "Dr. Anthony Reed", role: "Medical Director", specialty: "Sexual Wellness & ED", city: "Atlanta", state: "GA", licenses: ["GA MD-33333"], certifications: ["Board Certified Urology"], yearsExperience: 18, availability: "available", credentialStatus: "verified", verificationStatus: "verified", matchScore: 90, createdAt: daysAgo(12) },
];

export const mockJobs: JobListing[] = [
  { id: "job_1", title: "Medical Director — TRT Clinic", employerName: "Summit Vitality Clinic", employerId: "cln_1", specialty: "Men's Health", city: "Austin", state: "TX", type: "part_time", salaryMin: 180000, salaryMax: 240000, status: "open", applicationsCount: 4, createdAt: daysAgo(14) },
  { id: "job_2", title: "NP — Hormone Optimization", employerName: "Evergreen Hormone Clinic", employerId: "cln_3", specialty: "Hormone Optimization", city: "Seattle", state: "WA", type: "full_time", salaryMin: 120000, salaryMax: 150000, status: "open", applicationsCount: 2, createdAt: daysAgo(10) },
  { id: "job_3", title: "PA-C — Weight Loss Program", employerName: "Gulf Coast Wellness Center", employerId: "cln_5", specialty: "Medical Weight Loss", city: "Houston", state: "TX", type: "full_time", salaryMin: 110000, salaryMax: 135000, status: "open", applicationsCount: 3, createdAt: daysAgo(7) },
  { id: "job_4", title: "Medical Director — Longevity", employerName: "Brightside Longevity Clinic", employerId: "cln_8", specialty: "Longevity Medicine", city: "Miami", state: "FL", type: "part_time", salaryMin: 200000, salaryMax: 280000, status: "draft", applicationsCount: 0, createdAt: daysAgo(3) },
];

export const mockApplications: JobApplication[] = [
  { id: "app_1", jobId: "job_1", jobTitle: "Medical Director — TRT Clinic", employerName: "Summit Vitality Clinic", professionalId: "pro_2", professionalName: "Dr. James Okonkwo", status: "interview", appliedAt: daysAgo(8), matchScore: 88 },
  { id: "app_2", jobId: "job_1", jobTitle: "Medical Director — TRT Clinic", employerName: "Summit Vitality Clinic", professionalId: "pro_6", professionalName: "Dr. Anthony Reed", status: "reviewing", appliedAt: daysAgo(5), matchScore: 90 },
  { id: "app_3", jobId: "job_2", jobTitle: "NP — Hormone Optimization", employerName: "Evergreen Hormone Clinic", professionalId: "pro_1", professionalName: "Dr. Sarah Mitchell", status: "submitted", appliedAt: daysAgo(3), matchScore: 92 },
  { id: "app_4", jobId: "job_3", jobTitle: "PA-C — Weight Loss Program", employerName: "Gulf Coast Wellness Center", professionalId: "pro_3", professionalName: "Lisa Chen, PA-C", status: "interview", appliedAt: daysAgo(4), matchScore: 85 },
];

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------
export const mockProducts: Product[] = [
  { id: "prd_1", title: "TRT Starter Kit", sku: "NV-TRT-001", category: "Treatment Kits", vendor: "Novalyte Supply Co", price: 299, compareAtPrice: 349, cost: 145, margin: 51, inventory: 240, status: "active", visibility: "public", rating: 4.7, reviewCount: 128 },
  { id: "prd_2", title: "GLP-1 Injection Supplies", sku: "NV-GLP-002", category: "Treatment Kits", vendor: "Novalyte Supply Co", price: 149, cost: 62, margin: 58, inventory: 580, status: "active", visibility: "public", rating: 4.5, reviewCount: 84 },
  { id: "prd_3", title: "Peptide Therapy Bundle", sku: "NV-PEP-003", category: "Treatment Kits", vendor: "BioPeptide Labs", price: 399, compareAtPrice: 449, cost: 210, margin: 47, inventory: 85, status: "active", visibility: "public", rating: 4.8, reviewCount: 56 },
  { id: "prd_4", title: "IV Therapy Drip Set", sku: "NV-IV-004", category: "Clinic Supplies", vendor: "MedSupply Direct", price: 89, cost: 38, margin: 57, inventory: 0, status: "out_of_stock", visibility: "public", rating: 4.3, reviewCount: 42 },
  { id: "prd_5", title: "Vitality Supplement Stack", sku: "NV-SUP-005", category: "Supplements", vendor: "Novalyte Nutrition", price: 129, compareAtPrice: 159, cost: 48, margin: 63, inventory: 1200, status: "active", visibility: "public", rating: 4.6, reviewCount: 312 },
  { id: "prd_6", title: "At-Home Testosterone Test", sku: "NV-TST-006", category: "Diagnostics", vendor: "Novalyte Diagnostics", price: 79, cost: 28, margin: 65, inventory: 450, status: "active", visibility: "public", rating: 4.4, reviewCount: 198 },
];

export const mockOrders: Order[] = [
  { id: "ord_1", orderNumber: "NV-10042", customerName: "James Wilson", customerEmail: "jwilson@email.com", items: [{ name: "TRT Starter Kit", qty: 1, price: 299 }], total: 299, paymentStatus: "paid", fulfillmentStatus: "shipped", trackingNumber: "1Z999AA10123456784", createdAt: daysAgo(2) },
  { id: "ord_2", orderNumber: "NV-10043", customerName: "Michael Chen", customerEmail: "mchen@email.com", items: [{ name: "Vitality Supplement Stack", qty: 2, price: 129 }, { name: "At-Home Testosterone Test", qty: 1, price: 79 }], total: 337, paymentStatus: "paid", fulfillmentStatus: "fulfilled", createdAt: daysAgo(3) },
  { id: "ord_3", orderNumber: "NV-10044", customerName: "Robert Taylor", customerEmail: "rtaylor@email.com", items: [{ name: "Peptide Therapy Bundle", qty: 1, price: 399 }], total: 399, paymentStatus: "pending", fulfillmentStatus: "unfulfilled", createdAt: daysAgo(1), riskFlags: ["Address mismatch"] },
  { id: "ord_4", orderNumber: "NV-10045", customerName: "David Martinez", customerEmail: "dmartinez@email.com", items: [{ name: "GLP-1 Injection Supplies", qty: 3, price: 149 }], total: 447, paymentStatus: "paid", fulfillmentStatus: "partial", createdAt: daysAgo(4) },
  { id: "ord_5", orderNumber: "NV-10046", customerName: "Chris Anderson", customerEmail: "canderson@email.com", items: [{ name: "IV Therapy Drip Set", qty: 2, price: 89 }], total: 178, paymentStatus: "failed", fulfillmentStatus: "unfulfilled", createdAt: daysAgo(1), riskFlags: ["Payment declined"] },
  { id: "ord_6", orderNumber: "NV-10047", customerName: "Daniel Lee", customerEmail: "dlee@email.com", items: [{ name: "TRT Starter Kit", qty: 1, price: 299 }, { name: "At-Home Testosterone Test", qty: 1, price: 79 }], total: 378, paymentStatus: "paid", fulfillmentStatus: "shipped", trackingNumber: "1Z999AA10123456790", createdAt: daysAgo(5) },
];

// ---------------------------------------------------------------------------
// Content / Articles
// ---------------------------------------------------------------------------
export const mockArticles: Article[] = [
  { id: "art_1", title: "TRT Therapy: Complete Guide for Men Over 40", slug: "trt-therapy-guide-men-over-40", excerpt: "Everything you need to know about testosterone replacement therapy.", category: "Treatment Guides", treatmentCategory: "trt", audience: "men_35_plus", searchIntent: "informational", primaryKeyword: "trt therapy", secondaryKeywords: ["testosterone replacement", "trt benefits", "trt side effects"], authorName: "Dr. Sarah Mitchell", reviewerName: "Dr. James Okonkwo", status: "published", wordCount: 2400, seoScore: 88, readabilityScore: 72, publishDate: daysAgo(10), views: 18400, createdAt: daysAgo(20) },
  { id: "art_2", title: "GLP-1 Medications for Weight Loss: What to Expect", slug: "glp-1-weight-loss-guide", excerpt: "A comprehensive look at GLP-1 agonists for medical weight loss.", category: "Treatment Guides", treatmentCategory: "glp-1", audience: "weight_loss_seekers", searchIntent: "commercial", primaryKeyword: "glp-1 weight loss", secondaryKeywords: ["semaglutide", "weight loss injections", "glp-1 results"], authorName: "Lisa Chen, PA-C", status: "scheduled", wordCount: 1800, seoScore: 84, readabilityScore: 75, publishDate: daysFromNow(3), createdAt: daysAgo(8) },
  { id: "art_3", title: "5 Signs You May Have Low Testosterone", slug: "signs-of-low-testosterone", excerpt: "Recognizing the symptoms of low T and when to seek treatment.", category: "Symptoms", treatmentCategory: "trt", searchIntent: "informational", primaryKeyword: "low testosterone symptoms", secondaryKeywords: ["low t signs", "testosterone deficiency"], authorName: "Dr. Anthony Reed", status: "review", wordCount: 1200, seoScore: 76, readabilityScore: 80, createdAt: daysAgo(5) },
  { id: "art_4", title: "Peptide Therapy Benefits: The Complete 2024 Guide", slug: "peptide-therapy-benefits-guide", category: "Treatment Guides", treatmentCategory: "peptide-therapy", searchIntent: "informational", primaryKeyword: "peptide therapy benefits", secondaryKeywords: [], authorName: "Jamil Yakasai", status: "draft", wordCount: 800, seoScore: 62, readabilityScore: 68, createdAt: daysAgo(3) },
  { id: "art_5", title: "IV Therapy: Does It Really Work?", slug: "iv-therapy-effectiveness", category: "Wellness", treatmentCategory: "iv-therapy", searchIntent: "informational", primaryKeyword: "does iv therapy work", secondaryKeywords: ["iv therapy benefits"], authorName: "Dr. Sarah Mitchell", status: "idea", createdAt: daysAgo(1) },
  { id: "art_6", title: "Hormone Optimization for Athletic Performance", slug: "hormone-optimization-athletic-performance", category: "Performance", treatmentCategory: "hormone-optimization", searchIntent: "commercial", primaryKeyword: "hormone optimization", secondaryKeywords: ["athletic performance hormones"], authorName: "Dr. Marcus Bell", reviewerName: "Dr. James Okonkwo", status: "approved", wordCount: 2000, seoScore: 90, readabilityScore: 74, createdAt: daysAgo(12) },
  { id: "art_7", title: "Erectile Dysfunction: Treatment Options Explained", slug: "ed-treatment-options", category: "Treatment Guides", treatmentCategory: "ed-care", searchIntent: "commercial", primaryKeyword: "ed treatment options", secondaryKeywords: ["erectile dysfunction treatment"], authorName: "Dr. Anthony Reed", status: "published", wordCount: 1600, seoScore: 85, readabilityScore: 78, publishDate: daysAgo(20), views: 12200, createdAt: daysAgo(30) },
  { id: "art_8", title: "Medical Weight Loss: GLP-1 vs Traditional Diets", slug: "glp-1-vs-traditional-diets", category: "Weight Loss", treatmentCategory: "glp-1", searchIntent: "commercial", primaryKeyword: "glp-1 vs diet", secondaryKeywords: [], authorName: "Lisa Chen, PA-C", status: "brief", createdAt: daysAgo(2) },
];

// ---------------------------------------------------------------------------
// Automation / AI
// ---------------------------------------------------------------------------
export const mockAutomations: Automation[] = [
  { id: "auto_1", name: "New Lead → Auto-Qualify", description: "Scores and qualifies new patient leads", trigger: "patient_lead.created", actions: ["ai_score_lead", "assign_to_queue"], status: "active", lastRunAt: hoursAgo(1), runCount: 1240, failureCount: 2 },
  { id: "auto_2", name: "Call Logged → Update Pipeline", description: "Updates clinic stage based on call outcome", trigger: "call_session.logged", actions: ["update_clinic_stage", "create_followup_if_needed"], status: "active", lastRunAt: hoursAgo(3), runCount: 580, failureCount: 0 },
  { id: "auto_3", name: "Directory Application → Notify", description: "Sends notification on new directory application", trigger: "directory_application.submitted", actions: ["send_notification", "create_task"], status: "active", lastRunAt: hoursAgo(6), runCount: 42, failureCount: 0 },
  { id: "auto_4", name: "Overdue Follow-Up Alert", description: "Escalates follow-ups overdue by 24h+", trigger: "followup.overdue", actions: ["send_alert", "reassign_if_needed"], status: "active", lastRunAt: hoursAgo(12), runCount: 180, failureCount: 1 },
  { id: "auto_5", name: "Article Published → Social Post", description: "Auto-generates social media posts for new articles", trigger: "article.published", actions: ["generate_social_copy", "schedule_posts"], status: "error", lastRunAt: daysAgo(2), runCount: 24, failureCount: 8 },
  { id: "auto_6", name: "Deal Won → Onboarding Workflow", description: "Triggers clinic onboarding when deal is won", trigger: "deal.stage_changed", actions: ["create_onboarding_tasks", "notify_ops"], status: "paused", runCount: 12, failureCount: 0 },
];

export const mockAIUsage: AIUsageRecord[] = Array.from({ length: 12 }, (_, i) => ({
  id: `aiu_${i + 1}`,
  model: i % 3 === 0 ? "gpt-4o" : i % 3 === 1 ? "gpt-4o-mini" : "text-embedding-3",
  feature: i % 4 === 0 ? "article_generation" : i % 4 === 1 ? "lead_scoring" : i % 4 === 2 ? "call_transcript" : "clinic_research",
  promptTokens: 500 + i * 200,
  completionTokens: 800 + i * 300,
  cost: (0.02 + i * 0.01),
  timestamp: hoursAgo(i * 6),
}));

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------
export const mockIntegrations: Integration[] = [
  { key: "supabase", label: "Supabase", status: "connected", note: "Database & auth", lastSyncAt: hoursAgo(1) },
  { key: "vercel", label: "Vercel", status: "connected", note: "Deployment & hosting", lastSyncAt: hoursAgo(2) },
  { key: "slack", label: "Slack", status: "configuration_required", note: "Notifications — webhook URL needed" },
  { key: "email", label: "Email Provider (Resend)", status: "configuration_required", note: "Transactional email — API key needed" },
  { key: "calendar", label: "Google Calendar", status: "not_connected", note: "Meeting sync" },
  { key: "openai", label: "OpenAI", status: "connected", note: "AI features — call copilot (R2)", lastSyncAt: hoursAgo(1) },
  { key: "twilio", label: "Twilio", status: "not_connected", note: "Telephony — call console (R2)" },
  { key: "stripe", label: "Stripe", status: "configuration_required", note: "Payments — API key needed" },
  { key: "google_ads", label: "Google Ads", status: "configuration_required", note: "Campaign sync — OAuth needed" },
  { key: "meta_ads", label: "Meta Ads", status: "not_connected", note: "Campaign sync" },
];

// ---------------------------------------------------------------------------
// Audit Events
// ---------------------------------------------------------------------------
export const mockAuditEvents: AuditEvent[] = [
  { id: "aud_1", actorName: "Jamil Yakasai", action: "admin.signed_in", resourceType: "admin", ipAddress: "73.14.22.108", timestamp: hoursAgo(2) },
  { id: "aud_2", actorName: "Jamil Yakasai", action: "clinic.stage_changed", resourceType: "clinic", resourceId: "cln_1", ipAddress: "73.14.22.108", timestamp: hoursAgo(48), metadata: { from: "interested", to: "proposal_sent" } },
  { id: "aud_3", actorName: "Devon Marsh", action: "call.logged", resourceType: "call", resourceId: "call_5", ipAddress: "98.222.11.45", timestamp: hoursAgo(72) },
  { id: "aud_4", actorName: "Jamil Yakasai", action: "deal.created", resourceType: "deal", resourceId: "deal_1", ipAddress: "73.14.22.108", timestamp: daysAgo(15) },
  { id: "aud_5", actorName: "Amani Okafor", action: "settings.updated", resourceType: "settings", ipAddress: "108.45.22.91", timestamp: daysAgo(1), metadata: { section: "calling_hours" } },
  { id: "aud_6", actorName: "Jamil Yakasai", action: "directory.approved", resourceType: "directory", resourceId: "dir_1", ipAddress: "73.14.22.108", timestamp: daysAgo(3) },
];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const mockNotifications: NotificationItem[] = [
  { id: "n1", type: "followup_overdue", title: "Overdue Follow-Up", message: "Send information packet to Rocky Mountain Men's Health is overdue.", priority: "high", isRead: false, relatedEntityType: "followup", createdAt: hoursAgo(6) },
  { id: "n2", type: "meeting_upcoming", title: "Meeting Tomorrow", message: "Pacific Men's Health discovery call scheduled tomorrow.", priority: "normal", isRead: false, relatedEntityType: "clinic", createdAt: hoursAgo(3) },
  { id: "n3", type: "high_intent_clinic", title: "High-Intent Clinic", message: "Summit Vitality Clinic showed strong buying signals.", priority: "critical", isRead: false, relatedEntityType: "clinic", createdAt: hoursAgo(12) },
  { id: "n4", type: "patient_lead_unassigned", title: "3 Unassigned Patient Leads", message: "New patient leads awaiting routing.", priority: "high", isRead: false, relatedEntityType: "patient_lead", createdAt: hoursAgo(2) },
  { id: "n5", type: "campaign_budget_alert", title: "Campaign Over Budget", message: "TRT TikTok campaign has spent 96% of budget.", priority: "normal", isRead: true, relatedEntityType: "campaign", createdAt: daysAgo(1) },
  { id: "n6", type: "automation_failed", title: "Automation Failed", message: "Article Published → Social Post automation failed 8 times.", priority: "high", isRead: false, relatedEntityType: "automation", createdAt: daysAgo(2) },
  { id: "n7", type: "directory_application", title: "New Directory Application", message: "Gulf Coast Wellness Center submitted a directory application.", priority: "normal", isRead: true, relatedEntityType: "directory", createdAt: daysAgo(3) },
  { id: "n8", type: "integration_disconnected", title: "Slack Integration Needs Config", message: "Slack webhook URL is not configured.", priority: "normal", isRead: true, createdAt: daysAgo(5) },
];

// ---------------------------------------------------------------------------
// Activity Feed
// ---------------------------------------------------------------------------
export const mockActivities: ActivityEvent[] = [
  { id: "act_1", entityType: "clinic", entityId: "cln_1", action: "stage_changed", summary: "Stage changed: Interested → Proposal Sent — Summit Vitality Clinic", adminName: "Jamil Yakasai", timestamp: hoursAgo(48), metadata: { from: "interested", to: "proposal_sent" } },
  { id: "act_2", entityType: "call", entityId: "call_3", action: "call_logged", summary: "Call logged — Connected (DM reached) — Cardinal Performance Medicine", adminName: "Jamil Yakasai", timestamp: hoursAgo(24) },
  { id: "act_3", entityType: "deal", entityId: "deal_1", action: "deal_created", summary: "Deal created — Summit Vitality — Annual Partnership", adminName: "Jamil Yakasai", timestamp: daysAgo(15) },
  { id: "act_4", entityType: "followup", entityId: "fu_4", action: "followup_created", summary: "Follow-up created — Prepare proposal for Evergreen", adminName: "Devon Marsh", timestamp: daysAgo(3) },
  { id: "act_5", entityType: "clinic", entityId: "cln_5", action: "contact_added", summary: "Contact added — Vanessa Reyes, Operations Manager — Gulf Coast Wellness", adminName: "Devon Marsh", timestamp: daysAgo(5) },
  { id: "act_6", entityType: "directory", entityId: "dir_1", action: "directory_status_changed", summary: "Directory status → Published — Summit Vitality Clinic", adminName: "Jamil Yakasai", timestamp: daysAgo(3) },
  { id: "act_7", entityType: "clinic", entityId: "cln_1", action: "clinic_updated", summary: "Clinic updated — Summit Vitality Clinic", adminName: "Jamil Yakasai", timestamp: hoursAgo(48) },
  { id: "act_8", entityType: "patient_lead", entityId: "pl_1", action: "patient_lead_created", summary: "New patient lead — James Wilson (TRT interest)", adminName: "system", timestamp: hoursAgo(1) },
];
