import type { CsPage, QualityCheck } from "./types";

const MIN_SEO_DESCRIPTION = 50;
const MAX_SEO_DESCRIPTION = 160;

export interface QualityResult {
  score: number;
  checks: QualityCheck[];
  blocking: boolean;
}

function check(
  id: string,
  label: string,
  passed: boolean,
  blocking: boolean,
  message?: string,
): QualityCheck {
  return { id, label, passed, blocking, message };
}

export function runQualityChecks(page: CsPage): QualityResult {
  const checks: QualityCheck[] = [];

  checks.push(
    check(
      "public_title",
      "Public title present",
      Boolean(page.public_title?.trim()),
      true,
      "Page needs a public title.",
    ),
  );

  checks.push(
    check(
      "seo_title",
      "SEO title present",
      Boolean(page.seo_title?.trim()),
      false,
      "SEO title is recommended.",
    ),
  );

  const descLen = page.seo_description?.trim().length ?? 0;
  checks.push(
    check(
      "seo_description",
      "SEO description length",
      descLen >= MIN_SEO_DESCRIPTION && descLen <= MAX_SEO_DESCRIPTION,
      true,
      `SEO description should be ${MIN_SEO_DESCRIPTION}-${MAX_SEO_DESCRIPTION} characters (currently ${descLen}).`,
    ),
  );

  checks.push(
    check(
      "path",
      "Valid path",
      Boolean(page.path?.startsWith("/")),
      true,
      "Page path must start with /.",
    ),
  );

  const heroHeadline =
    typeof page.hero?.headline === "string" ? page.hero.headline.trim() : "";
  checks.push(
    check(
      "hero_headline",
      "Hero headline present",
      heroHeadline.length > 0,
      true,
      "Hero block needs a headline.",
    ),
  );

  checks.push(
    check(
      "cta_primary",
      "Primary CTA present",
      Boolean(page.cta_primary?.trim()),
      true,
      "Primary CTA is required.",
    ),
  );

  checks.push(
    check(
      "template",
      "Template assigned",
      Boolean(page.template_version_id),
      true,
      "Page must reference a template version.",
    ),
  );

  checks.push(
    check(
      "geo_vertical",
      "Geo and vertical assigned",
      Boolean(page.geo_id && page.vertical_id),
      false,
      "Both geo and vertical should be set for targeting.",
    ),
  );

  const assessmentSlug =
    typeof page.form_config?.assessment_slug === "string"
      ? page.form_config.assessment_slug.trim()
      : "";
  const hasAssessment = Boolean(assessmentSlug || page.assessment_version_id);
  const pageTypeRequiresAssessment =
    page.page_type === "service_location" || page.page_type === "paid_conversion";
  const engineRequiresAssessment = page.form_config?.engine === "assessment";
  const statusRequiresAssessment =
    page.assessment_status && page.assessment_status !== "unconfigured";
  const requiresAssessment =
    pageTypeRequiresAssessment || engineRequiresAssessment || statusRequiresAssessment;

  checks.push(
    check(
      "assessment",
      "Embedded assessment configured",
      !requiresAssessment || hasAssessment,
      requiresAssessment,
      "Landing pages must embed AssessmentExperience — set assessment_slug in form_config or bind an assessment template.",
    ),
  );

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const blocking = checks.some((c) => c.blocking && !c.passed);

  return { score, checks, blocking };
}
