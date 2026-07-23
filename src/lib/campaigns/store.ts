import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { adsPath, buildAdsSlug, organicPath } from "./slug";
import { requestCampaignRevalidation } from "./revalidate-hooks";
import type {
  CampaignTargetInput,
  CreateCampaignInput,
  CsCampaign,
  CsCampaignTarget,
  CsGeoEntity,
  CsGenerationJob,
  CsPage,
  CsQualityReport,
  CsTemplate,
  CsTemplateVersion,
  CsTreatmentVertical,
  CsAssessmentTemplate,
  CsAssessmentTemplateVersion,
  PageAction,
  PageHost,
  PageStatus,
  TrafficType,
  UpdateCampaignInput,
  UpdatePageInput,
} from "./types";

type SupabaseAny = ReturnType<typeof getSupabaseAdmin> & {
  from: (table: string) => any;
};

function sb(): SupabaseAny {
  return getSupabaseAdmin() as unknown as SupabaseAny;
}

function throwIfError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Verticals & geo
// ---------------------------------------------------------------------------

export async function listVerticals(activeOnly = true): Promise<CsTreatmentVertical[]> {
  let query = sb().from("cs_treatment_verticals").select("*").order("name");
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  throwIfError(error, "listVerticals");
  return (data ?? []) as CsTreatmentVertical[];
}

export async function listGeoEntities(params?: {
  kind?: string;
  parentId?: string;
}): Promise<CsGeoEntity[]> {
  let query = sb().from("cs_geo_entities").select("*").order("name");
  if (params?.kind) query = query.eq("kind", params.kind);
  if (params?.parentId) query = query.eq("parent_id", params.parentId);
  const { data, error } = await query;
  throwIfError(error, "listGeoEntities");
  return (data ?? []) as CsGeoEntity[];
}

