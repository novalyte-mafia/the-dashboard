/**
 * Founder-Led Call Mode — tomorrow's clinic outreach package.
 *
 * PRIMARY GOAL: Get permission to create/verify a free Novalyte directory profile.
 * Do not lead with advertising, paid acquisition, software, AI, or the full ecosystem.
 *
 * Used by Dialpad Founder Call HUD when you hit Call and the clinic answers.
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
  "Permission first. Get the right contact, confirm they are okay being listed for free, verify a few public details, and agree on a review-before-publish next step. Do not sell paid services on this call.";

export const FOUNDER_OBJECTIVE_CHECKLIST: FounderChecklistItem[] = [
  { id: "right_clinic", label: "Confirmed right clinic / location" },
  { id: "right_person", label: "Reached decision-maker or correct contact" },
  { id: "permission_asked", label: "Asked for free directory permission" },
  { id: "permission_status", label: "Permission status captured (yes / email / no)" },
  { id: "clinic_name", label: "Correct clinic name confirmed" },
  { id: "locations", label: "Locations / service area noted" },
  { id: "telehealth", label: "Telehealth / in-person / both noted" },
  { id: "services", label: "Main services for patients noted" },
  { id: "booking", label: "Website / phone / booking link preference" },
  { id: "reviewer", label: "Reviewer name + email captured" },
  { id: "follow_up", label: "Follow-up day agreed" },
  { id: "next_step", label: "Next action logged in CRM" },
];

/**
 * Linear script shown in the HUD when the clinic answers.
 * Tap through in order; use Quick Responses for objections.
 */
export const FOUNDER_TALKING_POINTS: FounderTalkingPoint[] = [
  {
    id: "opening",
    label: "1. When they answer",
    line: "Hi, good morning. My name is Jamil, and I'm calling from Novalyte AI. How are you doing today?",
  },
  {
    id: "purpose_gatekeeper",
    label: "2. Purpose + right person",
    line: "I'm reaching out because we're building a patient-facing directory for men's health clinics, and we'd like to include your clinic at no cost. I just need to speak with whoever handles your clinic information, partnerships, or marketing. Who would be the best person for that?",
  },
  {
    id: "regarding",
    label: "3. If they ask what this is regarding",
    line: "It's regarding a free clinic listing. We're creating a directory that helps patients discover men's health providers, and I'm calling to confirm whether we have permission to include the clinic and verify the information.",
  },
  {
    id: "decision_maker",
    label: "4. Decision-maker intro + permission ask",
    line: "Hi, my name is Jamil. I'm the founder of Novalyte AI. We're building a healthcare discovery platform, beginning with men's health, to help patients find reputable clinics based on their location and the services they need. I'm reaching out because we'd like to create a free directory profile for your clinic — no charge and no commitment. Would you be comfortable with us including the clinic?",
  },
  {
    id: "permission_yes",
    label: "5. If they say yes — verify",
    line: "Excellent. Thank you. I'll keep this simple — I just need to verify a few details so we represent the clinic accurately. What's the correct clinic name? What locations do you currently serve? Do you offer telehealth, in-person care, or both? What are the main services you'd want patients to know about? Should we send patients to your website, phone number, or a specific booking link? Who should review the profile before it's published, and what's the best email for that person?",
  },
  {
    id: "close_success",
    label: "6. Close successful call",
    line: "Perfect. I'll prepare the profile and send it for review before anything is finalized. Once you approve it, we can publish it in the directory. Is there a specific day I should follow up if I haven't heard back?",
  },
];

