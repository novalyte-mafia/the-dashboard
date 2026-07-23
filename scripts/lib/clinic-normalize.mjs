/**
 * Clinic field normalization for TRT Advisor → prospect_clinics import.
 * Pure helpers — no DB side effects.
 */

const LEGAL_SUFFIXES = /\b(llc|l\.l\.c\.|inc|inc\.|incorporated|pllc|p\.l\.l\.c\.|pc|p\.c\.|corp|corporation|ltd|limited|co|company|llp|l\.l\.p\.)\b/gi;

const STREET_ABBR = [
  [/\bstreet\b/g, "st"],
  [/\bavenue\b/g, "ave"],
  [/\bboulevard\b/g, "blvd"],
  [/\bdrive\b/g, "dr"],
  [/\broad\b/g, "rd"],
  [/\blane\b/g, "ln"],
  [/\bcourt\b/g, "ct"],
  [/\bplace\b/g, "pl"],
  [/\bsuite\b/g, "ste"],
  [/\bapartment\b/g, "apt"],
  [/\bnorth\b/g, "n"],
  [/\bsouth\b/g, "s"],
  [/\beast\b/g, "e"],
  [/\bwest\b/g, "w"],
];

export function collapseSpaces(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeClinicName(value) {
  let s = String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/&/g, " and ");
  s = s.replace(/['’`]/g, "");
  s = s.replace(LEGAL_SUFFIXES, " ");
  s = s.replace(/[^a-z0-9\s]/g, " ");
  return collapseSpaces(s);
}

/** Returns 10-digit US digits, or null. */
export function normalizePhoneDigits(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  // Placeholder / directory filler numbers
  if (digits.slice(3, 6) === "555") return null;
  return digits;
}

export function formatPhoneDisplay(digits) {
  if (!digits || digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Root hostname without www. */
export function normalizeWebsiteDomain(value) {
  if (!value) return null;
  let raw = String(value).trim().toLowerCase();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    let host = u.hostname.replace(/^www\./, "");
    if (!host || host.includes("trtadvisor.com")) return null;
    return host;
  } catch {
    return null;
  }
}

export function normalizeAddressPart(value) {
  let s = String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/['’`]/g, "");
  s = s.replace(/[^a-z0-9\s]/g, " ");
  for (const [re, rep] of STREET_ABBR) s = s.replace(re, rep);
  return collapseSpaces(s);
}

export function normalizeFullAddress({ address, city, state, zip } = {}) {
  const parts = [
    normalizeAddressPart(address),
    normalizeAddressPart(city),
    normalizeAddressPart(state),
    String(zip || "").replace(/\D/g, "").slice(0, 5),
  ].filter(Boolean);
  return parts.join("|") || null;
}

export function nameCityStateKey(name, city, state) {
  const n = normalizeClinicName(name);
  const c = normalizeAddressPart(city);
  const s = normalizeAddressPart(state);
  if (!n || !c || !s) return null;
  return `${n}|${c}|${s}`;
}

/**
 * Classify match against an existing clinic snapshot.
 * @returns {{ kind: 'confirmed'|'probable'|null, reason: string|null, confidence: number }}
 */
export function classifyDuplicate(candidate, existing) {
  const candDomain = normalizeWebsiteDomain(candidate.website);
  const existDomain = normalizeWebsiteDomain(existing.website);
  if (candDomain && existDomain && candDomain === existDomain) {
    return { kind: "confirmed", reason: "same_website_domain", confidence: 0.99 };
  }

  const candPhone = normalizePhoneDigits(candidate.phone || candidate.primaryPhone);
  const existPhone = normalizePhoneDigits(existing.phone || existing.primaryPhone);
  if (candPhone && existPhone && candPhone === existPhone) {
    return { kind: "confirmed", reason: "same_phone", confidence: 0.98 };
  }

  const candAddr = normalizeFullAddress(candidate);
  const existAddr = normalizeFullAddress(existing);
  const candName = normalizeClinicName(candidate.name);
  const existName = normalizeClinicName(existing.name);
  if (candName && existName && candName === existName && candAddr && existAddr && candAddr === existAddr) {
    return { kind: "confirmed", reason: "same_name_and_full_address", confidence: 0.97 };
  }

  const candNcs = nameCityStateKey(candidate.name, candidate.city, candidate.state);
  const existNcs = nameCityStateKey(existing.name, existing.city, existing.state);
  if (candNcs && existNcs && candNcs === existNcs) {
    return { kind: "probable", reason: "same_name_city_state", confidence: 0.85 };
  }

  // Same brand (exact normalized name) different city/state → multi-location, not a duplicate insert block by itself
  if (candName && existName && candName === existName) {
    const sameState = normalizeAddressPart(candidate.state) === normalizeAddressPart(existing.state);
    const sameCity = normalizeAddressPart(candidate.city) === normalizeAddressPart(existing.city);
    if (!sameCity || !sameState) {
      return { kind: "probable", reason: "same_brand_different_location", confidence: 0.7 };
    }
  }

  // Similar name + same city/state (token overlap)
  if (
    candName &&
    existName &&
    normalizeAddressPart(candidate.city) === normalizeAddressPart(existing.city) &&
    normalizeAddressPart(candidate.state) === normalizeAddressPart(existing.state)
  ) {
    const a = new Set(candName.split(" "));
    const b = new Set(existName.split(" "));
    const inter = [...a].filter((t) => b.has(t) && t.length > 2);
    const union = new Set([...a, ...b]);
    const jaccard = union.size ? inter.length / union.size : 0;
    if (jaccard >= 0.6 && inter.length >= 2) {
      return { kind: "probable", reason: "similar_name_same_city_state", confidence: 0.65 };
    }
  }

  return { kind: null, reason: null, confidence: 0 };
}
