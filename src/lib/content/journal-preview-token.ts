import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, short-lived Journal preview tokens.
 *
 * This file is mirrored in both applications until they share a package:
 * - marketing: src/lib/journal/preview-token.ts (verify + create)
 * - dashboard: src/lib/content/journal-preview-token.ts (create)
 * Update both copies in the same change.
 *
 * Token format (URL-safe, usable as a path segment):
 *   base64url({ v: 1, sub: articleId, exp: unixSeconds }) + "." + base64url(hmacSha256)
 * Signed with the shared server-only secret JOURNAL_PREVIEW_SECRET.
 */

export const JOURNAL_PREVIEW_TOKEN_VERSION = 1 as const;
export const JOURNAL_PREVIEW_DEFAULT_TTL_SECONDS = 60 * 30;
export const JOURNAL_PREVIEW_MAX_TTL_SECONDS = 60 * 60 * 4;

type PreviewTokenPayload = {
  v: typeof JOURNAL_PREVIEW_TOKEN_VERSION;
  sub: string;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.JOURNAL_PREVIEW_SECRET?.trim();
  if (!secret) {
    throw new Error("JOURNAL_PREVIEW_SECRET is not configured.");
  }
  return secret;
}

function sign(payloadB64: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payloadB64).digest();
}

export function createJournalPreviewToken(
  articleId: string,
  ttlSeconds: number = JOURNAL_PREVIEW_DEFAULT_TTL_SECONDS,
): string {
  if (!articleId) throw new Error("articleId is required for a preview token.");
  const ttl = Math.min(Math.max(Math.floor(ttlSeconds), 60), JOURNAL_PREVIEW_MAX_TTL_SECONDS);
  const payload: PreviewTokenPayload = {
    v: JOURNAL_PREVIEW_TOKEN_VERSION,
    sub: articleId,
    exp: Math.floor(Date.now() / 1000) + ttl,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(payloadB64, getSecret()).toString("base64url");
  return `${payloadB64}.${signature}`;
}

export type PreviewTokenResult =
  | { ok: true; articleId: string; expiresAt: Date }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" | "unconfigured" };

export function verifyJournalPreviewToken(token: string): PreviewTokenResult {
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return { ok: false, reason: "unconfigured" };
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "malformed" };
  }
  const [payloadB64, signatureB64] = parts;

  let providedSignature: Buffer;
  try {
    providedSignature = Buffer.from(signatureB64, "base64url");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const expectedSignature = sign(payloadB64, secret);
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return { ok: false, reason: "bad-signature" };
  }

  let payload: PreviewTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    payload.v !== JOURNAL_PREVIEW_TOKEN_VERSION ||
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }
  if (payload.exp * 1000 <= Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, articleId: payload.sub, expiresAt: new Date(payload.exp * 1000) };
}
