import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { requireAdminRole } from "@/lib/auth";

type Ga4MetricBlock = {
  activeUsers: number;
  sessions: number;
  screenPageViews: number;
  engagedSessions: number;
  averageSessionDuration: number;
  bounceRate: number;
};

type Ranked = { label: string; value: number };

function parseServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      client_email: string;
      private_key: string;
      project_id?: string;
    };
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string | null> {
  const credentials = parseServiceAccount();
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!credentials && !keyFile) return null;

  const auth = new GoogleAuth({
    credentials: credentials ?? undefined,
    keyFile: credentials ? undefined : keyFile,
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token ?? null;
}

async function runReport(
  propertyId: string,
  accessToken: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `GA4 Data API returned ${response.status}`);
  }
  return payload as {
    rows?: Array<{
      dimensionValues?: Array<{ value?: string }>;
      metricValues?: Array<{ value?: string }>;
    }>;
  };
}

function metricNumber(rows: Array<{ metricValues?: Array<{ value?: string }> }> | undefined, index = 0) {
  const value = rows?.[0]?.metricValues?.[index]?.value;
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function rankedFromRows(
  rows: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }> | undefined,
): Ranked[] {
  return (rows ?? [])
    .map((row) => ({
      label: row.dimensionValues?.[0]?.value || "(not set)",
      value: Number(row.metricValues?.[0]?.value ?? 0),
    }))
    .filter((row) => Number.isFinite(row.value))
    .slice(0, 10);
}

export async function GET(request: NextRequest) {
  if (!(await requireAdminRole(["admin"]))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const propertyUrl =
    process.env.GA4_PROPERTY_URL?.trim() ||
    (propertyId
      ? `https://analytics.google.com/analytics/web/#/p${encodeURIComponent(propertyId)}/reports/intelligenthome`
      : measurementId
        ? "https://analytics.google.com/"
        : null);
  const days = Math.min(90, Math.max(1, Number(request.nextUrl.searchParams.get("days") || 30)));
  const apiConfigured = Boolean(
    propertyId &&
      (process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()),
  );

  if (!apiConfigured || !propertyId) {
    return NextResponse.json({
      source: "Google Analytics 4",
      collectionConfigured: Boolean(measurementId || propertyId),
      apiConfigured: false,
      propertyUrl,
      measurementId: measurementId || null,
      metrics: null,
      message:
        "GA4 collection can be live on novalyte.io while this admin panel still needs read access. Set GA4_PROPERTY_ID and GOOGLE_SERVICE_ACCOUNT_JSON (Analytics Viewer service account) on the dashboard project.",
    });
  }

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return NextResponse.json({
        source: "Google Analytics 4",
        collectionConfigured: Boolean(measurementId || propertyId),
        apiConfigured: true,
        propertyUrl,
        measurementId: measurementId || null,
        metrics: null,
        message: "GA4 credentials are present but an access token could not be created.",
      });
    }

    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];

    const [summary, channels, countries, devices, landings, sources] = await Promise.all([
      runReport(propertyId, accessToken, {
        dateRanges,
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "engagedSessions" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
        ],
      }),
      runReport(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      runReport(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 10,
      }),
      runReport(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      runReport(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "landingPage" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      runReport(propertyId, accessToken, {
        dateRanges,
        dimensions: [{ name: "sessionSource" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
    ]);

    const metrics: Ga4MetricBlock = {
      activeUsers: metricNumber(summary.rows, 0),
      sessions: metricNumber(summary.rows, 1),
      screenPageViews: metricNumber(summary.rows, 2),
      engagedSessions: metricNumber(summary.rows, 3),
      averageSessionDuration: metricNumber(summary.rows, 4),
      bounceRate: metricNumber(summary.rows, 5),
    };

    return NextResponse.json({
      source: "Google Analytics 4",
      collectionConfigured: true,
      apiConfigured: true,
      propertyUrl,
      measurementId: measurementId || null,
      days,
      refreshedAt: new Date().toISOString(),
      metrics,
      channels: rankedFromRows(channels.rows),
      countries: rankedFromRows(countries.rows),
      devices: rankedFromRows(devices.rows),
      landingPages: rankedFromRows(landings.rows),
      sources: rankedFromRows(sources.rows),
      message: null,
    });
  } catch (error) {
    return NextResponse.json({
      source: "Google Analytics 4",
      collectionConfigured: Boolean(measurementId || propertyId),
      apiConfigured: true,
      propertyUrl,
      measurementId: measurementId || null,
      metrics: null,
      error: error instanceof Error ? error.message : "GA4 reporting unavailable.",
      message: "GA4 Data API request failed. Confirm the service account has Viewer access on the property.",
    });
  }
}