export const FOUNDER_QUICK_RESPONSES: FounderQuickResponse[] = [
  {
    id: "are_you_selling",
    trigger: "Are you selling something?",
    line: "No. There is no payment required for the directory listing. I'm only calling to request permission and confirm the clinic's information.",
  },
  {
    id: "busy",
    trigger: "Interested but busy",
    line: "Absolutely, I understand. I only need the name and email of the right person. I can send a brief explanation, and they can review it whenever convenient. Who should I send that to?",
  },
  {
    id: "send_info",
    trigger: "Send us information",
    line: "Of course. What's the best email address, and whose attention should I put it to? I'll send a short overview of the free listing, what would appear, and how the clinic can review or correct it before publication.",
  },
  {
    id: "make_money",
    trigger: "How does Novalyte make money?",
    line: "The directory listing itself is free. As the platform grows, Novalyte may offer optional services to clinics, but nothing paid is required for your clinic to be listed.",
  },
  {
    id: "how_helps",
    trigger: "How will this help us?",
    line: "It gives patients another way to discover the clinic, understand the services you provide, and reach the correct booking page or contact method. The objective is accurate clinic discovery — not a medical recommendation.",
  },
  {
    id: "traffic",
    trigger: "Do you already have patient traffic?",
    line: "I'll be straight with you: we're launching the directory and onboarding the first clinic partners now. The platform is live at novalyte.io, and we're building the clinic network and patient education content together. I don't want to exaggerate current traffic — early partners help shape the directory while we grow distribution.",
  },
  {
    id: "where_info",
    trigger: "Where did you get our information?",
    line: "We identified the clinic through publicly available business information. That's why I'm calling before publishing anything — to request permission and verify that the information is accurate.",
  },
  {
    id: "dont_want_listed",
    trigger: "We don't want to be listed",
    line: "Understood. Thank you for letting me know. I'll mark the clinic as not approved for publication. May I ask if there's a specific concern so we handle clinics appropriately?",
  },
  {
    id: "enough_patients",
    trigger: "We already have enough patients",
    line: "That makes sense. The listing doesn't require you to accept more patients or join any paid program. We can also note capacity or appointment availability on the profile. Would you still be comfortable with a basic informational listing?",
  },
  {
    id: "cost_again",
    trigger: "Cost / what's the catch?",
    line: "There is no cost for the directory profile. We will not put you on a paid agreement or charge the clinic for being included.",
  },
  {
    id: "referrals",
    trigger: "Are you referring / recommending us medically?",
    line: "Novalyte is not making a medical recommendation or guaranteeing a particular clinic. We help patients discover and compare available providers. Patients still decide and contact the clinic directly.",
  },
  {
    id: "verification",
    trigger: "What does verification mean?",
    line: "We confirm publicly available information and ask the clinic to review its profile before anything goes live. Any verification label is only used if those details have actually been confirmed.",
  },
  {
    id: "decision_unavailable",
    trigger: "Decision-maker unavailable",
    line: "No problem. May I have their name, email address, and the best time to call back? Is there anything specific I should include so they understand why I'm reaching out?",
  },
  {
    id: "already_on_google",
    trigger: "We're already on Google / Healthgrades",
    line: "Totally fair — this isn't a replacement for Google. It's a men's-health-specific directory so patients comparing TRT, weight-loss, and related care can find accurate clinic details in one place. Still free, and you review before publish.",
  },
  {
    id: "voicemail",
    trigger: "Voicemail",
    line: "Hi, this is Jamil, founder of Novalyte AI. We're building a patient-facing directory for men's health clinics, and I'm calling to request permission to include your clinic at no cost. I'd also like to verify the clinic's information before anything is published. You can reach me at [your number], or I'll send a brief email as well. Again, this is Jamil from Novalyte AI. Thank you.",
  },
];

export const FOUNDER_RECOVERY_ACTIONS: FounderRecoveryAction[] = [
  {
    id: "stuck",
    label: "I'm stuck",
    line: "Let me say that more clearly — I'm only asking permission to include your public clinic details in our free men's health directory. No cost, no contract, and nothing goes live without your review.",
  },
  {
    id: "reset",
    label: "Reset",
    line: "Sorry — let me reset. I'm Jamil, founder of Novalyte AI, calling about a free directory listing for your clinic. Who handles clinic information or marketing?",
  },
  {
    id: "objective",
    label: "What is the objective?",
    line: "Quick check: permission, correct contact, a few verified public details, and a clear next step. Do not pitch the full Novalyte ecosystem on this call.",
  },
  {
    id: "continue",
    label: "Help me continue",
    line: "Would you be comfortable with us including the clinic in the free directory after you review the profile?",
  },
  {
    id: "permission_ask",
    label: "Re-ask permission",
    line: "There's no charge and no commitment. Would you be comfortable with us including your clinic in the free Novalyte directory?",
  },
];

export const FOUNDER_GAPS_TO_VERIFY = [
  "Correct clinic name",
  "Locations / service area",
  "Telehealth / in-person / both",
  "Main services for patients",
  "Website / phone / booking link preference",
  "Reviewer name + email",
  "Directory permission yes / email / no",
  "Follow-up date",
];

export const FOUNDER_CALL_OUTCOMES = [
  "Permission granted",
  "Information requested",
  "Follow-up scheduled",
  "Decision-maker unavailable",
  "Wrong contact",
  "Not interested",
  "Do not contact",
  "Invalid number",
  "Voicemail left",
  "Profile review pending",
] as const;

export function founderOpeningLine(): string {
  return FOUNDER_TALKING_POINTS[0].line;
}
