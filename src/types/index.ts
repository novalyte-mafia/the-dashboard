/**
 * Novalyte Admin — Shared Domain Types
 *
 * These types define the canonical shape of every entity in the platform.
 * Both mock repositories and real backend repositories must conform to these.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------
export type ID = string;
export type ISODate = string; // ISO 8601 string
export type Priority = "low" | "normal" | "high" | "critical";
export type ConfidenceLevel = "verified" | "self_reported" | "estimated" | "unknown";

export interface Auditable {
  id: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
  createdById?: ID;
  updatedById?: ID;
}

export interface ActivityEvent {
  id: ID;
  entityType: string;
  entityId: ID;
  action: string;
  summary: string;
  adminId?: ID;
  adminName?: string;
  timestamp: ISODate;
  metadata?: Record<string, unknown>;
}

export interface NotificationItem {
  id: ID;
  type: string;
  title: string;
  message: string;
  priority: Priority;
  isRead: boolean;
  relatedEntityType?: string;
  relatedEntityId?: ID;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Admin / Team
// ---------------------------------------------------------------------------
export type AdminRole = "founder" | "admin" | "sales" | "operations" | "directory_reviewer";

export interface AdminMember {
  id: ID;
  email: string;
  role: AdminRole;
  status: "active" | "suspended" | "revoked";
  firstName: string;
  lastName: string;
  lastLoginAt?: ISODate;
  createdAt: ISODate;
}

export interface SavedView {
  id: ID;
  name: string;
  scope: string;
  filters: Record<string, unknown>;
  isDefault?: boolean;
}

// ---------------------------------------------------------------------------
// Clinics
// ---------------------------------------------------------------------------
export type PipelineStage =
  | "imported" | "needs_research" | "research_complete" | "ready_to_call"
  | "attempted" | "connected" | "decision_maker_reached" | "follow_up_required"
  | "meeting_booked" | "interested" | "directory_approved" | "patient_demand_presented"
  | "pilot_proposed" | "pilot_active" | "proposal_sent" | "negotiation"
  | "paid" | "won" | "not_interested" | "invalid" | "do_not_call" | "lost";

export type ClinicType = "private_practice" | "group" | "franchise" | "telehealth" | "hospital";
export type DirectoryStatus =
  | "imported" | "unclaimed" | "claim_requested" | "identity_review"
  | "information_required" | "approved" | "published" | "needs_update"
  | "suspended" | "archived";

export interface ClinicContact {
  id: ID;
  clinicId: ID;
  firstName: string;
  lastName: string;
  title?: string;
  contactType: string;
  email?: string;
  directPhone?: string;
  mobilePhone?: string;
  linkedinUrl?: string;
  preferredContactMethod: "phone" | "email" | "sms" | "linkedin";
  isDecisionMaker: boolean;
  isPrimary: boolean;
  notes?: string;
  lastContactedAt?: ISODate;
  consentStatus: "unknown" | "opted_in" | "opted_out";
  archived: boolean;
}

export interface Clinic {
  id: ID;
  name: string;
  legalName?: string;
  website?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  generalEmail?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  numberOfLocations: number;
  numberOfProviders?: number;
  clinicType: ClinicType;
  telehealth: boolean;
  operatingStatus: "operating" | "closed" | "relocated" | "unknown";
  pipelineStage: PipelineStage;
  priority: Priority;
  readinessScore: number;
  opportunityScore?: number;
  leadScore?: number;
  callAttempts: number;
  lastContactedAt?: ISODate;
  nextAction?: string;
  nextActionAt?: ISODate;
  interested: boolean;
  paid: boolean;
  doNotCall: boolean;
  archived: boolean;
  directoryStatus: DirectoryStatus;
  verificationStatus: "pending" | "verified" | "rejected";
  profileCompletion: number;
  estimatedValue: number;
  owner?: string;
  tags: string[];
  source?: string;
  services: string[];
  contacts: ClinicContact[];
  dateImported: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------
export type CallOutcome =
  | "no_answer" | "voicemail" | "gatekeeper" | "wrong_number"
  | "disconnected_number" | "decision_maker_unavailable" | "call_back_requested"
  | "information_requested" | "connected" | "interested" | "meeting_booked"
  | "not_interested" | "already_has_provider" | "at_capacity" | "do_not_call" | "other";

export type CallState = "idle" | "configuring" | "dialing" | "ringing" | "connected" | "on_hold" | "ended" | "failed" | "provider_unavailable";

export interface CallSession {
  id: ID;
  clinicId: ID;
  contactId?: ID;
  clinicName: string;
  contactName?: string;
  startedAt: ISODate;
  endedAt?: ISODate;
  durationSec: number;
  direction: "inbound" | "outbound";
  attemptNumber: number;
  answered: boolean;
  decisionMakerReached: boolean;
  outcome: CallOutcome;
  interestLevel: "unknown" | "cold" | "warm" | "hot";
  objections: string[];
  notes?: string;
  nextAction?: string;
  nextActionAt?: ISODate;
  followUpRequired: boolean;
  adminName?: string;
}

// ---------------------------------------------------------------------------
// Follow-ups / Tasks
// ---------------------------------------------------------------------------
export type FollowUpType =
  | "phone_call" | "email" | "meeting" | "send_information" | "send_directory_link"
  | "complete_listing" | "prepare_proposal" | "send_proposal" | "proposal_follow_up"
  | "patient_demand_update" | "general_task";

export type TaskStatus = "open" | "in_progress" | "completed" | "rescheduled" | "cancelled" | "overdue";

export interface FollowUpTask {
  id: ID;
  title: string;
  clinicId?: ID;
  clinicName?: string;
  contactId?: ID;
  contactName?: string;
  relatedCallId?: ID;
  relatedDealId?: ID;
  taskType: FollowUpType;
  priority: Priority;
  dueDate?: ISODate;
  dueTime?: string;
  status: TaskStatus;
  notes?: string;
  completedAt?: ISODate;
  assignedAdminName?: string;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------
export type DealStage =
  | "opportunity_identified" | "discovery_completed" | "qualified" | "pilot_discussed"
  | "proposal_requested" | "proposal_sent" | "negotiation" | "contract_sent"
  | "contract_signed" | "payment_pending" | "active" | "won" | "lost" | "paused";

export interface Deal {
  id: ID;
  name: string;
  clinicId?: ID;
  clinicName?: string;
  contactId?: ID;
  contactName?: string;
  offer?: string;
  ownerId?: ID;
  ownerName?: string;
  stage: DealStage;
  estimatedMonthlyValue: number;
  setupFee: number;
  performanceFee: number;
  estimatedTotalValue: number;
  probability: number;
  expectedCloseDate?: ISODate;
  pilotStartDate?: ISODate;
  pilotEndDate?: ISODate;
  proposalUrl?: string;
  contractStatus: "none" | "drafting" | "sent" | "reviewing" | "signed" | "rejected";
  paymentStatus: "none" | "pending" | "partial" | "paid" | "overdue";
  notes?: string;
  lostReason?: string;
  archived: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------
export interface DirectoryProfile {
  id: ID;
  clinicId: ID;
  clinicName: string;
  listingStatus: DirectoryStatus;
  claimStatus: "unclaimed" | "requested" | "verified" | "rejected";
  verificationStatus: "pending" | "verified" | "rejected";
  profileCompleteness: number;
  servicesCompleted: boolean;
  providersCompleted: boolean;
  locationCompleted: boolean;
  hoursCompleted: boolean;
  pricingCompleted: boolean;
  imagesCompleted: boolean;
  bookingLinkCompleted: boolean;
  lastReviewedAt?: ISODate;
  reviewedByName?: string;
  publicationStatus: "draft" | "ready" | "published" | "unpublished";
}

// ---------------------------------------------------------------------------
// Patient Operations
// ---------------------------------------------------------------------------
export type PatientLeadStatus =
  | "new" | "qualified" | "contacted" | "routed" | "booked" | "lost" | "disqualified" | "duplicate";

export interface PatientLead {
  id: ID;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  zip?: string;
  age?: number;
  treatmentInterest: string;
  symptoms?: string;
  assessmentScore?: number;
  preferredContact: "phone" | "email" | "sms";
  availability?: string;
  insurancePreference: "insurance" | "self_pay" | "unsure";
  telehealthPreference: boolean;
  distancePreference?: number;
  consentStatus: "unknown" | "opted_in" | "opted_out";
  leadSource: string;
  campaignSource?: string;
  qualificationScore: number;
  urgencyScore: number;
  status: PatientLeadStatus;
  assignedClinicId?: ID;
  assignedClinicName?: string;
  referralStatus?: string;
  bookingOutcome?: string;
  notes?: string;
  createdAt: ISODate;
}

export interface ClinicMatch {
  id: ID;
  patientLeadId: ID;
  clinicId: ID;
  clinicName: string;
  matchScore: number;
  geographicFit: number;
  treatmentFit: number;
  capacityFit: number;
  telehealthFit: number;
  bookingFit: number;
  priceFit: number;
  verificationStatus: "verified" | "pending" | "unverified";
  explanation: string;
}

// ---------------------------------------------------------------------------
// Demand Intelligence
// ---------------------------------------------------------------------------
export interface MarketData {
  id: ID;
  geography: string; // "Austin, TX" or "75001"
  type: "state" | "city" | "zip";
  state: string;
  city?: string;
  zip?: string;
  searchVolume: number;
  searchTrend: number; // % change
  topTreatments: string[];
  topKeywords: { keyword: string; volume: number; cpc: number }[];
  avgCpc: number;
  competitionScore: number; // 0-100
  commercialIntent: number; // 0-100
  clinicSupply: number;
  patientDemand: number;
  supplyDemandGap: number; // positive = underserved
  opportunityScore: number;
  rising: boolean;
}

// ---------------------------------------------------------------------------
// Advertising / Growth
// ---------------------------------------------------------------------------
export type CampaignStatus = "active" | "paused" | "ended" | "draft" | "review";

export interface Campaign {
  id: ID;
  name: string;
  platform: "google" | "meta" | "tiktok" | "linkedin" | "email";
  status: CampaignStatus;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;
  costPerLead: number;
  ctr: number;
  conversionRate: number;
  startDate?: ISODate;
  endDate?: ISODate;
  targeting?: string;
}

// ---------------------------------------------------------------------------
// Workforce
// ---------------------------------------------------------------------------
export interface Professional {
  id: ID;
  name: string;
  role: string;
  specialty: string;
  city?: string;
  state?: string;
  licenses: string[];
  certifications: string[];
  yearsExperience: number;
  availability: "available" | "open" | "placed" | "unavailable";
  linkedinUrl?: string;
  resumeUrl?: string;
  credentialStatus: "pending" | "verified" | "expired" | "rejected";
  verificationStatus: "pending" | "verified" | "rejected";
  matchScore?: number;
  createdAt: ISODate;
}

export interface JobListing {
  id: ID;
  title: string;
  employerName: string;
  employerId: ID;
  specialty: string;
  city?: string;
  state?: string;
  type: "full_time" | "part_time" | "contract" | "locum";
  salaryMin?: number;
  salaryMax?: number;
  status: "open" | "closed" | "filled" | "draft";
  applicationsCount: number;
  createdAt: ISODate;
}

export interface JobApplication {
  id: ID;
  jobId: ID;
  jobTitle: string;
  employerName: string;
  professionalId: ID;
  professionalName: string;
  status: "submitted" | "reviewing" | "interview" | "offered" | "hired" | "rejected";
  appliedAt: ISODate;
  matchScore?: number;
}

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------
export interface Product {
  id: ID;
  title: string;
  sku: string;
  category: string;
  vendor: string;
  price: number;
  compareAtPrice?: number;
  cost: number;
  margin: number;
  inventory: number;
  status: "active" | "draft" | "archived" | "out_of_stock";
  visibility: "public" | "hidden" | "unlisted";
  rating?: number;
  reviewCount: number;
}

export interface Order {
  id: ID;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  paymentStatus: "paid" | "pending" | "refunded" | "failed";
  fulfillmentStatus: "fulfilled" | "unfulfilled" | "partial" | "shipped";
  trackingNumber?: string;
  createdAt: ISODate;
  riskFlags?: string[];
}

// ---------------------------------------------------------------------------
// Content / Journal
// ---------------------------------------------------------------------------
export type ArticleStatus =
  | "idea" | "brief" | "draft" | "review" | "approved"
  | "scheduled" | "published" | "update_needed" | "archived";

export interface Article {
  id: ID;
  title: string;
  slug: string;
  excerpt?: string;
  category: string;
  treatmentCategory?: string;
  audience?: string;
  searchIntent?: string;
  primaryKeyword?: string;
  secondaryKeywords: string[];
  authorName: string;
  reviewerName?: string;
  status: ArticleStatus;
  wordCount?: number;
  seoScore?: number;
  readabilityScore?: number;
  publishDate?: ISODate;
  views?: number;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Automation / AI
// ---------------------------------------------------------------------------
export interface Automation {
  id: ID;
  name: string;
  description?: string;
  trigger: string;
  actions: string[];
  status: "active" | "paused" | "error" | "draft";
  lastRunAt?: ISODate;
  runCount: number;
  failureCount: number;
}

export interface AIUsageRecord {
  id: ID;
  model: string;
  feature: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  timestamp: ISODate;
}

// ---------------------------------------------------------------------------
// System / Settings
// ---------------------------------------------------------------------------
export interface Integration {
  key: string;
  label: string;
  status: "connected" | "not_connected" | "configuration_required" | "error";
  note?: string;
  lastSyncAt?: ISODate;
}

export interface AuditEvent {
  id: ID;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId?: ID;
  ipAddress?: string;
  timestamp: ISODate;
  metadata?: Record<string, unknown>;
}

export interface KPIMetric {
  label: string;
  value: string | number;
  hint?: string;
  trend?: number;
  icon?: string;
  tone?: "default" | "teal" | "amber" | "rose" | "green" | "violet";
  href?: string;
}
