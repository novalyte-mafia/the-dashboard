/**
 * Founder-Led Call Mode content package.
 *
 * Directory-permission outreach only - no paid acquisition language.
 * Used by Dialpad Founder-Led Call Mode; not the Telnyx/Simulation cockpit.
 */

export type FounderTalkingPoint = {
  id: string;
  label: string;
  line: string;
};

export type FounderQuickResponse = {
  id: string;
  trigger: string;
  line: string;
};

export type FounderRecoveryAction = {
  id: string;
  label: string;
  line: string;
};

export type FounderChecklistItem = {
  id: string;
  label: string;
};

export const FOUNDER_CALL_OBJECTIVE =
  "Confirm you reached the right clinic, briefly introduce Novalyte's free national men's health directory, and get permission to include their public listing details - no cost, no contract.";

export const FOUNDER_OBJECTIVE_CHECKLIST: FounderChecklistItem[] = [
  { id: "right_clinic", label: "Confirmed right clinic / location" },
  { id: "intro_done", label: "Founder + free directory intro delivered" },
  { id: "permission_asked", label: "Asked for directory permission" },
  { id: "public_phone", label: "Public phone confirmed" },
  { id: "services", label: "Core services confirmed" },
  { id: "telehealth", label: "Telehealth / in-person noted" },
  { id: "accepting", label: "Accepting new patients noted" },
  { id: "contact", label: "Best contact / email captured" },
  { id: "booking_link", label: "Booking-link permission (if discussed)" },
  { id: "next_step", label: "Next step agreed (summary email / follow-up)" },
];

export const FOUNDER_TALKING_POINTS: FounderTalkingPoint[] = [
  {
    id: "opening",
    label: "Opening",
    line: "Hi, my name's Jamil - I'm the founder of Novalyte AI. We're building a national men's health directory, kind of like a Google for men's health, where patients can find clinics and book right from your profile. Based on our research, yours is exactly the kind of clinic we'd love to feature, and there's no cost. Do you have a quick minute?",
  },
  {
    id: "why_calling",
    label: "Why calling",
    line: "I'm calling clinics directly so we only feature providers who are real, accurate, and okay being listed - this isn't a mass scrape or a paid lead pitch.",
  },
  {
    id: "permission",
    label: "Permission ask",
    line: "Would it be okay if we include your public clinic details in the free directory so men searching for care can find you?",
  },
  {
    id: "booking_link",
    label: "Booking link",
    line: "If you have a public booking link, we can optionally add that so patients can request an appointment from your listing - still free. Is that okay?",
  },
  {
    id: "contact",
    label: "Contact capture",
    line: "Who's the best person for a short confirmation email, and what's the best email to use?",
  },
  {
    id: "closing",
    label: "Closing",
    line: "Perfect - I'll send a short summary for review before anything goes live. Thanks for your time today.",
  },
];

export const FOUNDER_QUICK_RESPONSES: FounderQuickResponse[] = [
  {
    id: "is_this_sales",
    trigger: "Is this a sales call / what are you selling?",
    line: "Not a sales pitch - this call is only about permission to include your public details in our free men's health directory. There's no cost and no contract.",
  },
  {
    id: "how_much",
    trigger: "How much does it cost?",
    line: "There's no cost for the directory listing. I'm only asking permission to include your public clinic details.",
  },
  {
    id: "who_are_you",
    trigger: "Who are you again?",
    line: "I'm Jamil, founder of Novalyte AI. We're building a free national men's health directory so patients can find clinics like yours.",
  },
  {
    id: "already_listed",
    trigger: "We're already on Google / other directories",
    line: "Totally fair - this is a men's-health-specific directory, not a replacement for Google. It just makes it easier for men looking for TRT and related care to find the right clinic.",
  },
  {
    id: "send_email",
    trigger: "Can you email us instead?",
    line: "Absolutely - happy to email a short summary. Who should I send that to, and what's the best email?",
  },
  {
    id: "not_decision_maker",
    trigger: "I'm not the decision maker",
    line: "No problem - who usually handles website or marketing decisions, and is there a better time or email to reach them?",
  },
  {
    id: "busy",
    trigger: "We're slammed / call back later",
    line: "Understood - when's a better time for a two-minute callback, or would email be easier?",
  },
  {
    id: "privacy",
    trigger: "What information would you list?",
    line: "Only public details you'd want patients to see - clinic name, location, phone, services, and telehealth if applicable. Nothing private or internal.",
  },
  {
    id: "permission_yes",
    trigger: "Yes / that sounds fine",
    line: "Great - thank you. I'll confirm the public details quickly and send a short summary for review before anything goes live.",
  },
  {
    id: "permission_no",
    trigger: "No / not interested",
    line: "Understood - I won't add you. Appreciate your time, and I'll mark that clearly on our side.",
  },
];

export const FOUNDER_RECOVERY_ACTIONS: FounderRecoveryAction[] = [
  {
    id: "stuck",
    label: "I'm stuck",
    line: "Let me say that more clearly - I'm only asking permission to include your public clinic details in our free men's health directory. No cost, no contract.",
  },
  {
    id: "reset",
    label: "Reset",
    line: "Sorry - let me reset for a second. I'm Jamil, founder of Novalyte AI, calling about a free national men's health directory listing for your clinic.",
  },
  {
    id: "objective",
    label: "What is the objective?",
    line: "Quick objective check: get permission to include their public listing details in the free directory, confirm a few public facts, and agree on a next step.",
  },
  {
    id: "continue",
    label: "Help me continue",
    line: "Would it be okay if we include your public clinic details in the free directory so men searching for care can find you?",
  },
];

export const FOUNDER_GAPS_TO_VERIFY = [
  "Public phone number",
  "Core services (TRT / hormones / telehealth / etc.)",
  "In-person vs telehealth",
  "Accepting new patients",
  "Best contact email",
  "Directory permission yes/no",
];

export function founderOpeningLine(): string {
  return FOUNDER_TALKING_POINTS[0].line;
}
