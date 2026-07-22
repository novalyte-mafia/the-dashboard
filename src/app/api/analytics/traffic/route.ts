import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/auth";

type HogQlResponse = {
  columns?: string[];
  results?: unknown[][];
};

const RANGE_DAYS = new Set([7, 14, 30, 90]);

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;
}

export async function GET(request: NextRequest) {
  // Founder bypasses via hasRole; restrict analytics to admin+founder.
  if (!(await requireAdminRole(["admin"]))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  const host = (process.env.POSTHOG_API_HOST || "https://us.posthog.com").replace(/\/$/, "");
  const requestedDays = Number(request.nextUrl.searchParams.get("days") || 30);
  const days = RANGE_DAYS.has(requestedDays) ? requestedDays : 30;

  if (!apiKey || !projectId) {
    return NextResponse.json({
      configured: false,
      source: "PostHog",
      days,
      message: "Configure POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID.",
    });
  }

  const posthogApiKey = apiKey;
  const posthogProjectId = projectId;
  // Client events carry $host/$current_url; server conversions carry environment=production.
  const productionFilter = `(
    properties.$host IN ('novalyte.io', 'www.novalyte.io', 'ads.novalyte.io', 'investor.novalyte.io', 'portal.novalyte.io')
    OR match(toString(properties.$current_url), '^https://(www\\\\.|ads\\\\.|investor\\\\.|portal\\\\.)?novalyte\\\\.io')
    OR (
      toString(properties.environment) = 'production'
      AND toString(properties.capture_source) = 'server'
    )
  )`;
  const since = `timestamp >= now() - INTERVAL ${days} DAY`;

  async function query(hogql: string): Promise<HogQlResponse> {
    const response = await fetch(
      `${host}/api/projects/${encodeURIComponent(posthogProjectId)}/query/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${posthogApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      throw new Error(`PostHog query failed with status ${response.status}.`);
    }
    return response.json() as Promise<HogQlResponse>;
  }

  try {
    const [summary, sources, campaigns, landingPages, articles, clinics, devices, countries, trend] =
      await Promise.all([
        query(`
          SELECT
            uniqIf(distinct_id, event = '$pageview') AS unique_visitors,
            uniqIf(toString(properties.$session_id), event = '$pageview') AS sessions,
            countIf(event = '$pageview') AS page_views,
            countIf(event = 'directory_search_submitted') AS directory_searches,
            countIf(event = 'booking_link_clicked') AS booking_clicks,
            countIf(event = 'assessment_started') AS assessments_started,
            countIf(event IN ('assessment_completed', 'assessment_submitted', 'campaign_assessment_completed')) AS assessments_completed,
            countIf(event = 'clinic_application_submitted') AS clinic_applications,
            countIf(event IN ('professional_registration_started', 'employer_registration_started')) AS workforce_registrations
          FROM events
          WHERE ${since} AND ${productionFilter}
        `),
        query(`
          SELECT ifNull(nullIf(toString(properties.$referring_domain), ''), 'Direct / unknown') AS label, count() AS value
          FROM events
          WHERE event = '$pageview' AND ${since} AND ${productionFilter}
          GROUP BY label ORDER BY value DESC LIMIT 10
        `),
        query(`
          SELECT ifNull(
            nullIf(coalesce(nullIf(toString(properties.$utm_campaign), ''), nullIf(toString(properties.utm_campaign), '')), ''),
            'Unattributed'
          ) AS label, count() AS value
          FROM events
          WHERE event = '$pageview' AND ${since} AND ${productionFilter}
          GROUP BY label ORDER BY value DESC LIMIT 10
        `),
        query(`
          SELECT ifNull(nullIf(toString(properties.$pathname), ''), '/') AS label, count() AS value
          FROM events
          WHERE event = '$pageview' AND ${since} AND ${productionFilter}
          GROUP BY label ORDER BY value DESC LIMIT 10
        `),
        query(`
          SELECT toString(properties.article_slug) AS label, count() AS value
          FROM events
          WHERE event = 'article_viewed' AND ${since} AND ${productionFilter}
          GROUP BY label ORDER BY value DESC LIMIT 10
        `),
        query(`
          SELECT toString(properties.clinic_slug) AS label, count() AS value
          FROM events
          WHERE event = 'clinic_profile_viewed' AND ${since} AND ${productionFilter}
          GROUP BY label ORDER BY value DESC LIMIT 10
        `),
        query(`
          SELECT ifNull(nullIf(toString(properties.$device_type), ''), 'Unknown') AS label, count() AS value
          FROM events
          WHERE event = '$pageview' AND ${since} AND ${productionFilter}
          GROUP BY label ORDER BY value DESC LIMIT 10
        `),
        query(`
          SELECT ifNull(nullIf(toString(properties.$geoip_country_name), ''), 'Unknown') AS label, count() AS value
          FROM events
          WHERE event = '$pageview' AND ${since} AND ${productionFilter}
          GROUP BY label ORDER BY value DESC LIMIT 10
        `),
        query(`
          SELECT toDate(timestamp) AS label, count() AS value
          FROM events
          WHERE event = '$pageview' AND ${since} AND ${productionFilter}
          GROUP BY label ORDER BY label ASC
        `),
      ]);

    const summaryRow = summary.results?.[0] ?? [];
    const list = (payload: HogQlResponse) =>
      (payload.results ?? []).map((row) => ({
        label: String(row[0] ?? "Unknown"),
        value: asNumber(row[1]),
      }));

    return NextResponse.json({
      configured: true,
      source: "PostHog",
      environment: "production",
      days,
      refreshedAt: new Date().toISOString(),
      metrics: {
        uniqueVisitors: asNumber(summaryRow[0]),
        sessions: asNumber(summaryRow[1]),
        pageViews: asNumber(summaryRow[2]),
        directorySearches: asNumber(summaryRow[3]),
        bookingClicks: asNumber(summaryRow[4]),
        assessmentsStarted: asNumber(summaryRow[5]),
        assessmentsCompleted: asNumber(summaryRow[6]),
        clinicApplications: asNumber(summaryRow[7]),
        workforceRegistrations: asNumber(summaryRow[8]),
      },
      sources: list(sources),
      campaigns: list(campaigns),
      landingPages: list(landingPages),
      articles: list(articles),
      clinics: list(clinics),
      devices: list(devices),
      countries: list(countries),
      trend: list(trend),
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        source: "PostHog",
        error: error instanceof Error ? error.message : "Traffic analytics unavailable.",
      },
      { status: 502 },
    );
  }
}
