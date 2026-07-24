import "server-only";
import crypto from "crypto";

/**
 * Verify Quo/OpenPhone webhook signature.
 * Header: openphone-signature = hmac;1;<timestamp>;<base64-hmac>
 * Signed data: `${timestamp}.${rawBody}`
 * Key: base64 signing secret from Quo webhook settings / create response.
 */
export function verifyQuoWebhookSignature(opts: {
  rawBody: string;
  signatureHeader: string | null;
  signingSecretBase64: string;
  maxSkewSec?: number;
}): boolean {
  const { rawBody, signatureHeader, signingSecretBase64, maxSkewSec = 300 } = opts;
  if (!signatureHeader || !signingSecretBase64) return false;

  const parts = signatureHeader.split(";");
  if (parts.length < 4) return false;
  const [scheme, version, timestamp, signature] = parts;
  if (scheme !== "hmac" || version !== "1" || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const skew = Math.abs(Date.now() / 1000 - ts);
  if (skew > maxSkewSec) return false;

  const signedData = `${timestamp}.${rawBody}`;
  const key = Buffer.from(signingSecretBase64, "base64");
  const digest = crypto.createHmac("sha256", key).update(signedData, "utf8").digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return digest === signature;
  }
}
