import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { SERVICE_CATALOG, PIPELINE_STAGES, DEAL_STAGES, DIRECTORY_STAGES } from "../src/lib/constants";

const db = new PrismaClient();

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000);
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600000);
const hoursFromNow = (n: number) => new Date(now.getTime() + n * 3600000);

async function main() {
  console.log("Seeding Novalyte Admin…");

  // --- Services catalog ---
  const services = {} as Record<string, { id: string }>;
  for (const s of SERVICE_CATALOG) {
    const row = await db.service.upsert({
      where: { slug: s.slug },
      update: { name: s.name, category: s.category },
      create: { slug: s.slug, name: s.name, category: s.category },
    });
    services[s.slug] = row;
  }

  // --- Admin members ---
  const founder = await db.adminMember.upsert({
    where: { email: "founder@novalyte.io" },
    update: {},
    create: {
      email: "founder@novalyte.io",
      passwordHash: hashPassword("novalyte2025"),
      role: "founder",
      status: "active",
      firstName: "Jamil",
      lastName: "Yakasai",
      lastLoginAt: hoursAgo(2),
    },
  });

  const admin2 = await db.adminMember.upsert({
    where: { email: "ops@novalyte.io" },
    update: {},
    create: {
      email: "ops@novalyte.io",
      passwordHash: hashPassword("novalyte2025"),
      role: "admin",
      status: "active",
      firstName: "Sam",
      lastName: "Rivera",
      lastLoginAt: daysAgo(1),
    },
  });

  const salesMember = await db.adminMember.upsert({
    where: { email: "sales@novalyte.io" },
    update: {},
    create: {
      email: "sales@novalyte.io",
      passwordHash: hashPassword("novalyte2025"),
      role: "sales",
      status: "active",
      firstName: "Casey",
      lastName: "Nguyen",
      lastLoginAt: daysAgo(3),
    },
  });

  // --- Clinics ---
  type SeedClinic = {
    name: string;
    legalName?: string;
    website?: string;
    primaryPhone?: string;
    generalEmail?: string;
    city: string;
    state: string;
    zip: string;
    timezone: string;
    numberOfLocations?: number;
    clinicType?: string;
    telehealth?: boolean;
    pipelineStage: string;
    priority: string;
    readiness: number;
    lastContactedDaysAgo?: number;
    nextAction?: string;
    nextActionDaysFromNow?: number;
    callAttempts?: number;
    interested?: boolean;
    paid?: boolean;
    doNotCall?: boolean;
    directoryStatus?: string;
    dealValue?: number;
    owner?: string;
    services: string[];
    qualification: Record<string, unknown>;
    notes?: string;
    contacts: {
      firstName: string;
      lastName: string;
      title?: string;
      contactType: string;
      email?: string;
      directPhone?: string;
      mobilePhone?: string;
      isDecisionMaker?: boolean;
      isPrimary?: boolean;
    }[];
    calls?: {
      daysAgo: number;
      outcome: string;
      answered: boolean;
      decisionMakerReached: boolean;
      interestLevel: string;
      durationMin: number;
      notes?: string;
      nextAction?: string;
    }[];
    followUps?: {
      title: string;
      taskType: string;
      priority: string;
      dueDaysFromNow?: number;
      dueDaysAgo?: number;
      status: string;
      notes?: string;
    }[];
    deal?: {
      name: string;
      offer: string;
      stage: string;
      monthlyValue: number;
      setupFee: number;
      totalValue: number;
      probability: number;
      expectedCloseDaysFromNow?: number;
      pilotStartDaysFromNow?: number;
    };
    directory?: {
      listingStatus: string;
      claimStatus: string;
      verificationStatus: string;
      completeness: number;
      servicesCompleted?: boolean;
      providersCompleted?: boolean;
      locationCompleted?: boolean;
      hoursCompleted?: boolean;
      pricingCompleted?: boolean;
      bookingLinkCompleted?: boolean;
      publicationStatus?: string;
    };
  };

  const clinics: SeedClinic[] = [
    {
      name: "Summit Vitality Clinic",
      legalName: "Summit Vitality Medical Group LLC",
      website: "https://summitvitality.com",
      primaryPhone: "(512) 555-0142",
      generalEmail: "info@summitvitality.com",
      city: "Austin",
      state: "TX",
      zip: "78701",
      timezone: "America/Chicago",
      numberOfLocations: 3,
      clinicType: "group",
      telehealth: true,
      pipelineStage: "proposal_sent",
      priority: "critical",
      readiness: 88,
      lastContactedDaysAgo: 2,
      nextAction: "Follow up on proposal",
      nextActionDaysFromNow: 0,
      callAttempts: 4,
      interested: true,
      directoryStatus: "approved",
      dealValue: 96000,
      owner: founder.email,
      services: ["trt", "glp-1", "peptide-therapy", "iv-therapy"],
      qualification: { acceptingNewPatients: true, growthInterest: "high", websiteQuality: "strong", bookingExperience: "online", decisionMakerIdentified: true, primaryPainPoint: "Patient acquisition cost rising", confidenceLevel: "Estimated", dataProvenance: "Self-reported" },
      notes: "Strong fit. Medical Director is warm. Wants patient demand data before signing.",
      contacts: [
        { firstName: "Marcus", lastName: "Cole", title: "Medical Director", contactType: "medical_director", email: "mcole@summitvitality.com", directPhone: "(512) 555-0143", isDecisionMaker: true, isPrimary: true },
        { firstName: "Priya", lastName: "Shah", title: "Practice Manager", contactType: "practice_manager", email: "priya@summitvitality.com", directPhone: "(512) 555-0144" },
      ],
      calls: [
        { daysAgo: 9, outcome: "connected", answered: true, decisionMakerReached: true, interestLevel: "warm", durationMin: 22, notes: "Intro call. Interested in directory + lead gen.", nextAction: "Send info packet" },
        { daysAgo: 6, outcome: "meeting_booked", answered: true, decisionMakerReached: true, interestLevel: "hot", durationMin: 45, notes: "Discovery meeting. Wants pilot." },
        { daysAgo: 2, outcome: "connected", answered: true, decisionMakerReached: true, interestLevel: "hot", durationMin: 18, notes: "Reviewed proposal terms, asked for patient demand report.", nextAction: "Send patient demand update" },
      ],
      followUps: [
        { title: "Send patient demand report to Marcus", taskType: "patient_demand_update", priority: "critical", dueDaysFromNow: 0, status: "open", notes: "He asked for ZIP-level demand data." },
        { title: "Proposal follow-up call", taskType: "proposal_follow_up", priority: "critical", dueDaysFromNow: 3, status: "open" },
      ],
      deal: {
        name: "Summit Vitality — Annual Partnership",
        offer: "Directory Premium + Lead Gen Pilot",
        stage: "proposal_sent",
        monthlyValue: 8000,
        setupFee: 5000,
        totalValue: 96000,
        probability: 65,
        expectedCloseDaysFromNow: 14,
        pilotStartDaysFromNow: 21,
      },
      directory: { listingStatus: "approved", claimStatus: "verified", verificationStatus: "verified", completeness: 92, servicesCompleted: true, providersCompleted: true, locationCompleted: true, hoursCompleted: true, pricingCompleted: true, bookingLinkCompleted: true, publicationStatus: "published" },
    },
    {
      name: "Pacific Men's Health",
      legalName: "Pacific Men's Health Partners Inc",
      website: "https://pacificmenshealth.com",
      primaryPhone: "(310) 555-0198",
      generalEmail: "hello@pacificmenshealth.com",
      city: "Los Angeles",
      state: "CA",
      zip: "90024",
      timezone: "America/Los_Angeles",
      numberOfLocations: 2,
      clinicType: "group",
      telehealth: true,
      pipelineStage: "meeting_booked",
      priority: "high",
      readiness: 81,
      lastContactedDaysAgo: 4,
      nextAction: "Discovery call with founder",
      nextActionDaysFromNow: 1,
      callAttempts: 3,
      interested: true,
      directoryStatus: "approved",
      dealValue: 54000,
      owner: founder.email,
      services: ["trt", "ed-care", "sexual-wellness", "peptide-therapy"],
      qualification: { acceptingNewPatients: true, growthInterest: "high", websiteQuality: "strong", bookingExperience: "phone", decisionMakerIdentified: true, primaryPainPoint: "No directory presence", confidenceLevel: "Estimated", dataProvenance: "Estimated" },
      contacts: [
        { firstName: "David", lastName: "Lin", title: "Founder", contactType: "founder", email: "david@pacificmenshealth.com", mobilePhone: "(310) 555-0199", isDecisionMaker: true, isPrimary: true },
      ],
      calls: [
        { daysAgo: 7, outcome: "connected", answered: true, decisionMakerReached: true, interestLevel: "warm", durationMin: 14, notes: "Curious about directory. Sent link." },
        { daysAgo: 4, outcome: "meeting_booked", answered: true, decisionMakerReached: true, interestLevel: "hot", durationMin: 30, notes: "Booked discovery call." },
      ],
      followUps: [
        { title: "Discovery call with David Lin", taskType: "meeting", priority: "high", dueDaysFromNow: 1, status: "open" },
      ],
      deal: {
        name: "Pacific Men's Health — Directory + Leads",
        offer: "Directory Premium",
        stage: "discovery_completed",
        monthlyValue: 4500,
        setupFee: 0,
        totalValue: 54000,
        probability: 35,
        expectedCloseDaysFromNow: 28,
      },
      directory: { listingStatus: "approved", claimStatus: "requested", verificationStatus: "pending", completeness: 70, servicesCompleted: true, providersCompleted: true, locationCompleted: true, hoursCompleted: false, pricingCompleted: false, bookingLinkCompleted: false, publicationStatus: "draft" },
    },
    {
      name: "Evergreen Hormone Clinic",
      website: "https://evergreenhormone.com",
      primaryPhone: "(206) 555-0121",
      generalEmail: "care@evergreenhormone.com",
      city: "Seattle",
      state: "WA",
      zip: "98101",
      timezone: "America/Los_Angeles",
      numberOfLocations: 1,
      clinicType: "private_practice",
      telehealth: true,
      pipelineStage: "interested",
      priority: "high",
      readiness: 74,
      lastContactedDaysAgo: 6,
      nextAction: "Send proposal",
      nextActionDaysFromNow: 2,
      callAttempts: 5,
      interested: true,
      directoryStatus: "unclaimed",
      dealValue: 42000,
      owner: salesMember.email,
      services: ["hormone-optimization", "trt", "longevity"],
      qualification: { acceptingNewPatients: true, growthInterest: "medium", websiteQuality: "average", bookingExperience: "online", decisionMakerIdentified: true, primaryPainPoint: "Seasonal patient volume dips", confidenceLevel: "Self-reported", dataProvenance: "Self-reported" },
      contacts: [
        { firstName: "Rachel", lastName: "Owens", title: "Owner / NP", contactType: "owner", email: "rachel@evergreenhormone.com", directPhone: "(206) 555-0122", isDecisionMaker: true, isPrimary: true },
        { firstName: "Tara", lastName: "Mills", title: "Front Desk", contactType: "front_desk", directPhone: "(206) 555-0121" },
      ],
      calls: [
        { daysAgo: 14, outcome: "no_answer", answered: false, decisionMakerReached: false, interestLevel: "unknown", durationMin: 0 },
        { daysAgo: 12, outcome: "voicemail", answered: false, decisionMakerReached: false, interestLevel: "unknown", durationMin: 0 },
        { daysAgo: 9, outcome: "connected", answered: true, decisionMakerReached: true, interestLevel: "warm", durationMin: 16, notes: "Wants more info on lead gen." },
        { daysAgo: 6, outcome: "interested", answered: true, decisionMakerReached: true, interestLevel: "hot", durationMin: 25, notes: "Ready for proposal." },
      ],
      followUps: [
        { title: "Prepare proposal for Evergreen", taskType: "prepare_proposal", priority: "high", dueDaysFromNow: 2, status: "in_progress" },
        { title: "Directory claim reminder", taskType: "send_directory_link", priority: "normal", dueDaysFromNow: 5, status: "open" },
      ],
      deal: {
        name: "Evergreen — Lead Gen + Directory",
        offer: "Directory Premium + Lead Pilot",
        stage: "proposal_requested",
        monthlyValue: 3500,
        setupFee: 1500,
        totalValue: 42000,
        probability: 40,
        expectedCloseDaysFromNow: 30,
      },
      directory: { listingStatus: "unclaimed", claimStatus: "unclaimed", verificationStatus: "pending", completeness: 35, servicesCompleted: true, providersCompleted: false, locationCompleted: true, hoursCompleted: false, pricingCompleted: false, bookingLinkCompleted: false, publicationStatus: "draft" },
    },
    {
      name: "Cardinal Performance Medicine",
      website: "https://cardinalperformance.com",
      primaryPhone: "(614) 555-0177",
      city: "Columbus",
      state: "OH",
      zip: "43215",
      timezone: "America/New_York",
      numberOfLocations: 1,
      clinicType: "private_practice",
      telehealth: false,
      pipelineStage: "pilot_active",
      priority: "critical",
      readiness: 90,
      lastContactedDaysAgo: 1,
      nextAction: "Check pilot metrics",
      nextActionDaysFromNow: 2,
      callAttempts: 6,
      interested: true,
      paid: true,
      directoryStatus: "published",
      dealValue: 120000,
      owner: founder.email,
      services: ["trt", "performance-recovery", "peptide-therapy", "iv-therapy"],
      qualification: { acceptingNewPatients: true, growthInterest: "high", websiteQuality: "strong", bookingExperience: "online", decisionMakerIdentified: true, primaryPainPoint: "Scaling beyond capacity", confidenceLevel: "Verified", dataProvenance: "Verified" },
      contacts: [
        { firstName: "Andre", lastName: "Brooks", title: "Medical Director", contactType: "medical_director", email: "andre@cardinalperformance.com", directPhone: "(614) 555-0178", isDecisionMaker: true, isPrimary: true },
      ],
      calls: [
        { daysAgo: 30, outcome: "connected", answered: true, decisionMakerReached: true, interestLevel: "warm", durationMin: 20 },
        { daysAgo: 24, outcome: "meeting_booked", answered: true, decisionMakerReached: true, interestLevel: "hot", durationMin: 50, notes: "Signed pilot." },
        { daysAgo: 1, outcome: "connected", answered: true, decisionMakerReached: true, interestLevel: "hot", durationMin: 12, notes: "Pilot going well, +18% inquiries.", nextAction: "Pull pilot metrics report" },
      ],
      followUps: [
        { title: "Review pilot performance report", taskType: "general_task", priority: "high", dueDaysFromNow: 2, status: "open" },
      ],
      deal: {
        name: "Cardinal — Pilot to Annual",
        offer: "Lead Gen Pilot → Annual",
        stage: "active",
        monthlyValue: 10000,
        setupFee: 3000,
        totalValue: 120000,
        probability: 95,
        expectedCloseDaysFromNow: 45,
        pilotStartDaysFromNow: -10,
      },
      directory: { listingStatus: "published", claimStatus: "verified", verificationStatus: "verified", completeness: 98, servicesCompleted: true, providersCompleted: true, locationCompleted: true, hoursCompleted: true, pricingCompleted: true, bookingLinkCompleted: true, publicationStatus: "published" },
    },
    {
      name: "Gulf Coast Wellness Center",
      website: "https://gulfcoastwellness.com",
      primaryPhone: "(713) 555-0150",
      generalEmail: "admin@gulfcoastwellness.com",
      city: "Houston",
      state: "TX",
      zip: "77002",
      timezone: "America/Chicago",
      numberOfLocations: 4,
      clinicType: "group",
      telehealth: true,
      pipelineStage: "decision_maker_reached",
      priority: "high",
      readiness: 79,
      lastContactedDaysAgo: 3,
      nextAction: "Follow up with operations manager",
      nextActionDaysFromNow: 1,
      callAttempts: 3,
      interested: true,
      directoryStatus: "unclaimed",
      dealValue: 60000,
      owner: salesMember.email,
      services: ["medical-weight-loss", "glp-1", "iv-therapy", "mental-wellness"],
      qualification: { acceptingNewPatients: true, growthInterest: "high", websiteQuality: "average", decisionMakerIdentified: true, primaryPainPoint: "GLP-1 demand outpacing capacity", confidenceLevel: "Estimated", dataProvenance: "Estimated" },
      contacts: [
        { firstName: "Vanessa", lastName: "Reyes", title: "Operations Manager", contactType: "operations_manager", email: "vanessa@gulfcoastwellness.com", directPhone: "(713) 555-0151", isDecisionMaker: true, isPrimary: true },
        { firstName: "Greg", lastName: "Patterson", title: "Owner", contactType: "owner", email: "greg@gulfcoastwellness.com" },
      ],
      calls: [
        { daysAgo: 5, outcome: "gatekeeper", answered: false, decisionMakerReached: false, interestLevel: "unknown", durationMin: 2 },
        { daysAgo: 3, outcome: "connected", answered: true, decisionMakerReached: true, interestLevel: "warm", durationMin: 19, notes: "Vanessa interested, will discuss with owner." },
      ],
      followUps: [
        { title: "Call Vanessa re: owner discussion", taskType: "phone_call", priority: "high", dueDaysFromNow: 1, status: "open" },
      ],
      deal: {
        name: "Gulf Coast — Multi-location Rollout",
        offer: "Directory + Lead Gen (4 locations)",
        stage: "qualified",
        monthlyValue: 5000,
        setupFee: 4000,
        totalValue: 60000,
        probability: 35,
        expectedCloseDaysFromNow: 35,
      },
      directory: { listingStatus: "unclaimed", claimStatus: "unclaimed", verificationStatus: "pending", completeness: 40, servicesCompleted: true, providersCompleted: false, locationCompleted: true, hoursCompleted: false, pricingCompleted: false, bookingLinkCompleted: false, publicationStatus: "draft" },
    },
    {
      name: "Northstar TRT Clinic",
      website: "https://northstartrt.com",
      primaryPhone: "(612) 555-0166",
      city: "Minneapolis",
      state: "MN",
      zip: "55401",
      timezone: "America/Chicago",
      numberOfLocations: 1,
      clinicType: "private_practice",
      telehealth: true,
      pipelineStage: "ready_to_call",
      priority: "high",
      readiness: 72,
      callAttempts: 0,
      directoryStatus: "imported",
      dealValue: 0,
      owner: salesMember.email,
      services: ["trt", "hormone-optimization"],
      qualification: { acceptingNewPatients: true, growthInterest: "medium", websiteQuality: "strong", bookingExperience: "online", decisionMakerIdentified: false, confidenceLevel: "Estimated", dataProvenance: "Estimated" },
      notes: "Strong TRT focus, single location. Research complete — ready for first call.",
      contacts: [
        { firstName: "Unknown", lastName: "Decision Maker", contactType: "general_contact", directPhone: "(612) 555-0166" },
      ],
    },
    {
      name: "Meridian Aesthetics & Wellness",
      website: "https://meridianaesthetics.com",
      primaryPhone: "(602) 555-0188",
      generalEmail: "info@meridianaesthetics.com",
      city: "Phoenix",
      state: "AZ",
      zip: "85012",
      timezone: "America/Phoenix",
      numberOfLocations: 2,
      clinicType: "group",
      telehealth: false,
      pipelineStage: "ready_to_call",
      priority: "normal",
      readiness: 66,
      callAttempts: 0,
      directoryStatus: "imported",
      owner: salesMember.email,
      services: ["hair-restoration", "iv-therapy", "sexual-wellness", "peptide-therapy"],
      qualification: { acceptingNewPatients: true, growthInterest: "low", websiteQuality: "average", decisionMakerIdentified: false, confidenceLevel: "Estimated", dataProvenance: "Estimated" },
      contacts: [
        { firstName: "Info", lastName: "Desk", contactType: "front_desk", email: "info@meridianaesthetics.com", directPhone: "(602) 555-0188" },
      ],
    },
    {
      name: "Brightside Longevity Clinic",
      website: "https://brightsidelongevity.com",
      primaryPhone: "(305) 555-0133",
      generalEmail: "contact@brightsidelongevity.com",
      city: "Miami",
      state: "FL",
      zip: "33101",
      timezone: "America/New_York",
      numberOfLocations: 1,
      clinicType: "private_practice",
      telehealth: true,
      pipelineStage: "attempted",
      priority: "high",
      readiness: 70,
      lastContactedDaysAgo: 1,
      nextAction: "Retry call — DM unavailable",
      nextActionDaysFromNow: 0,
      callAttempts: 2,
      directoryStatus: "imported",
      owner: founder.email,
      services: ["longevity", "trt", "peptide-therapy", "preventive-care"],
      qualification: { acceptingNewPatients: true, growthInterest: "high", websiteQuality: "strong", decisionMakerIdentified: true, confidenceLevel: "Estimated", dataProvenance: "Estimated" },
      contacts: [
        { firstName: "Elena", lastName: "Castro", title: "Owner", contactType: "owner", email: "elena@brightsidelongevity.com", directPhone: "(305) 555-0134", isDecisionMaker: true, isPrimary: true },
      ],
      calls: [
        { daysAgo: 3, outcome: "voicemail", answered: false, decisionMakerReached: false, interestLevel: "unknown", durationMin: 0 },
        { daysAgo: 1, outcome: "decision_maker_unavailable", answered: true, decisionMakerReached: false, interestLevel: "unknown", durationMin: 3, notes: "Front desk said Elena traveling.", nextAction: "Retry Monday" },
      ],
      followUps: [
        { title: "Retry call to Elena Castro", taskType: "phone_call", priority: "high", dueDaysFromNow: 0, status: "open" },
      ],
    },
    {
      name: "Rocky Mountain Men's Health",
      website: "https://rmmenshealth.com",
      primaryPhone: "(303) 555-0144",
      city: "Denver",
      state: "CO",
      zip: "80202",
      timezone: "America/Denver",
      numberOfLocations: 3,
      clinicType: "group",
      telehealth: true,
      pipelineStage: "follow_up_required",
      priority: "high",
      readiness: 77,
      lastContactedDaysAgo: 8,
      nextAction: "Send information packet",
      nextActionDaysFromNow: -1,
      callAttempts: 3,
      interested: true,
      directoryStatus: "unclaimed",
      owner: salesMember.email,
      services: ["trt", "ed-care", "hormone-optimization"],
      qualification: { acceptingNewPatients: true, growthInterest: "medium", decisionMakerIdentified: true, confidenceLevel: "Estimated", dataProvenance: "Estimated" },
      contacts: [
        { firstName: "Tom", lastName: "Becker", title: "Practice Manager", contactType: "practice_manager", email: "tom@rmmenshealth.com", directPhone: "(303) 555-0145", isDecisionMaker: true, isPrimary: true },
      ],
      calls: [
        { daysAgo: 12, outcome: "connected", answered: true, decisionMakerReached: true, interestLevel: "warm", durationMin: 11, notes: "Asked for info packet." },
        { daysAgo: 8, outcome: "call_back_requested", answered: true, decisionMakerReached: true, interestLevel: "warm", durationMin: 6, notes: "Wants info before next talk." },
      ],
      followUps: [
        { title: "Send information packet to Tom", taskType: "send_information", priority: "high", dueDaysAgo: 1, status: "open", notes: "OVERDUE — promised by yesterday." },
      ],
    },
    {
      name: "Coastal Medical Weight Loss",
      website: "https://coastalweightloss.com",
      primaryPhone: "(843) 555-0190",
      generalEmail: "team@coastalweightloss.com",
      city: "Charleston",
      state: "SC",
      zip: "29401",
      timezone: "America/New_York",
      numberOfLocations: 1,
      clinicType: "private_practice",
      telehealth: true,
      pipelineStage: "connected",
      priority: "normal",
      readiness: 64,
      lastContactedDaysAgo: 2,
      nextAction: "Qualify decision-maker",
      nextActionDaysFromNow: 2,
      callAttempts: 2,
      directoryStatus: "imported",
      owner: salesMember.email,
      services: ["medical-weight-loss", "glp-1"],
      qualification: { acceptingNewPatients: true, growthInterest: "medium", decisionMakerIdentified: false, confidenceLevel: "Estimated", dataProvenance: "Estimated" },
      contacts: [
        { firstName: "Dana", lastName: "Whitfield", title: "Front Desk", contactType: "front_desk", directPhone: "(843) 555-0190" },
      ],
      calls: [
        { daysAgo: 5, outcome: "no_answer", answered: false, decisionMakerReached: false, interestLevel: "unknown", durationMin: 0 },
        { daysAgo: 2, outcome: "connected", answered: true, decisionMakerReached: false, interestLevel: "warm", durationMin: 7, notes: "Front desk took message." },
      ],
    },
    {
      name: "Apex IV & Recovery",
      website: "https://apexivrecovery.com",
      primaryPhone: "(702) 555-0125",
      city: "Las Vegas",
      state: "NV",
      zip: "89101",
      timezone: "America/Los_Angeles",
      numberOfLocations: 2,
      clinicType: "group",
      telehealth: false,
      pipelineStage: "research_complete",
      priority: "normal",
      readiness: 58,
      callAttempts: 0,
      directoryStatus: "imported",
      owner: salesMember.email,
      services: ["iv-therapy", "performance-recovery", "peptide-therapy"],
      qualification: { acceptingNewPatients: true, growthInterest: "medium", decisionMakerIdentified: false, confidenceLevel: "Estimated", dataProvenance: "Estimated" },
      notes: "Research complete. Owner not yet identified — try LinkedIn.",
      contacts: [],
    },
    {
      name: "Lone Star Vitality",
      website: "https://lonestarvitality.com",
      primaryPhone: "(214) 555-0119",
      city: "Dallas",
      state: "TX",
      zip: "75201",
      timezone: "America/Chicago",
      numberOfLocations: 1,
      clinicType: "private_practice",
      telehealth: true,
      pipelineStage: "needs_research",
      priority: "normal",
      readiness: 40,
      callAttempts: 0,
      directoryStatus: "imported",
      owner: salesMember.email,
      services: ["trt", "hormone-optimization"],
      qualification: { decisionMakerIdentified: false, confidenceLevel: "Unknown", dataProvenance: "Unknown" },
      contacts: [],
    },
    {
      name: "Harbor Wellness Collective",
      website: "https://harborwellnessco.com",
      primaryPhone: "(503) 555-0157",
      city: "Portland",
      state: "OR",
      zip: "97201",
      timezone: "America/Los_Angeles",
      numberOfLocations: 1,
      clinicType: "private_practice",
      telehealth: true,
      pipelineStage: "imported",
      priority: "low",
      readiness: 30,
      callAttempts: 0,
      directoryStatus: "imported",
      owner: salesMember.email,
      services: ["mental-wellness", "iv-therapy"],
      qualification: { decisionMakerIdentified: false, confidenceLevel: "Unknown", dataProvenance: "Unknown" },
      contacts: [],
    },
    {
      name: "Summit Edge Anti-Aging",
      website: "https://summitedgeantiaging.com",
      primaryPhone: "(801) 555-0132",
      city: "Salt Lake City",
      state: "UT",
      zip: "84101",
      timezone: "America/Denver",
      numberOfLocations: 1,
      clinicType: "private_practice",
      telehealth: false,
      pipelineStage: "not_interested",
      priority: "low",
      readiness: 52,
      lastContactedDaysAgo: 10,
      callAttempts: 2,
      directoryStatus: "imported",
      owner: salesMember.email,
      services: ["hormone-optimization", "longevity"],
      qualification: { acceptingNewPatients: true, growthInterest: "low", decisionMakerIdentified: true, confidenceLevel: "Estimated", dataProvenance: "Estimated" },
      contacts: [
        { firstName: "Karen", lastName: "Bishop", title: "Owner", contactType: "owner", directPhone: "(801) 555-0132", isDecisionMaker: true, isPrimary: true },
      ],
      calls: [
        { daysAgo: 12, outcome: "not_interested", answered: true, decisionMakerReached: true, interestLevel: "cold", durationMin: 5, notes: "Says marketing budget frozen." },
        { daysAgo: 10, outcome: "already_has_provider", answered: true, decisionMakerReached: true, interestLevel: "cold", durationMin: 3, notes: "Has existing agency." },
      ],
    },
    {
      name: "Bluegrass Men's Clinic",
      website: "https://bluegrassmensclinic.com",
      primaryPhone: "(859) 555-0148",
      city: "Lexington",
      state: "KY",
      zip: "40507",
      timezone: "America/New_York",
      numberOfLocations: 1,
      clinicType: "private_practice",
      telehealth: true,
      pipelineStage: "do_not_call",
      priority: "low",
      readiness: 20,
      lastContactedDaysAgo: 20,
      callAttempts: 1,
      doNotCall: true,
      directoryStatus: "archived",
      owner: salesMember.email,
      services: ["trt", "ed-care"],
      qualification: { decisionMakerIdentified: false, confidenceLevel: "Unknown", dataProvenance: "Unknown" },
      contacts: [],
      calls: [
        { daysAgo: 20, outcome: "do_not_call", answered: true, decisionMakerReached: true, interestLevel: "cold", durationMin: 1, notes: "Asked to be removed from list." },
      ],
    },
    {
      name: "Pioneer Health & Hormone",
      website: "https://pioneerhealthhormone.com",
      primaryPhone: "(405) 555-0163",
      generalEmail: "office@pioneerhealthhormone.com",
      city: "Oklahoma City",
      state: "OK",
      zip: "73102",
      timezone: "America/Chicago",
      numberOfLocations: 1,
      clinicType: "private_practice",
      telehealth: true,
      pipelineStage: "paid",
      priority: "normal",
      readiness: 92,
      lastContactedDaysAgo: 5,
      nextAction: "Quarterly check-in",
      nextActionDaysFromNow: 30,
      callAttempts: 8,
      interested: true,
      paid: true,
      directoryStatus: "published",
      dealValue: 48000,
      owner: founder.email,
      services: ["trt", "hormone-optimization", "peptide-therapy"],
      qualification: { acceptingNewPatients: true, growthInterest: "high", websiteQuality: "strong", decisionMakerIdentified: true, confidenceLevel: "Verified", dataProvenance: "Verified" },
      contacts: [
        { firstName: "Henry", lastName: "Walsh", title: "Owner", contactType: "owner", email: "henry@pioneerhealthhormone.com", directPhone: "(405) 555-0164", isDecisionMaker: true, isPrimary: true },
      ],
      calls: [
        { daysAgo: 5, outcome: "connected", answered: true, decisionMakerReached: true, interestLevel: "hot", durationMin: 15, notes: "Happy with results. Quarterly check-in set." },
      ],
      followUps: [
        { title: "Quarterly check-in with Henry", taskType: "phone_call", priority: "normal", dueDaysFromNow: 30, status: "open" },
      ],
      deal: {
        name: "Pioneer — Annual Partnership",
        offer: "Directory Premium + Lead Gen",
        stage: "active",
        monthlyValue: 4000,
        setupFee: 0,
        totalValue: 48000,
        probability: 100,
        expectedCloseDaysFromNow: -5,
      },
      directory: { listingStatus: "published", claimStatus: "verified", verificationStatus: "verified", completeness: 95, servicesCompleted: true, providersCompleted: true, locationCompleted: true, hoursCompleted: true, pricingCompleted: true, bookingLinkCompleted: true, publicationStatus: "published" },
    },
  ];

  // Clear existing operational data (keep services + admins via upsert)
  await db.notification.deleteMany();
  await db.activity.deleteMany()
  await db.dealStageHistory.deleteMany()
  await db.followUpTask.deleteMany()
  await db.callSession.deleteMany()
  await db.deal.deleteMany()
  await db.directoryProfile.deleteMany()
  await db.clinicPipelineHistory.deleteMany()
  await db.clinicService.deleteMany()
  await db.clinicContact.deleteMany()
  await db.clinicLocation.deleteMany()
  await db.clinic.deleteMany()

  const adminByEmail: Record<string, string> = {
    [founder.email]: founder.id,
    [admin2.email]: admin2.id,
    [salesMember.email]: salesMember.id,
  };

  for (const [i, c] of clinics.entries()) {
    const clinic = await db.clinic.create({
      data: {
        name: c.name,
        legalName: c.legalName ?? null,
        website: c.website ?? null,
        primaryPhone: c.primaryPhone ?? null,
        generalEmail: c.generalEmail ?? null,
        city: c.city,
        state: c.state,
        zip: c.zip,
        timezone: c.timezone,
        numberOfLocations: c.numberOfLocations ?? 1,
        clinicType: c.clinicType ?? "private_practice",
        telehealth: c.telehealth ?? false,
        pipelineStage: c.pipelineStage,
        priority: c.priority,
        readinessScore: c.readiness,
        lastContactedAt: c.lastContactedDaysAgo != null ? daysAgo(c.lastContactedDaysAgo) : null,
        nextAction: c.nextAction ?? null,
        nextActionAt: c.nextActionDaysFromNow != null ? daysFromNow(c.nextActionDaysFromNow) : null,
        callAttempts: c.callAttempts ?? 0,
        interested: c.interested ?? false,
        paid: c.paid ?? false,
        doNotCall: c.doNotCall ?? false,
        directoryStatus: c.directoryStatus ?? "imported",
        dealValue: c.dealValue ?? 0,
        owner: c.owner ?? null,
        ownerId: c.owner ? adminByEmail[c.owner] : null,
        qualification: JSON.stringify(c.qualification),
        notes: c.notes ?? null,
        dateImported: daysAgo(20 - i),
        createdById: founder.id,
        updatedById: founder.id,
      },
    });

    // Services
    if (c.services.length) {
      await db.clinicService.createMany({
        data: c.services.map((slug) => ({ clinicId: clinic.id, serviceId: services[slug].id })),
      });
    }

    // Contacts
    let primaryContactId: string | null = null;
    for (const ct of c.contacts) {
      const contact = await db.clinicContact.create({
        data: {
          clinicId: clinic.id,
          firstName: ct.firstName,
          lastName: ct.lastName,
          title: ct.title ?? null,
          contactType: ct.contactType,
          email: ct.email ?? null,
          directPhone: ct.directPhone ?? null,
          mobilePhone: ct.mobilePhone ?? null,
          isDecisionMaker: ct.isDecisionMaker ?? false,
          isPrimary: ct.isPrimary ?? false,
        },
      });
      if (ct.isPrimary) primaryContactId = contact.id;
    }

    // Calls
    for (const call of c.calls ?? []) {
      await db.callSession.create({
        data: {
          clinicId: clinic.id,
          contactId: primaryContactId,
          startedAt: hoursAgo(call.daysAgo * 24),
          endedAt: hoursAgo(call.daysAgo * 24 - Math.round(call.durationMin / 60)),
          durationSec: call.durationMin * 60,
          direction: "outbound",
          attemptNumber: (c.calls?.indexOf(call) ?? 0) + 1,
          answered: call.answered,
          decisionMakerReached: call.decisionMakerReached,
          outcome: call.outcome,
          interestLevel: call.interestLevel,
          notes: call.notes ?? null,
          nextAction: call.nextAction ?? null,
          adminId: founder.id,
        },
      });
    }

    // Follow-ups
    for (const fu of c.followUps ?? []) {
      const due = fu.dueDaysFromNow != null ? daysFromNow(fu.dueDaysFromNow) : fu.dueDaysAgo != null ? daysAgo(fu.dueDaysAgo) : null;
      await db.followUpTask.create({
        data: {
          title: fu.title,
          clinicId: clinic.id,
          contactId: primaryContactId,
          taskType: fu.taskType,
          priority: fu.priority,
          dueDate: due,
          status: fu.status,
          notes: fu.notes ?? null,
          assignedAdminId: founder.id,
        },
      });
    }

    // Deal
    if (c.deal) {
      const d = c.deal;
      const deal = await db.deal.create({
        data: {
          name: d.name,
          clinicId: clinic.id,
          contactId: primaryContactId,
          offer: d.offer,
          ownerId: c.owner ? adminByEmail[c.owner] : founder.id,
          stage: d.stage,
          estimatedMonthlyValue: d.monthlyValue,
          setupFee: d.setupFee,
          estimatedTotalValue: d.totalValue,
          probability: d.probability,
          expectedCloseDate: d.expectedCloseDaysFromNow != null ? daysFromNow(d.expectedCloseDaysFromNow) : null,
          pilotStartDate: d.pilotStartDaysFromNow != null ? daysFromNow(d.pilotStartDaysFromNow) : null,
          paymentStatus: d.stage === "active" || d.stage === "won" ? "paid" : "none",
        },
      });
      await db.dealStageHistory.create({
        data: { dealId: deal.id, toStage: d.stage, changedById: founder.id, note: "Initial stage" },
      });
    }

    // Directory profile
    if (c.directory) {
      const dir = c.directory;
      await db.directoryProfile.create({
        data: {
          clinicId: clinic.id,
          listingStatus: dir.listingStatus,
          claimStatus: dir.claimStatus,
          verificationStatus: dir.verificationStatus,
          profileCompleteness: dir.completeness,
          servicesCompleted: dir.servicesCompleted ?? false,
          providersCompleted: dir.providersCompleted ?? false,
          locationCompleted: dir.locationCompleted ?? false,
          hoursCompleted: dir.hoursCompleted ?? false,
          pricingCompleted: dir.pricingCompleted ?? false,
          bookingLinkCompleted: dir.bookingLinkCompleted ?? false,
          publicationStatus: dir.publicationStatus ?? "draft",
          lastReviewedAt: dir.verificationStatus === "verified" ? daysAgo(3) : null,
          reviewedById: dir.verificationStatus === "verified" ? founder.id : null,
        },
      });
    }

    // Pipeline history (initial)
    await db.clinicPipelineHistory.create({
      data: { clinicId: clinic.id, toStage: c.pipelineStage, changedById: founder.id, note: "Imported at stage" },
    });

    // Activity
    await db.activity.create({
      data: {
        entityType: "clinic",
        entityId: clinic.id,
        action: "clinic_created",
        summary: `Clinic "${c.name}" added`,
        adminId: founder.id,
        metadata: JSON.stringify({ stage: c.pipelineStage, city: c.city, state: c.state }),
        timestamp: daysAgo(20 - i),
      },
    });
  }

  // Seed a set of recent activities referencing various entities
  const allClinics = await db.clinic.findMany({ select: { id: true, name: true }, take: 6 });
  const activityTemplates = [
    { action: "call_logged", summary: "Call logged — Connected with decision-maker", entity: "clinic", meta: { outcome: "connected" } },
    { action: "followup_created", summary: "Follow-up created — Send proposal", entity: "clinic" },
    { action: "stage_changed", summary: "Stage changed → Proposal Sent", entity: "clinic", meta: { to: "proposal_sent" } },
    { action: "deal_created", summary: "Deal created — Annual Partnership", entity: "deal" },
    { action: "directory_status_changed", summary: "Directory status → Published", entity: "clinic", meta: { to: "published" } },
    { action: "contact_added", summary: "Contact added — Practice Manager", entity: "clinic" },
  ];
  for (let i = 0; i < activityTemplates.length; i++) {
    const t = activityTemplates[i];
    const c = allClinics[i % allClinics.length];
    await db.activity.create({
      data: {
        entityType: t.entity,
        entityId: c.id,
        action: t.action,
        summary: `${t.summary} — ${c.name}`,
        adminId: founder.id,
        metadata: JSON.stringify(t.meta ?? {}),
        timestamp: hoursAgo(i * 5 + 1),
      },
    });
  }

  // Notifications for the founder
  await db.notification.createMany({
    data: [
      { adminId: founder.id, type: "followup_overdue", title: "Overdue follow-up", message: "Send information packet to Rocky Mountain Men's Health is overdue.", relatedEntityType: "followup", isRead: false },
      { adminId: founder.id, type: "meeting_booked", title: "Meeting booked", message: "Pacific Men's Health discovery call scheduled tomorrow.", relatedEntityType: "clinic", isRead: false },
      { adminId: founder.id, type: "deal_stage_changed", title: "Deal updated", message: "Cardinal Performance — pilot metrics review due.", relatedEntityType: "deal", isRead: true },
    ],
  });

  console.log("Seed complete.");
  console.log("  Login: founder@novalyte.io / novalyte2025");
  console.log(`  Clinics: ${clinics.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
