import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal HS256 JWT verification for Dialpad webhooks.
 *
 * Dialpad signs webhook payloads as JWTs using the shared webhook secret with
 * the HS256 algorithm (https://developers.dialpad.com/reference/webhookscreate).
 * The repository has no JWT dependency, and this narrow verifier avoids
 * adding one. It:
 *  - accepts only alg=HS256 (rejects "none" and everything else),
 *  - verifies the signature with a timing-safe comparison,
 *  - enforces exp/nbf when present (Dialpad payloads may omit them).
 */

export class JwtVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtVerificationError";
  }
}

function b64urlDecode(segment: string): Buffer {
  return Buffer.from(segment, "base64url");
}

export function verifyHs256Jwt(token: string, secret: string): Record<string, unknown> {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new JwtVerificationError("Malformed JWT: expected 3 segments.");
  const [headerSeg, payloadSeg, signatureSeg] = parts;

  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(b64urlDecode(headerSeg).toString("utf8"));
  } catch {
    throw new JwtVerificationError("Malformed JWT header.");
  }
  if (header.alg !== "HS256") {
    throw new JwtVerificationError(`Unsupported JWT algorithm: ${String(header.alg)}`);
  }

  const expected = createHmac("sha256", secret).update(`${headerSeg}.${payloadSeg}`).digest();
  let provided: Buffer;
  try {
    provided = b64urlDecode(signatureSeg);
  } catch {
    throw new JwtVerificationError("Malformed JWT signature.");
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new JwtVerificationError("JWT signature verification failed.");
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(b64urlDecode(payloadSeg).toString("utf8"));
  } catch {
    throw new JwtVerificationError("Malformed JWT payload.");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const skewSec = 300;
  if (typeof payload.exp === "number" && nowSec > payload.exp + skewSec) {
    throw new JwtVerificationError("JWT is expired.");
  }
  if (typeof payload.nbf === "number" && nowSec < payload.nbf - skewSec) {
    throw new JwtVerificationError("JWT is not yet valid.");
  }

  return payload;
}

/** Signs a payload as an HS256 JWT (used only by tests and mock tooling). */
export function signHs256Jwt(payload: Record<string, unknown>, secret: string): string {
  const enc = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const head = enc({ alg: "HS256", typ: "JWT" });
  const body = enc(payload);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
