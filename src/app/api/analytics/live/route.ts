import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function safeString(value: unknown, max = 500): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, max) : null;
}

/** Strip query/hash so preview tokens and PII in URLs never reach the admin UI. */
function sanitizePageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const parsed = new URL(value);
      return `${parsed.origin}${parsed.pathname}`.slice(0, 500);
    }
    return value.split("?")[0]?.split("#")[0]?.slice(0, 500) || null;
  } catch {
    return value.split("?")[0]?.split("#")[0]?.slice(0, 500) || null;
  }
}

function isProductionEvent(properties: Record<string, unknown>): boolean {
  const url = typeof properties.$current_url === "string" ? properties.$current_url : "";
  if (/^https:\/\/(www\.|ads\.|investor\.|portal\.)?novalyte\.io(?:\/|$)/.test(url)) return true;
  const host = typeof properties.$host === "string" ? properties.$host : "";
  if (
    ["novalyte.io", "www.novalyte.io", "ads.novalyte.io", "investor.novalyte.io", "portal.novalyte.io"].includes(
      host,
    )
  ) {
    return true;
  }
  return properties.environment === "production" && properties.capture_source === "server";
}

function isDevelopmentEvent(properties: Record<string, unknown>): boolean {
  const url = typeof properties.$current_url === "string" ? properties.$current_url : "";
  if (/^(https?:\/\/localhost|https?:\/\/127\.0\.0\.1)/.test(url)) return true;
  return properties.environment === "development" && properties.capture_source === "server";
}

const NOISE_EVENTS = new Set([
  "$web_vitals",
  "$opt_in",
  "$opt_out",
  "$pageleave",
  "$set",
  "$set_once",
  "$unset",
  "$identify",
  "$create_alias",
  "$groupidentify",
  "$feature_flag_called",
  "$feature_view",
  "$autocapture",
  "$rageclick",
  "$dead_click",
  "$heatmap",
  "$exception",
  "$ai_generation",
  "$ai_span",
  "$ai_trace",
]);

const EVENT_LABELS: Record<string, string> = {
  $pageview: "Viewed page",
  page_view: "Viewed page",
  page_viewed: "Viewed page",
  session_started: "Started session",
  get_started_form_submitted: "Submitted Get Started",
  contact_form_submitted: "Submitted contact form",
  form_submitted: "Submitted form",
  form_submission_error: "Form submission error",
  form_validation_error: "Form validation error",
  assessment_started: "Started assessment",
  assessment_completed: "Completed assessment",
  assessment_step_completed: "Assessment step",
  clinic_application_submitted: "Clinic application",
  clinic_onboarding_submitted: "Clinic onboarding",
  professional_onboarding_submitted: "Professional onboarding",
  vendor_onboarding_submitted: "Vendor onboarding",
  newsletter_subscribed: "Newsletter signup",
  newsletter_signup: "Newsletter signup",
  marketplace_product_viewed: "Viewed marketplace product",
  marketplace_add_to_cart: "Added to cart",
  marketplace_checkout_started: "Started checkout",
  marketplace_quote_requested: "Requested quote",
  consultation_requested: "Requested consultation",
  investor_access_requested: "Investor access request",
  investor_access_request: "Investor access request",
  investor_meeting_requested: "Investor meeting request",
  investor_meeting_request: "Investor meeting request",
  primary_cta_clicked: "Clicked primary CTA",
  directory_search: "Directory search",
  directory_search_submitted: "Directory search",
  booking_clicked: "Booking click",
  booking_link_clicked: "Booking click",
  assessment_submitted: "Completed assessment",
  clinic_profile_viewed: "Viewed clinic profile",
  campaign_lead: "Campaign lead",
};

