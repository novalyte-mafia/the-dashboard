import { normalizeToE164 } from "@/lib/dialpad/phone";

/**
 * Build dial targets for Quo click-to-call.
 *
 * Desktop: set Quo as the default TEL handler, then tel: opens Quo.
 * Mobile: openphone:// deep link can auto-dial (Quo docs).
 */
export function buildQuoDialLinks(destinationRaw: string, fromNumber?: string | null) {
  const destination = normalizeToE164(destinationRaw);
  if (!destination) return null;

  const numberParam = encodeURIComponent(destination);
  const fromParam = fromNumber ? encodeURIComponent(normalizeToE164(fromNumber) || fromNumber) : null;

  const deepLink = fromParam
    ? `openphone://dial?number=${numberParam}&from=${fromParam}&action=call`
    : `openphone://dial?number=${numberParam}&action=call`;

  return {
    e164: destination,
    telHref: `tel:${destination}`,
    deepLink,
  };
}
