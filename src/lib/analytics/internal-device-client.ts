/**
 * Client helpers for admin dashboard internal-device cookie persistence.
 * Same cookie names as the marketing site so Domain=.novalyte.io is shared.
 */

const INTERNAL_DEVICE_ID_KEY = "novalyte_internal_device_id";
const INTERNAL_DEVICE_TOKEN_KEY = "novalyte_internal_device_token";
const INTERNAL_DEVICE_LABEL_KEY = "novalyte_internal_device_label";
const COOKIE_DOMAIN = ".novalyte.io";

function isNovalyteHost(): boolean {
  if (typeof window === "undefined") return false;
  return /(^|\.)novalyte\.io$/i.test(window.location.hostname);
}

function writeCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 400) {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(value);
  const base = `${name}=${encoded}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax; Secure`;
  document.cookie = isNovalyteHost() ? `${base}; Domain=${COOKIE_DOMAIN}` : base;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  const base = `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  document.cookie = isNovalyteHost() ? `${base}; Domain=${COOKIE_DOMAIN}` : base;
}

export function persistInternalDeviceRegistration(input: {
  deviceId: string;
  token: string;
  label: string;
}): void {
  if (typeof window === "undefined") return;
  writeCookie(INTERNAL_DEVICE_ID_KEY, input.deviceId);
  writeCookie(INTERNAL_DEVICE_TOKEN_KEY, input.token);
  writeCookie(INTERNAL_DEVICE_LABEL_KEY, input.label);
  window.localStorage.setItem(INTERNAL_DEVICE_ID_KEY, input.deviceId);
  window.localStorage.setItem(INTERNAL_DEVICE_TOKEN_KEY, input.token);
  window.localStorage.setItem(INTERNAL_DEVICE_LABEL_KEY, input.label);
}

export function clearInternalDeviceRegistration(): void {
  if (typeof window === "undefined") return;
  clearCookie(INTERNAL_DEVICE_ID_KEY);
  clearCookie(INTERNAL_DEVICE_TOKEN_KEY);
  clearCookie(INTERNAL_DEVICE_LABEL_KEY);
  window.localStorage.removeItem(INTERNAL_DEVICE_ID_KEY);
  window.localStorage.removeItem(INTERNAL_DEVICE_TOKEN_KEY);
  window.localStorage.removeItem(INTERNAL_DEVICE_LABEL_KEY);
}

export function readLocalInternalDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem(INTERNAL_DEVICE_ID_KEY) ||
    document.cookie
      .split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${INTERNAL_DEVICE_ID_KEY}=`))
      ?.slice(INTERNAL_DEVICE_ID_KEY.length + 1) ||
    null
  );
}