export async function getGeoEntity(id: string): Promise<CsGeoEntity | null> {
  const { data, error } = await sb()
    .from("cs_geo_entities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error, "getGeoEntity");
  return (data as CsGeoEntity) ?? null;
}

export async function getVertical(id: string): Promise<CsTreatmentVertical | null> {
  const { data, error } = await sb()
    .from("cs_treatment_verticals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error, "getVertical");
  return (data as CsTreatmentVertical) ?? null;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function listTemplatesWithVersions(): Promise<
  (CsTemplate & { versions: CsTemplateVersion[] })[]
> {
  const { data: templates, error: tErr } = await sb()
    .from("cs_templates")
    .select("*")
    .eq("active", true)
    .order("name");
  throwIfError(tErr, "listTemplates");

  const { data: versions, error: vErr } = await sb()
    .from("cs_template_versions")
    .select("*")
    .order("version", { ascending: false });
  throwIfError(vErr, "listTemplateVersions");

  const byTemplate = new Map<string, CsTemplateVersion[]>();
  for (const v of (versions ?? []) as CsTemplateVersion[]) {
    const list = byTemplate.get(v.template_id) ?? [];
    list.push(v);
    byTemplate.set(v.template_id, list);
  }

  return ((templates ?? []) as CsTemplate[]).map((t) => ({
    ...t,
    versions: byTemplate.get(t.id) ?? [],
  }));
}

export async function getTemplateVersionByPageType(
  pageType: string,
): Promise<CsTemplateVersion | null> {
  const { data: template, error: tErr } = await sb()
    .from("cs_templates")
    .select("id")
    .eq("page_type", pageType)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  throwIfError(tErr, "getTemplateVersionByPageType");
  if (!template) return null;

  const { data: version, error: vErr } = await sb()
    .from("cs_template_versions")
    .select("*")
    .eq("template_id", template.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(vErr, "getTemplateVersionByPageType");
  return (version as CsTemplateVersion) ?? null;
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export async function listCampaigns(status?: string): Promise<CsCampaign[]> {
  let query = sb().from("cs_campaigns").select("*").order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  throwIfError(error, "listCampaigns");
  return (data ?? []) as CsCampaign[];
}

export async function getCampaign(id: string): Promise<CsCampaign | null> {
  const { data, error } = await sb()
    .from("cs_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error, "getCampaign");
  return (data as CsCampaign) ?? null;
}

export async function createCampaign(
  input: CreateCampaignInput,
  adminId?: string,
): Promise<CsCampaign> {
  const { data, error } = await sb()
    .from("cs_campaigns")
    .insert({
      name: input.name,
      internal_name: input.internalName ?? null,
      objective: input.objective ?? null,
      traffic_type: input.trafficType ?? null,
      vertical_id: input.verticalId ?? null,
      owner_admin_id: adminId ?? null,
      settings: input.settings ?? {},
    })
    .select("*")
    .single();
  throwIfError(error, "createCampaign");
  return data as CsCampaign;
}

export async function updateCampaign(
  id: string,
  input: UpdateCampaignInput,
): Promise<CsCampaign> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.internalName !== undefined) patch.internal_name = input.internalName;
  if (input.objective !== undefined) patch.objective = input.objective;
  if (input.trafficType !== undefined) patch.traffic_type = input.trafficType;
  if (input.verticalId !== undefined) patch.vertical_id = input.verticalId;
  if (input.status !== undefined) patch.status = input.status;
  if (input.settings !== undefined) patch.settings = input.settings;

  const { data, error } = await sb()
    .from("cs_campaigns")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  throwIfError(error, "updateCampaign");
  return data as CsCampaign;
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

export async function listCampaignTargets(campaignId: string): Promise<CsCampaignTarget[]> {
  const { data, error } = await sb()
    .from("cs_campaign_targets")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at");
  throwIfError(error, "listCampaignTargets");
  return (data ?? []) as CsCampaignTarget[];
}

export async function setCampaignTargets(
  campaignId: string,
  targets: CampaignTargetInput[],
): Promise<CsCampaignTarget[]> {
  const { error: delErr } = await sb()
    .from("cs_campaign_targets")
    .delete()
    .eq("campaign_id", campaignId);
  throwIfError(delErr, "setCampaignTargets delete");

  if (targets.length === 0) return [];

  const rows = targets.map((t) => ({
    campaign_id: campaignId,
    vertical_id: t.verticalId ?? null,
    geo_id: t.geoId ?? null,
    intent: t.intent ?? null,
    clinic_ids: t.clinicIds ?? [],
    include: t.include ?? true,
    warnings: t.warnings ?? [],
  }));

  const { data, error } = await sb()
    .from("cs_campaign_targets")
    .insert(rows)
    .select("*");
  throwIfError(error, "setCampaignTargets insert");
  return (data ?? []) as CsCampaignTarget[];
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export async function listPages(params?: {
  campaignId?: string;
  status?: string;
}): Promise<CsPage[]> {
  let query = sb().from("cs_pages").select("*").order("updated_at", { ascending: false });
  if (params?.campaignId) query = query.eq("campaign_id", params.campaignId);
  if (params?.status) query = query.eq("status", params.status);
  const { data, error } = await query.limit(500);
  throwIfError(error, "listPages");
  return (data ?? []) as CsPage[];
}

export async function getPage(id: string): Promise<CsPage | null> {
  const { data, error } = await sb()
    .from("cs_pages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error, "getPage");
  return (data as CsPage) ?? null;
}

export async function updatePage(id: string, input: UpdatePageInput): Promise<CsPage> {
  const patch: Record<string, unknown> = {};
  if (input.publicTitle !== undefined) patch.public_title = input.publicTitle;
  if (input.internalTitle !== undefined) patch.internal_title = input.internalTitle;
  if (input.seoTitle !== undefined) patch.seo_title = input.seoTitle;
  if (input.seoDescription !== undefined) patch.seo_description = input.seoDescription;
  if (input.canonicalUrl !== undefined) patch.canonical_url = input.canonicalUrl;
  if (input.hero !== undefined) patch.hero = input.hero;
  if (input.ctaPrimary !== undefined) patch.cta_primary = input.ctaPrimary;
  if (input.ctaSecondary !== undefined) patch.cta_secondary = input.ctaSecondary;
  if (input.formConfig !== undefined) patch.form_config = input.formConfig;
  if (input.routingConfig !== undefined) patch.routing_config = input.routingConfig;
  if (input.indexingPolicy !== undefined) patch.indexing_policy = input.indexingPolicy;
  if (input.status !== undefined) patch.status = input.status;
  if (input.relatedArticleId !== undefined) patch.related_article_id = input.relatedArticleId;
  if (input.assessmentPlacement !== undefined) patch.assessment_placement = input.assessmentPlacement;
  if (input.assessmentStatus !== undefined) patch.assessment_status = input.assessmentStatus;

  const { data, error } = await sb()
    .from("cs_pages")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  throwIfError(error, "updatePage");
  return data as CsPage;
}

export async function storeQualityReport(
  pageId: string,
  result: { score: number; checks: unknown[]; blocking: boolean },
  overrideReason?: string,
): Promise<CsQualityReport> {
  const { data, error } = await sb()
    .from("cs_quality_reports")
    .insert({
      page_id: pageId,
      score: result.score,
      checks: result.checks,
      blocking: result.blocking,
      override_reason: overrideReason ?? null,
    })
    .select("*")
    .single();
  throwIfError(error, "storeQualityReport");

  await sb()
    .from("cs_pages")
    .update({ quality_score: result.score })
    .eq("id", pageId);

  return data as CsQualityReport;
}

export async function getLatestQualityReport(pageId: string): Promise<CsQualityReport | null> {
  const { data, error } = await sb()
    .from("cs_quality_reports")
    .select("*")
    .eq("page_id", pageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  throwIfError(error, "getLatestQualityReport");
  return (data as CsQualityReport) ?? null;
}

// ---------------------------------------------------------------------------
// Page actions
// ---------------------------------------------------------------------------

const ACTION_STATUS: Record<PageAction, PageStatus> = {
  submit_review: "needs_review",
  approve: "approved",
  request_changes: "changes_requested",
  publish: "published",
  pause: "paused",
  archive: "archived",
};

export async function applyPageAction(
  pageId: string,
  action: PageAction,
  options?: { overrideReason?: string; index?: boolean; adminId?: string },
): Promise<CsPage> {
  const page = await getPage(pageId);
  if (!page) throw new Error("Page not found.");

  if (action === "publish") {
    if (page.status !== "approved") {
      throw new Error("Page must be approved before publishing.");
    }
    const assessmentSlug =
      typeof page.form_config?.assessment_slug === "string"
        ? page.form_config.assessment_slug.trim()
        : "";
    const hasAssessment = Boolean(assessmentSlug || page.assessment_version_id);
    if (
      (page.page_type === "service_location" || page.page_type === "paid_conversion") &&
      !hasAssessment &&
      !options?.overrideReason?.trim()
    ) {
      throw new Error(
        "Embedded assessment is required before publishing. Attach an assessment or provide overrideReason.",
      );
    }
    const latestReport = await getLatestQualityReport(pageId);
    const blocking = latestReport?.blocking ?? false;
    if (blocking && !options?.overrideReason?.trim()) {
      throw new Error("Quality checks are blocking. Provide overrideReason to publish.");
    }

    const indexingPolicy =
      page.host === "ads"
        ? "index_follow"
        : options?.index
          ? "index_follow"
          : page.indexing_policy === "index_follow"
            ? "index_follow"
            : "noindex_follow";

    const { data, error } = await sb()
      .from("cs_pages")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        indexing_policy: indexingPolicy,
        override_reason: options?.overrideReason ?? page.override_reason,
      })
      .eq("id", pageId)
      .select("*")
      .single();
    throwIfError(error, "applyPageAction publish");
    const published = data as CsPage;
    await requestCampaignRevalidation({ paths: [published.path] }).catch((err) => {
      console.warn("[campaigns] revalidation failed:", err instanceof Error ? err.message : err);
    });
    return published;
  }

  const nextStatus = ACTION_STATUS[action];
  const patch: Record<string, unknown> = { status: nextStatus };
  if (options?.overrideReason) patch.override_reason = options.overrideReason;

  const { data, error } = await sb()
    .from("cs_pages")
    .update(patch)
    .eq("id", pageId)
    .select("*")
    .single();
  throwIfError(error, `applyPageAction ${action}`);
  return data as CsPage;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function isPaidTraffic(trafficType: TrafficType | null): boolean {
  return trafficType === "paid_search" || trafficType === "paid_social" || trafficType === "market_test";
}

async function resolveStateSlug(geo: CsGeoEntity): Promise<string> {
  if (geo.kind === "state") return geo.slug;
  if (geo.state_code) {
    const { data } = await sb()
      .from("cs_geo_entities")
      .select("slug")
      .eq("kind", "state")
      .eq("state_code", geo.state_code)
      .limit(1)
      .maybeSingle();
    if (data?.slug) return data.slug as string;
  }
  if (geo.parent_id) {
    const parent = await getGeoEntity(geo.parent_id);
    if (parent) return resolveStateSlug(parent);
  }
  return "unknown";
}

function buildDeterministicContent(
  verticalName: string,
  geoName: string,
  host: PageHost,
): {
  publicTitle: string;
  seoTitle: string;
  seoDescription: string;
  hero: Record<string, unknown>;
  ctaPrimary: string;
  blocks: unknown[];
} {
  const headline =
    host === "organic"
      ? `${verticalName} in ${geoName}`
      : `${verticalName} — ${geoName}`;

  const seoDescription = `Find ${verticalName} options in ${geoName}. Connect with qualified clinics and request a consultation.`.slice(
    0,
    160,
  );

  return {
    publicTitle: headline,
    seoTitle: `${headline} | Novalyte`,
    seoDescription,
    hero: {
      headline,
      subheadline: `${verticalName} care in ${geoName}`,
    },
    ctaPrimary: "Start the assessment",
    blocks: [
      {
        type: "faq",
        items: [
          {
            question: `What ${verticalName} services are available in ${geoName}?`,
            answer: `This page covers ${verticalName} options in ${geoName}. Complete the assessment below to share your goals and connect with a participating clinic.`,
          },
          {
            question: `How do I get started with ${verticalName} in ${geoName}?`,
            answer: `Complete the embedded assessment on this page. It is informational — final eligibility is determined by a licensed provider.`,
          },
        ],
      },
    ],
  };
}

async function resolveDefaultAssessmentTemplate(
  vertical: CsTreatmentVertical,
  paid: boolean,
): Promise<{ templateId: string; versionId: string } | null> {
  const preferredSlug =
    paid && vertical.default_assessment_slug
      ? vertical.default_assessment_slug.replace(/-full$/, "-short")
      : vertical.default_assessment_slug;

  const trySlugs = [
    preferredSlug,
    vertical.default_assessment_slug,
    paid ? "trt-short" : "trt-full",
  ].filter((s): s is string => Boolean(s));

  for (const slug of trySlugs) {
    const { data: template } = await sb()
      .from("cs_assessment_templates")
      .select("id")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    if (!template?.id) continue;

    const { data: version } = await sb()
      .from("cs_assessment_template_versions")
      .select("id")
      .eq("template_id", template.id)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (version?.id) {
      return { templateId: template.id as string, versionId: version.id as string };
    }
  }
  return null;
}

export async function generateCampaignPages(
  campaignId: string,
  adminId?: string,
): Promise<{ pages: CsPage[]; jobs: CsGenerationJob[] }> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found.");

  const targets = (await listCampaignTargets(campaignId)).filter((t) => t.include);
  if (targets.length === 0) throw new Error("No included targets to generate.");

  const paid = isPaidTraffic(campaign.traffic_type);
  const pageType = paid ? "paid_conversion" : "service_location";
  const templateVersion = await getTemplateVersionByPageType(pageType);
  if (!templateVersion) throw new Error(`No template version for page type ${pageType}.`);

  const pages: CsPage[] = [];
  const jobs: CsGenerationJob[] = [];

  for (const target of targets) {
    const verticalId = target.vertical_id ?? campaign.vertical_id;
    if (!verticalId || !target.geo_id) continue;

    const vertical = await getVertical(verticalId);
    const geo = await getGeoEntity(target.geo_id);
    if (!vertical || !geo) continue;

    const host: PageHost = paid ? "ads" : "organic";
    let path: string;
    let slug: string;
    let stateSlug: string | null = null;
    let citySlug: string | null = null;

    if (paid) {
      slug = buildAdsSlug(vertical.slug, geo.slug, target.intent);
      path = adsPath(slug);
    } else {
      stateSlug = await resolveStateSlug(geo);
      citySlug = geo.kind === "city" ? geo.slug : geo.slug;
      slug = citySlug;
      path = organicPath(vertical.slug, stateSlug, citySlug);
    }

    const content = buildDeterministicContent(vertical.name, geo.name, host);

    const { data: page, error: pageErr } = await sb()
      .from("cs_pages")
      .insert({
        campaign_id: campaignId,
        template_version_id: templateVersion.id,
        page_type: pageType,
        host,
        slug,
        path,
        service_slug: vertical.slug,
        state_slug: stateSlug,
        city_slug: citySlug,
        geo_id: geo.id,
        vertical_id: vertical.id,
        status: "needs_review",
        public_title: content.publicTitle,
        internal_title: content.publicTitle,
        seo_title: content.seoTitle,
        seo_description: content.seoDescription,
        hero: content.hero,
        cta_primary: content.ctaPrimary,
        cta_secondary: "Learn more",
      })
      .select("*")
      .single();

    if (pageErr) {
      if (/duplicate|unique/i.test(pageErr.message)) continue;
      throw new Error(`generateCampaignPages page: ${pageErr.message}`);
    }

    const createdPage = page as CsPage;
    pages.push(createdPage);

    await sb().from("cs_page_versions").insert({
      page_id: createdPage.id,
      version: 1,
      snapshot: createdPage,
      blocks: content.blocks,
      editor_admin_id: adminId ?? null,
      change_summary: "Initial generation from campaign target",
    });

    if (target.clinic_ids.length > 0) {
      await sb().from("cs_page_clinics").insert(
        target.clinic_ids.map((clinicId, i) => ({
          page_id: createdPage.id,
          clinic_id: clinicId,
          is_primary: i === 0,
        })),
      );
    }

    const now = new Date().toISOString();
    const { data: job, error: jobErr } = await sb()
      .from("cs_generation_jobs")
      .insert({
        campaign_id: campaignId,
        page_id: createdPage.id,
        status: "succeeded",
        payload: { targetId: target.id, pageType, deterministic: true },
        finished_at: now,
      })
      .select("*")
      .single();
    throwIfError(jobErr, "generateCampaignPages job");

    await sb().from("cs_generation_audit").insert({
      job_id: job.id,
      page_id: createdPage.id,
      model: "deterministic",
      prompt_version: "phase1-v1",
      sources: [{ type: "vertical", name: vertical.name }, { type: "geo", name: geo.name }],
    });

    // Every conversion LP must embed an assessment (same engine as /patients).
    const assessment = await resolveDefaultAssessmentTemplate(vertical, paid);
    if (assessment) {
      await bindPageAssessment(createdPage.id, {
        templateId: assessment.templateId,
        versionId: assessment.versionId,
        placement: paid ? ["below_hero", "sticky_mobile"] : ["below_hero", "near_clinics"],
        formConfig: {
          skip_known_geo: true,
          skip_known_treatment: true,
          prefill: {
            state: stateSlug,
            city: citySlug,
            geo_name: geo.name,
          },
        },
      }).catch((err) => {
        console.warn(
          "[campaigns] auto-bind assessment failed:",
          err instanceof Error ? err.message : err,
        );
      });
    }

    jobs.push(job as CsGenerationJob);
  }

  return { pages, jobs };
}

// ---------------------------------------------------------------------------
// Assessment templates
// ---------------------------------------------------------------------------

export async function listAssessmentTemplates(): Promise<
  (CsAssessmentTemplate & { latestVersion: CsAssessmentTemplateVersion | null })[]
> {
  try {
    const { data: templates, error: tErr } = await sb()
      .from("cs_assessment_templates")
      .select("*")
      .eq("active", true)
      .order("name");
    if (tErr) {
      if (/does not exist|relation/i.test(tErr.message)) return [];
      throwIfError(tErr, "listAssessmentTemplates");
    }

    const { data: versions, error: vErr } = await sb()
      .from("cs_assessment_template_versions")
      .select("*")
      .eq("status", "published")
      .order("version", { ascending: false });
    if (vErr) {
      if (/does not exist|relation/i.test(vErr.message)) {
        return ((templates ?? []) as CsAssessmentTemplate[]).map((t) => ({
          ...t,
          latestVersion: null,
        }));
      }
      throwIfError(vErr, "listAssessmentTemplateVersions");
    }

    const latestByTemplate = new Map<string, CsAssessmentTemplateVersion>();
    for (const v of (versions ?? []) as CsAssessmentTemplateVersion[]) {
      if (!latestByTemplate.has(v.template_id)) {
        latestByTemplate.set(v.template_id, v);
      }
    }

    return ((templates ?? []) as CsAssessmentTemplate[]).map((t) => ({
      ...t,
      latestVersion: latestByTemplate.get(t.id) ?? null,
    }));
  } catch (err) {
    if (err instanceof Error && /does not exist|relation/i.test(err.message)) return [];
    throw err;
  }
}

export async function getAssessmentTemplate(id: string): Promise<
  (CsAssessmentTemplate & { versions: CsAssessmentTemplateVersion[] }) | null
> {
  try {
    const { data: template, error: tErr } = await sb()
      .from("cs_assessment_templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (tErr) {
      if (/does not exist|relation/i.test(tErr.message)) return null;
      throwIfError(tErr, "getAssessmentTemplate");
    }
    if (!template) return null;

    const { data: versions, error: vErr } = await sb()
      .from("cs_assessment_template_versions")
      .select("*")
      .eq("template_id", id)
      .order("version", { ascending: false });
    if (vErr) {
      if (/does not exist|relation/i.test(vErr.message)) {
        return { ...(template as CsAssessmentTemplate), versions: [] };
      }
      throwIfError(vErr, "getAssessmentTemplateVersions");
    }

    return {
      ...(template as CsAssessmentTemplate),
      versions: (versions ?? []) as CsAssessmentTemplateVersion[],
    };
  } catch (err) {
    if (err instanceof Error && /does not exist|relation/i.test(err.message)) return null;
    throw err;
  }
}

export async function bindPageAssessment(
  pageId: string,
  input: {
    templateId: string;
    versionId: string;
    placement?: string[];
    formConfig?: Record<string, unknown>;
    assessmentStatus?: string;
  },
): Promise<CsPage> {
  const page = await getPage(pageId);
  if (!page) throw new Error("Page not found.");

  const template = await getAssessmentTemplate(input.templateId);
  if (!template) throw new Error("Assessment template not found.");

  const version = template.versions.find((v) => v.id === input.versionId);
  if (!version) throw new Error("Assessment version not found.");

  const placement = input.placement ?? ["below_hero"];
  const formConfig = {
    ...page.form_config,
    engine: "assessment",
    assessment_slug: template.assessment_engine_slug,
    template_id: template.id,
    version_id: version.id,
    placement,
    mode: template.mode,
    ...(input.formConfig ?? {}),
  };

  const patch: Record<string, unknown> = {
    form_config: formConfig,
    assessment_template_id: template.id,
    assessment_version_id: version.id,
    assessment_placement: placement,
    assessment_status: input.assessmentStatus ?? "ready",
  };

  const { data, error } = await sb()
    .from("cs_pages")
    .update(patch)
    .eq("id", pageId)
    .select("*")
    .single();
  throwIfError(error, "bindPageAssessment");

  try {
    await sb()
      .from("cs_page_assessment_bindings")
      .upsert(
        {
          page_id: pageId,
          template_id: template.id,
          version_id: version.id,
          placement,
        },
        { onConflict: "page_id" },
      );
  } catch {
    /* bindings table may not exist yet */
  }

  return data as CsPage;
}
