import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  classifyBot,
  classifyTestSubmission,
  shortVisitorLabel,
} from "@/lib/analytics/classification";

function safeString(value: unknown, max = 500): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, max) : null;
}

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
  "page_view", // suppressed duplicate of $pageview
  "page_viewed",
  "novalyte_page_context",
]);

const SERVER_FORM_EVENTS = new Set([
  "contact_submitted",
  "assessment_submitted",
  "campaign_assessment_completed",
  "newsletter_subscribed",
  "newsletter_signup",
  "investor_access_request",
  "investor_meeting_request",
  "consultation_requested",
  "marketplace_quote_requested",
]);

const EVENT_LABELS: Record<string, string> = {
  $pageview: "Viewed page",
  session_started: "Started session",
  scroll_depth_reached: "Scroll depth reached",
  contact_form_submitted: "Submitted contact form",
  assessment_completed: "Completed assessment",
  assessment_submitted: "Completed assessment",
  primary_cta_clicked: "Clicked primary CTA",
  outbound_link_clicked: "Outbound link",
  campaign_landing_viewed: "Campaign landing",
};

function labelForEvent(event: string): string {
  if (EVENT_LABELS[event]) return EVENT_LABELS[event];
  return event
    .replace(/^\$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickUtm(properties: Record<string, unknown>, key: string): string | null {
  return (
    safeString(properties[key], 120) ||
    safeString(properties[`$${key}`], 120) ||
    safeString(properties[key.replace("utm_", "")], 120)
  );
}

type RawEvent = {
  id: string;
  event: string;
  label: string;
  timestamp: string;
  distinctId: string;
  visitorLabel: string;
  sessionId: string | null;
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
  replayUrl: string | null;
  isInternal: boolean;
  isTest: boolean;
  isBot: boolean;
  isDuplicate: boolean;
  trafficClassification: string;
  identityClassification: string;
  sourceSystem: "posthog" | "supabase";
  formType?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  organization?: string | null;
  conversionClassification?: string | null;
};

type VisitorRow = {
  visitorKey: string;
  visitorLabel: string;
  identityClassification: string;
  trafficClassification: string;
  isInternal: boolean;
  isTest: boolean;
  isBot: boolean;
  contactName: string | null;
  contactEmail: string | null;
  organization: string | null;
  firstSeen: string;
  lastSeen: string;
  sessionCount: number;
  eventCount: number;
  pageViewCount: number;
  lastPage: string | null;
  firstTouchSource: string | null;
  latestTouchSource: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  converted: boolean;
  conversionCount: number;
  sessions: Array<{
    sessionId: string;
    startedAt: string;
    endedAt: string;
    eventCount: number;
    pages: string[];
    events: RawEvent[];
    replayUrl: string | null;
  }>;
};

function eventDedupeKey(e: {
  event: string;
  distinctId: string;
  sessionId: string | null;
  page: string | null;
  timestamp: string;
  sourceEventId?: string | null;
}): string {
  if (e.sourceEventId) return `id:${e.sourceEventId}`;
  const bucket = e.timestamp.slice(0, 19); // second precision
  return `${e.distinctId}|${e.sessionId || ""}|${e.event}|${e.page || ""}|${bucket}`;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminRole(["admin", "operations", "sales", "founder"]);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const environment = request.nextUrl.searchParams.get("environment") || "production";
  const traffic = request.nextUrl.searchParams.get("traffic") || "external"; // external | internal | test | all
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const uiHost = (process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com").replace(/\/$/, "");
  const posthogConfigured = Boolean(projectId && personalApiKey);

  let activityEvents: RawEvent[] = [];
  let posthogError: string | null = null;

  if (posthogConfigured && projectId && personalApiKey) {
    try {
      const response = await fetch(
        `${uiHost}/api/projects/${projectId}/events/?limit=250&orderBy=-timestamp`,
        {
          headers: { Authorization: `Bearer ${personalApiKey}` },
          next: { revalidate: 0 },
        },
      );
      if (!response.ok) {
        posthogError = `PostHog returned ${response.status}.`;
      } else {
        const payload = (await response.json()) as { results?: Array<Record<string, unknown>> };
        const seen = new Set<string>();

        activityEvents = (payload.results ?? [])
          .map((event) => {
            const properties =
              event.properties && typeof event.properties === "object"
                ? (event.properties as Record<string, unknown>)
                : {};
            const name = safeString(event.event) ?? "unknown_event";
            const distinctId =
              safeString(event.distinct_id, 200) ||
              safeString(properties.distinct_id, 200) ||
              "unknown";
            return { event, properties, name, distinctId };
          })
          .filter(({ name, properties }) => {
            if (NOISE_EVENTS.has(name)) return false;
            if (SERVER_FORM_EVENTS.has(name)) return false; // conversions come from Supabase
            if (environment === "all") return true;
            return environment === "development"
              ? isDevelopmentEvent(properties)
              : isProductionEvent(properties);
          })
          .map(({ event, properties, name, distinctId }) => {
            const referrer = sanitizePageUrl(properties.$referrer);
            const referringDomain =
              safeString(properties.$referring_domain, 120) ||
              safeString(properties.referrer_domain, 120) ||
              (referrer
                ? (() => {
                    try {
                      return new URL(referrer).hostname;
                    } catch {
                      return null;
                    }
                  })()
                : null);
            const isInternal =
              properties.is_internal === true ||
              properties.is_internal === "true" ||
              properties.traffic_classification === "internal";
            const isTest =
              properties.is_test === true ||
              properties.is_test === "true" ||
              properties.traffic_classification === "test";
            const isBot =
              properties.is_bot === true ||
              properties.is_bot === "true" ||
              classifyBot(safeString(properties.$raw_user_agent) || safeString(properties.$user_agent));
            const sessionId = safeString(properties.$session_id, 120);
            const page =
              sanitizePageUrl(properties.$current_url) ||
              sanitizePageUrl(properties.source_page) ||
              safeString(properties.$pathname);
            const sourceEventId = safeString(event.uuid) || safeString(event.id);
            const timestamp = safeString(event.timestamp) ?? new Date().toISOString();
            const dedupe = eventDedupeKey({
              event: name,
              distinctId,
              sessionId,
              page,
              timestamp,
              sourceEventId,
            });
            const isDuplicate = seen.has(dedupe);
            if (!isDuplicate) seen.add(dedupe);

            const identified =
              Boolean(properties.$user_id) ||
              Boolean(properties.$identified) ||
              Boolean(properties.email);
            const contactName = safeString(properties.name, 80);
            const visitorLabel = identified
              ? contactName || safeString(properties.email, 80) || "Identified visitor"
              : isInternal
                ? safeString(properties.internal_device_id, 12)
                  ? `Internal · ${String(properties.internal_device_id).slice(0, 8)}`
                  : "Internal visitor"
                : shortVisitorLabel(distinctId);

            return {
              id: sourceEventId ?? `${timestamp}-${name}-${distinctId}`,
              event: name,
              label: labelForEvent(name),
              timestamp,
              distinctId,
              visitorLabel,
              sessionId,
              page,
              referrer: referrer || sanitizePageUrl(properties.referrer),
              referringDomain,
              utmSource: pickUtm(properties, "utm_source"),
              utmMedium: pickUtm(properties, "utm_medium"),
              utmCampaign: pickUtm(properties, "utm_campaign"),
              device:
                safeString(properties.$device_type, 80) || safeString(properties.device_type, 80),
              browser: safeString(properties.$browser, 80),
              os: safeString(properties.$os, 80),
              city: safeString(properties.$geoip_city_name, 80),
              region: safeString(properties.$geoip_subdivision_1_name, 80),
              country: safeString(properties.$geoip_country_name, 80),
              replayUrl: sessionId
                ? `${uiHost}/project/${projectId}/replay/${encodeURIComponent(sessionId)}?t=0`
                : null,
              isInternal,
              isTest,
              isBot,
              isDuplicate,
              trafficClassification: isTest
                ? "test"
                : isInternal
                  ? "internal"
                  : isBot
                    ? "bot"
                    : "external",
              identityClassification: isInternal
                ? "internal_personnel"
                : isTest
                  ? "test_identity"
                  : identified
                    ? "identified"
                    : "anonymous",
              sourceSystem: "posthog" as const,
              contactName,
              contactEmail: safeString(properties.email, 120),
            } satisfies RawEvent;
          })
          .filter((e) => !e.isDuplicate);
      }
    } catch (error) {
      posthogError = error instanceof Error ? error.message : "Live activity unavailable.";
    }
  }

  let conversionEvents: RawEvent[] = [];
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("form_submissions")
      .select(
        "id, form_type, submitted_at, contact_name, contact_email, organization, source_page, referrer, referrer_domain, utm_source, utm_medium, utm_campaign, device_type, browser, os, geo_city, geo_region, geo_country, landing_path, landing_at, anonymous_id, is_test, traffic_classification, conversion_classification, environment, safe_metadata",
      )
      .order("submitted_at", { ascending: false })
      .limit(80);

    conversionEvents = (data ?? [])
      .filter((row) => {
        if (environment === "all") return true;
        const env = safeString(row.environment) || "production";
        return environment === "development"
          ? env === "development" || env === "test"
          : env === "production" || !row.environment;
      })
      .map((row) => {
        const formType = safeString(row.form_type, 80) ?? "form";
        const meta =
          row.safe_metadata && typeof row.safe_metadata === "object"
            ? (row.safe_metadata as Record<string, unknown>)
            : {};
        const isTest =
          row.is_test === true ||
          classifyTestSubmission({
            contactName: safeString(row.contact_name),
            contactEmail: safeString(row.contact_email),
            utmSource: safeString(row.utm_source),
            utmMedium: safeString(row.utm_medium),
            utmCampaign: safeString(row.utm_campaign),
            metadata: meta,
            environment: safeString(row.environment),
          });
        const isInternal = row.traffic_classification === "internal";
        const distinctId =
          safeString(row.anonymous_id, 200) ||
          safeString(row.contact_email, 200) ||
          `conversion-${row.id}`;
        const contactName = safeString(row.contact_name, 80);
        const contactEmail = safeString(row.contact_email, 120);
        const visitorLabel = isTest
          ? `Test · ${contactName || contactEmail || "submission"}`
          : isInternal
            ? `Internal · ${contactName || "team"}`
            : contactName || contactEmail || shortVisitorLabel(distinctId);

        return {
          id: `conversion-${row.id}`,
          event: formType,
          label: `Conversion · ${formType.replace(/_/g, " ")}`,
          timestamp: safeString(row.submitted_at) ?? new Date().toISOString(),
          distinctId,
          visitorLabel,
          sessionId: null,
          page:
            sanitizePageUrl(row.source_page) ||
            sanitizePageUrl(row.landing_path) ||
            sanitizePageUrl(meta.landing_path),
          referrer: sanitizePageUrl(row.referrer) || safeString(row.referrer_domain, 120),
          referringDomain: safeString(row.referrer_domain, 120),
          utmSource: safeString(row.utm_source, 120),
          utmMedium: safeString(row.utm_medium, 120),
          utmCampaign: safeString(row.utm_campaign, 120),
          device: safeString(row.device_type, 80),
          browser: safeString(row.browser, 80),
          os: safeString(row.os, 80),
          city: safeString(row.geo_city, 80),
          region: safeString(row.geo_region, 80),
          country: safeString(row.geo_country, 80),
          replayUrl: null,
          isInternal,
          isTest,
          isBot: false,
          isDuplicate: false,
          trafficClassification:
            safeString(row.traffic_classification, 40) ||
            (isTest ? "test" : isInternal ? "internal" : "external"),
          identityClassification: isTest
            ? "test_identity"
            : isInternal
              ? "internal_personnel"
              : contactEmail || contactName
                ? "identified"
                : "anonymous",
          sourceSystem: "supabase" as const,
          formType,
          contactName,
          contactEmail,
          organization: safeString(row.organization, 120),
          conversionClassification:
            safeString(row.conversion_classification, 40) ||
            (isTest ? "test" : isInternal ? "internal" : "real"),
        } satisfies RawEvent;
      });
  } catch {
    // conversions optional
  }

  const allEvents = [...conversionEvents, ...activityEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const filtered = allEvents.filter((e) => {
    if (traffic === "all") return true;
    if (traffic === "internal") return e.isInternal && !e.isTest;
    if (traffic === "test") return e.isTest;
    // external default
    return !e.isInternal && !e.isTest && !e.isBot;
  });

  const visitorMap = new Map<string, VisitorRow>();
  for (const event of filtered) {
    const key = event.distinctId;
    let visitor = visitorMap.get(key);
    if (!visitor) {
      visitor = {
        visitorKey: key,
        visitorLabel: event.visitorLabel,
        identityClassification: event.identityClassification,
        trafficClassification: event.trafficClassification,
        isInternal: event.isInternal,
        isTest: event.isTest,
        isBot: event.isBot,
        contactName: event.contactName ?? null,
        contactEmail: event.contactEmail ?? null,
        organization: event.organization ?? null,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        sessionCount: 0,
        eventCount: 0,
        pageViewCount: 0,
        lastPage: event.page,
        firstTouchSource: event.utmSource || event.referringDomain,
        latestTouchSource: event.utmSource || event.referringDomain,
        device: event.device,
        browser: event.browser,
        os: event.os,
        city: event.city,
        region: event.region,
        country: event.country,
        converted: false,
        conversionCount: 0,
        sessions: [],
      };
      visitorMap.set(key, visitor);
    }
    visitor.eventCount += 1;
    if (event.event === "$pageview") visitor.pageViewCount += 1;
    if (event.sourceSystem === "supabase") {
      visitor.converted = true;
      visitor.conversionCount += 1;
      if (event.contactName) visitor.contactName = event.contactName;
      if (event.contactEmail) visitor.contactEmail = event.contactEmail;
      if (event.organization) visitor.organization = event.organization;
      if (event.identityClassification === "identified") {
        visitor.identityClassification = "identified";
        visitor.visitorLabel = event.visitorLabel;
      }
    }
    if (new Date(event.timestamp) < new Date(visitor.firstSeen)) {
      visitor.firstSeen = event.timestamp;
      visitor.firstTouchSource = event.utmSource || event.referringDomain || visitor.firstTouchSource;
    }
    if (new Date(event.timestamp) > new Date(visitor.lastSeen)) {
      visitor.lastSeen = event.timestamp;
      visitor.lastPage = event.page || visitor.lastPage;
      visitor.latestTouchSource = event.utmSource || event.referringDomain || visitor.latestTouchSource;
      visitor.device = event.device || visitor.device;
      visitor.browser = event.browser || visitor.browser;
      visitor.os = event.os || visitor.os;
      visitor.city = event.city || visitor.city;
      visitor.region = event.region || visitor.region;
      visitor.country = event.country || visitor.country;
    }

    const sessionKey = event.sessionId || `nosession-${event.timestamp.slice(0, 13)}-${key}`;
    let session = visitor.sessions.find((s) => s.sessionId === sessionKey);
    if (!session) {
      session = {
        sessionId: sessionKey,
        startedAt: event.timestamp,
        endedAt: event.timestamp,
        eventCount: 0,
        pages: [],
        events: [],
        replayUrl: event.replayUrl,
      };
      visitor.sessions.push(session);
    }
    session.eventCount += 1;
    session.events.push(event);
    if (event.page && !session.pages.includes(event.page)) session.pages.push(event.page);
    if (new Date(event.timestamp) < new Date(session.startedAt)) session.startedAt = event.timestamp;
    if (new Date(event.timestamp) > new Date(session.endedAt)) session.endedAt = event.timestamp;
    if (event.replayUrl) session.replayUrl = event.replayUrl;
  }

  const visitors = [...visitorMap.values()]
    .map((v) => {
      v.sessions.sort(
        (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
      );
      for (const s of v.sessions) {
        s.events.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
      }
      v.sessionCount = v.sessions.length;
      return v;
    })
    .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
    .slice(0, 75);

  const externalVisitors = visitors.filter((v) => !v.isInternal && !v.isTest && !v.isBot);
  const metrics = {
    uniqueExternalVisitors: externalVisitors.length,
    externalSessions: externalVisitors.reduce((n, v) => n + v.sessionCount, 0),
    pageViews: externalVisitors.reduce((n, v) => n + v.pageViewCount, 0),
    realConversions: conversionEvents.filter(
      (c) => !c.isTest && !c.isInternal && c.conversionClassification === "real",
    ).length,
    identifiedVisitors: externalVisitors.filter((v) => v.identityClassification === "identified")
      .length,
    returningVisitors: externalVisitors.filter((v) => v.sessionCount > 1).length,
    internalSessionsExcluded: allEvents.filter((e) => e.isInternal && !e.isTest).length,
    testConversionsExcluded: conversionEvents.filter((c) => c.isTest).length,
    duplicateEventsExcluded: activityEvents.length, // already filtered; reported via posthog raw if needed
  };

  // Approximate duplicate count from pre-filter if we tracked — keep opaque 0 when unknown
  const activeWindowMs = 15 * 60 * 1000;
  const now = Date.now();
  const activeVisitors = visitors.filter(
    (v) => now - new Date(v.lastSeen).getTime() <= activeWindowMs,
  );

  return NextResponse.json({
    configured: posthogConfigured || conversionEvents.length > 0,
    posthogConfigured,
    refreshedAt: new Date().toISOString(),
    filterSummary:
      traffic === "external"
        ? "Showing external production activity. Internal, test, bot, and duplicate activity excluded."
        : traffic === "internal"
          ? "Showing internal Novalyte device activity only."
          : traffic === "test"
            ? "Showing test and QA activity only."
            : "Showing all traffic classifications.",
    locationDisclaimer:
      "Approximate location based on network information. Nearby Bay Area cities (e.g. Hayward vs San Francisco) do not prove different people.",
    metrics,
    visitors,
    activeVisitors,
    events: filtered.slice(0, 100),
    conversionsCount: metrics.realConversions,
    activityCount: filtered.filter((e) => e.sourceSystem === "posthog").length,
    error: posthogError,
  });
}
