import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/constants";

function getSecret() {
  const secret = process.env.NOVALYTE_SESSION_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("NOVALYTE_SESSION_SECRET must be configured in production.");
  }
  return secret || "novalyte-admin-dev-secret-change-in-production";
}

// --- Password hashing (scrypt) ---
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  if (hashBuf.length !== testBuf.length) return false;
  return timingSafeEqual(hashBuf, testBuf);
}

// --- Session token (HMAC-signed JWT-ish) ---
export interface SessionPayload {
  adminId: string;
  email: string;
  role: string;
}

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

export function createSessionToken(payload: SessionPayload): string {
  const body = b64url({ ...payload, iat: Date.now(), exp: Date.now() + SESSION_MAX_AGE * 1000 });
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = createHmac("sha256", getSecret()).update(body).digest("base64url");
    const sigBuffer = Buffer.from(sig);
    const expectedBuffer = Buffer.from(expected);
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) return null;
    const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (decoded.exp && Date.now() > decoded.exp) return null;
    return { adminId: decoded.adminId, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

// Returns the active admin member from the session cookie, or null.
// Authentication fails closed: an absent or invalid cookie never receives
// an implicit administrator identity.
export async function getSessionAdmin() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) {
    const payload = verifySessionToken(token);
    if (payload) {
      const admin = await db.adminMember.findUnique({
        where: { id: payload.adminId },
      });
      if (admin && admin.status === "active") return admin;
    }
  }
  return null;
}

export type SessionAdmin = NonNullable<Awaited<ReturnType<typeof getSessionAdmin>>>;

export type AdminRole = "founder" | "admin" | "sales" | "operations" | "directory_reviewer";

export function hasRole(admin: SessionAdmin, roles: readonly AdminRole[]) {
  return admin.role === "founder" || roles.includes(admin.role as AdminRole);
}

/** Server-side authorization guard for mutating routes. */
export async function requireAdminRole(roles: readonly AdminRole[] = []) {
  const admin = await getSessionAdmin();
  if (!admin || (roles.length > 0 && !hasRole(admin, roles))) return null;
  return admin;
}
