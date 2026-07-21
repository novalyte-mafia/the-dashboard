/** Build organic service-location path: /find/{service}/{state}/{city} */
export function organicPath(service: string, state: string, city: string): string {
  const parts = [service, state, city]
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
    .filter(Boolean);
  return `/find/${parts.join("/")}`;
}

/** Build paid ads path: /ads/{slug} */
export function adsPath(slug: string): string {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return `/ads/${normalized}`;
}

/** Extract the slug segment from a page path (last segment for organic, ads segment for ads). */
export function pathToSlug(path: string, host: "organic" | "ads"): string {
  const segments = path.split("/").filter(Boolean);
  if (host === "ads") return segments[1] ?? segments[0] ?? "";
  return segments[segments.length - 1] ?? "";
}

/** Build a unique ads slug from vertical + geo + optional intent. */
export function buildAdsSlug(
  verticalSlug: string,
  geoSlug: string,
  intent?: string | null,
): string {
  const parts = [verticalSlug, geoSlug, intent].filter(Boolean) as string[];
  return parts
    .join("-")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