function labelForEvent(event: string): string {
  if (EVENT_LABELS[event]) return EVENT_LABELS[event];
  return event
    .replace(/^\$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isNoiseEvent(event: string): boolean {
  if (NOISE_EVENTS.has(event)) return true;
  if (event.startsWith("$$")) return true;
  return false;
}

function pickUtm(properties: Record<string, unknown>, key: string): string | null {
  return (
    safeString(properties[key], 120) ||
    safeString(properties[`$${key}`], 120) ||
    safeString(properties[key.replace("utm_", "")], 120)
  );
}

type LiveEvent = {
  id: string;
  kind: "activity" | "conversion";
  event: string;
  label: string;
  timestamp: string;
  distinctId: string;
  page: string | null;
  referrer: string | null;
  referringDomain: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  sessionId?: string | null;
  replayUrl?: string | null;
  formType?: string | null;
  contactName?: string | null;
  organization?: string | null;
};

export async function GET(request: NextRequest) {
  if (!(await requireAdminRole(["admin"]))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  const host = (process.env.POSTHOG_API_HOST || "https://us.posthog.com").replace(/\/$/, "");
  const uiHost = (process.env.POSTHOG_UI_HOST || process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || host)
    .replace(/\/$/, "")
    .replace("i.posthog.com", "posthog.com");
  const environment = request.nextUrl.searchParams.get("environment") ?? "production";

  let activityEvents: LiveEvent[] = [];
  let posthogConfigured = Boolean(apiKey && projectId);
  let posthogError: string | null = null;

  if (apiKey && projectId) {
    try {
      const response = await fetch(
        `${host}/api/projects/${encodeURIComponent(projectId)}/events/?limit=200`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!response.ok) {
        posthogError = `PostHog returned ${response.status}.`;
      } else {
        const payload = (await response.json()) as { results?: Array<Record<string, unknown>> };
        activityEvents = (payload.results ?? [])
          .map((event) => {
            const properties =
              event.properties && typeof event.properties === "object"
                ? (event.properties as Record<string, unknown>)
                : {};
            const name = safeString(event.event) ?? "unknown_event";
            return { event, properties, name };
          })
          .filter(({ name, properties }) => {
            if (isNoiseEvent(name)) return false;
            if (environment === "all") return true;
            return environment === "development"
              ? isDevelopmentEvent(properties)
              : isProductionEvent(properties);
          })
          .slice(0, 80)
          .map(({ event, properties, name }) => {
            const referrer = sanitizePageUrl(properties.$referrer);
            const referringDomain =
              safeString(properties.$referring_domain, 120) ||
              (referrer
                ? (() => {
                    try {
                      return new URL(referrer).hostname;
                    } catch {
                      return null;
                    }
                  })()
                : null);

            return {
              id: safeString(event.id) ?? `${event.timestamp ?? "event"}-${name}`,
              kind: "activity" as const,
              event: name,
              label: labelForEvent(name),
              timestamp: safeString(event.timestamp) ?? new Date().toISOString(),
              distinctId:
                properties.$user_id || properties.$identified ? "Identified visitor" : "Anonymous visitor",
              page: sanitizePageUrl(properties.$current_url) ?? safeString(properties.$pathname),
              referrer,
              referringDomain,
              utmSource: pickUtm(properties, "utm_source"),
              utmMedium: pickUtm(properties, "utm_medium"),
              utmCampaign: pickUtm(properties, "utm_campaign"),
              device: safeString(properties.$device_type, 80),
              browser: safeString(properties.$browser, 80),
              os: safeString(properties.$os, 80),
              city: safeString(properties.$geoip_city_name, 80),
              region: safeString(properties.$geoip_subdivision_1_name, 80),
              country: safeString(properties.$geoip_country_name, 80),
              sessionId: safeString(properties.$session_id, 120),
              replayUrl: safeString(properties.$session_id, 120)
                ? `${uiHost}/project/${projectId}/replay/${encodeURIComponent(String(properties.$session_id))}?t=0`
                : null,
            };
          });
      }
    } catch (error) {
      posthogError = error instanceof Error ? error.message : "Live activity unavailable.";
    }
  }

  let conversions: LiveEvent[] = [];
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("form_submissions")
      .select(
        "id, form_type, submitted_at, contact_name, organization, source_page, referrer, utm_source, utm_medium, utm_campaign, notification_status",
      )
      .order("submitted_at", { ascending: false })
      .limit(40);

    conversions = (data ?? []).map((row) => {
      const formType = safeString(row.form_type, 80) ?? "form";
      return {
        id: `conversion-${row.id}`,
        kind: "conversion" as const,
        event: formType,
        label: `Conversion · ${formType.replace(/_/g, " ")}`,
        timestamp: safeString(row.submitted_at) ?? new Date().toISOString(),
        distinctId: safeString(row.contact_name, 80) || "Form submitter",
        page: sanitizePageUrl(row.source_page),
        referrer: sanitizePageUrl(row.referrer),
        referringDomain: row.referrer
          ? (() => {
              try {
                return new URL(String(row.referrer)).hostname;
              } catch {
                return safeString(row.referrer, 120);
              }
            })()
          : null,
        utmSource: safeString(row.utm_source, 120),
        utmMedium: safeString(row.utm_medium, 120),
        utmCampaign: safeString(row.utm_campaign, 120),
        device: null,
        browser: null,
        os: null,
        city: null,
        region: null,
        country: null,
        formType,
        contactName: safeString(row.contact_name, 80),
        organization: safeString(row.organization, 120),
      };
    });
  } catch {
    // Conversions are additive; PostHog feed can still render.
  }

  const events = [...conversions, ...activityEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 100);

  return NextResponse.json({
    configured: posthogConfigured || conversions.length > 0,
    posthogConfigured,
    refreshedAt: new Date().toISOString(),
    events,
    conversionsCount: conversions.length,
    activityCount: activityEvents.length,
    error: posthogError,
    message: posthogConfigured
      ? undefined
      : "PostHog credentials missing — showing form conversions only when available.",
  });
}
