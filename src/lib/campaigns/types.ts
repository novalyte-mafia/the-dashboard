import "server-only";

export type CampaignStatus = "draft" | "active" | "paused" | "archived";
export type TrafficType =
  | "organic"
  | "paid_search"
  | "paid_social"
  | "directory"
  | "education"
  | "market_test";

export type PageType =
  | "service_location"
  | "paid_conversion"
  | "regional_discovery"
  | "clinic_campaign"
  | "educational_article"
  | "qa_article"
  | "treatment_comparison"
  | "general_campaign";

export type PageHost = "organic" | "ads";

export type PageStatus =
  | "draft"
  | "generating"
  | "generation_failed"
  | "needs_review"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "published"
  | "paused"
  | "archived"
  | "redirected";

export type IndexingPolicy =
  | "index_follow"
  | "noindex_follow"
  | "noindex_nofollow"
  | "draft_inaccessible";

export type GeoKind =
  | "country"
  | "state"
  | "metro"
  | "county"
  | "city"
  | "neighborhood"
  | "zip";

export type GenerationJobStatus = "queued" | "running" | "succeeded" | "failed";

export type PageAction =
  | "submit_review"
  | "approve"
  | "request_changes"
  | "publish"
  | "pause"
  | "archive";

export interface CsTreatmentVertical {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  active: boolean;
  default_assessment_slug?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CsGeoEntity {
  id: string;
  kind: GeoKind;
  slug: string;
  name: string;
  parent_id: string | null;
  state_code: string | null;
  created_at: string;
}

export interface CsTemplate {
  id: string;
  slug: string;
  name: string;
  page_type: PageType;
  description: string | null;
  active: boolean;
  created_at: string;
}

export interface CsTemplateVersion {
  id: string;
  template_id: string;
  version: number;
  modules: unknown[];
  required_modules: string[];
  optional_modules: string[];
  compliance_rules: Record<string, unknown>;
  created_at: string;
}

export interface CsCampaign {
  id: string;
  name: string;
  internal_name: string | null;
  objective: string | null;
  traffic_type: TrafficType | null;
  vertical_id: string | null;
  status: CampaignStatus;
  owner_admin_id: string | null;
  metrics: Record<string, unknown>;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CsCampaignTarget {
  id: string;
  campaign_id: string;
  vertical_id: string | null;
  geo_id: string | null;
  intent: string | null;
  clinic_ids: string[];
  include: boolean;
  warnings: unknown[];
  created_at: string;
}

export type AssessmentStatus =
  | "unconfigured"
  | "draft"
  | "ready"
  | "published"
  | "invalid";

export interface CsAssessmentTemplate {
  id: string;
  slug: string;
  name: string;
  category: string;
  assessment_engine_slug: string;
  description: string | null;
  mode: "full" | "short" | "qualification";
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CsAssessmentTemplateVersion {
  id: string;
  template_id: string;
  version: number;
  status: "draft" | "approved" | "published" | "retired";
  config: Record<string, unknown>;
  question_ids: string[];
  required_question_ids: string[];
  optional_question_ids: string[];
  eligibility_rules: Record<string, unknown>;
  disqualification_rules: Record<string, unknown>;
  consent_version: string;
  consent_copy: string | null;
  completion_message: string | null;
  next_action: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface CsPage {
  id: string;
  campaign_id: string | null;
  template_version_id: string | null;
  page_type: string | null;
  host: PageHost;
  slug: string;
  path: string;
  service_slug: string | null;
  state_slug: string | null;
  city_slug: string | null;
  geo_id: string | null;
  vertical_id: string | null;
  status: PageStatus;
  indexing_policy: IndexingPolicy;
  public_title: string | null;
  internal_title: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  hero: Record<string, unknown>;
  cta_primary: string | null;
  cta_secondary: string | null;
  form_config: Record<string, unknown>;
  routing_config: Record<string, unknown>;
  related_article_id: string | null;
  assessment_template_id: string | null;
  assessment_version_id: string | null;
  assessment_placement: string[];
  assessment_status: AssessmentStatus;
  current_version: number;
  published_at: string | null;
  scheduled_for: string | null;
  quality_score: number | null;
  override_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CsPageVersion {
  id: string;
  page_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  blocks: unknown[];
  editor_admin_id: string | null;
  change_summary: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface CsQualityReport {
  id: string;
  page_id: string;
  score: number | null;
  checks: QualityCheck[];
  blocking: boolean;
  override_reason: string | null;
  created_at: string;
}

export interface QualityCheck {
  id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  message?: string;
}

export interface CsGenerationJob {
  id: string;
  campaign_id: string | null;
  page_id: string | null;
  status: GenerationJobStatus;
  payload: Record<string, unknown>;
  error: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export interface CreateCampaignInput {
  name: string;
  internalName?: string;
  objective?: string;
  trafficType?: TrafficType;
  verticalId?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateCampaignInput {
  name?: string;
  internalName?: string | null;
  objective?: string | null;
  trafficType?: TrafficType | null;
  verticalId?: string | null;
  status?: CampaignStatus;
  settings?: Record<string, unknown>;
}

export interface CampaignTargetInput {
  verticalId?: string | null;
  geoId?: string | null;
  intent?: string | null;
  clinicIds?: string[];
  include?: boolean;
  warnings?: unknown[];
}

export interface UpdatePageInput {
  publicTitle?: string | null;
  internalTitle?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  hero?: Record<string, unknown>;
  ctaPrimary?: string | null;
  ctaSecondary?: string | null;
  formConfig?: Record<string, unknown>;
  routingConfig?: Record<string, unknown>;
  indexingPolicy?: IndexingPolicy;
  status?: PageStatus;
  relatedArticleId?: string | null;
  assessmentPlacement?: string[];
  assessmentStatus?: AssessmentStatus;
}
