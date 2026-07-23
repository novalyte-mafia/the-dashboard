/** Build organic service-location path: /find/{service}/{state}/{city} */
export function organicPath(service: string, state: string, city: string): string {
  const parts = [service, state, city]
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
    .filter(Boolean);
  return `/find/${parts.join("/")}`;
}

/** Build paid ads path.
 * Preferred hierarchical: /ads/{treatment}/{location}  e.g. /ads/trt/phoenix-az
 * Legacy flat slug still supported: /ads/{slug}
 */
export function adsPath(slugOrTreatment: string, location?: string | null): string {
  const treatment = slugOrTreatment
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  if (location) {
    const loc = location
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    return `/ads/${treatment}/${loc}`;
  }
  return `/ads/${treatment}`;
}

/** Extract the ads slug: hierarchical `trt/phoenix-az` or legacy single segment. */
export function pathToSlug(path: string, host: "organic" | "ads"): string {
  const segments = path.split("/").filter(Boolean);
  if (host === "ads") {
    // /ads/trt/phoenix-az → trt/phoenix-az ; /ads/glp-1-la → glp-1-la
    return segments.slice(1).join("/") || segments[0] || "";
  }
  return segments[segments.length - 1] ?? "";
}

/** Build hierarchical ads identity from vertical + geo (+ optional intent segment). */
export function buildAdsSlug(
  verticalSlug: string,
  geoSlug: string,
  intent?: string | null,
): string {
  const treatment = verticalSlug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const location = [geoSlug, intent]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return `${treatment}/${location}`;
}

/** Public ads.novalyte.io URL (strips internal /ads prefix for hierarchical paths). */
export function adsPublicPath(internalPath: string): string {
  const normalized = internalPath.startsWith("/") ? internalPath : `/${internalPath}`;
  if (normalized === "/ads" || normalized === "/ads/") return "/";
  if (normalized.startsWith("/ads/")) return normalized.slice(4) || "/";
  return normalized;
}
