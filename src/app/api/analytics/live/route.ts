import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.length <= 500 ? value : null;
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
  if (url.startsWith("https://novalyte.io")) return true;
  const host = typeof properties.$host === "string" ? properties.$host : "";
  if (host === "novalyte.io") return true;
  return (
    properties.environment === "production" && properties.capture_source === "server"
  );
}

function isDevelopmentEvent(properties: Record<string, unknown>): boolean {
  const url = typeof properties.$current_url === "string" ? properties.$current_url : "";
  if (/^(https?:\/\/localhost|https?:\/\/127\.0\.0\.1)/.test(url)) return true;
  return (
    properties.environment === "development" && properties.capture_source === "server"
  );
}

export async function GET(request: NextRequest) {
  if (!(await requireAdminRole(["admin"]))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  const host = (process.env.POSTHOG_API_HOST || "https://us.posthog.com").replace(/\/$/, "");
  if (!apiKey || !projectId) {
    return NextResponse.json({ configured: false, events: [], message: "Configure POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID for live activity." });
  }

  try {
    const response = await fetch(`${host}/api/projects/${encodeURIComponent(projectId)}/events/?limit=100`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return NextResponse.json({ configured: true, events: [], error: `PostHog returned ${response.status}.` }, { status: 502 });
    const payload = await response.json() as { results?: Array<Record<string, unknown>> };
    const environment = request.nextUrl.searchParams.get("environment") ?? "production";
    const events = (payload.results ?? []).filter((event) => {
      if (environment === "all") return true;
      const properties = (event.properties && typeof event.properties === "object") ? event.properties as Record<string, unknown> : {};
      return environment === "development"
        ? isDevelopmentEvent(properties)
        : isProductionEvent(properties);
    }).map((event) => {
      const properties = (event.properties && typeof event.properties === "object") ? event.properties as Record<string, unknown> : {};
      return {
        id: safeString(event.id) ?? `${event.timestamp ?? "event"}-${event.event ?? "unknown"}`,
        event: safeString(event.event) ?? "unknown_event",
        timestamp: safeString(event.timestamp) ?? new Date().toISOString(),
        distinctId: properties.$user_id || properties.$identified ? "Identified user" : "Anonymous visitor",
        page: sanitizePageUrl(properties.$current_url) ?? safeString(properties.$pathname),
        referrer: sanitizePageUrl(properties.$referrer),
        device: safeString(properties.$device_type),
        browser: safeString(properties.$browser),
        os: safeString(properties.$os),
        city: safeString(properties.$geoip_city_name),
        region: safeString(properties.$geoip_subdivision_1_name),
        country: safeString(properties.$geoip_country_name),
      };
    });
    return NextResponse.json({ configured: true, refreshedAt: new Date().toISOString(), events });
  } catch (error) {
    return NextResponse.json({ configured: true, events: [], error: error instanceof Error ? error.message : "Live activity unavailable." }, { status: 502 });
  }
}
