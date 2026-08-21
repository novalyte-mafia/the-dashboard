import type { ContactChannelType } from "./types";

export const CONTACT_FORM_PRIMARY_ACTION = "Open Contact Form";

export const CONTACT_FORM_POLICY = {
  submitEnabled: false,
  prefillEnabled: false,
  captchaBypassEnabled: false,
  automateFormsEnabled: false,
  sendEnabled: false,
} as const;

export function contactFormAction(channel: ContactChannelType): { label: string; submit: false } | null {
  if (channel !== "CONTACT_FORM") return null;
  return { label: CONTACT_FORM_PRIMARY_ACTION, submit: false };
}

export const FORBIDDEN_OUTREACH_PHASE1 = [
  "resend",
  "auto-send",
  "sequence",
  "campaign send",
] as const;
