import "server-only";

/**
 * Server-only bridge from Command Center campaign APIs to the public
 * marketing site (novalyte.io / ads.novalyte.io).
 *
 * Optional env (server-only):
 * - CAMPAIGN_REVALIDATE_URL     e.g. https://novalyte.io/api/campaigns/revalidate
 * - CAMPAIGN_REVALIDATE_SECRET  bearer secret for the revalidate endpoint
 */

export type CampaignRevalidationRequest = {
  /** Page paths to invalidate, e.g. /find/trt/california/beverly-hills */
  paths?: string[];
  /** Invalidate all campaign page caches. */
  all?: boolean;
};

/**
 * Ask the marketing site to invalidate campaign page caches after publish.
 * No-ops when env vars are missing (local dev without marketing hook).
 */
export async function requestCampaignRevalidation(
  request: CampaignRevalidationRequest,
): Promise<void> {
  const url = process.env.CAMPAIGN_REVALIDATE_URL?.trim();
  const secret = process.env.CAMPAIGN_REVALIDATE_SECRET?.trim();
  if (!url || !secret) return;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(request),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Campaign revalidation failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }
}
