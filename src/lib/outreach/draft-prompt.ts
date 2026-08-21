import type { OutreachEvidence, OutreachProspect } from "./types";

export const SITE_URL = "https://novalyte.io";
export const DIRECTORY_URL = "https://novalyte.io/directory";

export const DRAFT_SYSTEM_PROMPT = `You write first-touch clinic outreach emails for Jamil Yakasai, founder of Novalyte AI.
This is a human-reviewed draft. No message is sent automatically.

Locked voice and structure — match this letter, swapping only clinic-specific facts:

Hello there,

My name is Jamil, and I’m the founder of Novalyte AI.

Novalyte AI is a men’s health ecosystem that includes a curated clinic directory designed to help patients discover reputable providers and book through each clinic’s existing website or scheduling link.

{Clinic} stood out because of {specific sourced services or public detail}. I would like to feature your clinic in the directory at no cost, with no contract or obligation.

Before anything is published, I would simply verify your clinic information and receive your approval.

Would you be open to having {Clinic} included?

Best,
Jamil
Founder, Novalyte AI
novalyte.io

Hard rules:
- First person as Jamil, founder. Do not write as “we / the team” unless a real named introducer is in the evidence.
- Never invent a referral (no “I spoke with Haley” unless that person’s name is in the evidence).
- No ads pitch, no software pitch, no AI product pitch, no 15-minute meeting ask.
- No cost, no contract, no obligation. Nothing is published until they approve.
- Patients book on the clinic’s existing website or scheduling link — Novalyte is not taking bookings away.
- Personalize the “stood out because” sentence with at least one concrete sourced detail (listed services, a public news hook, or a public ad angle such as testosterone consults). Put that detail in that sentence — do not open with an ads pitch.
- If evidence shows a gap (no website, ads with no landing page), say that plainly in the stood-out sentence.
- The message must not be reusable for another clinic without edits.
- Never claim guaranteed email deliverability.
- Keep a short letter, similar length to the sample (about 120–180 words).
- Preserve line breaks in the JSON message field.

Return JSON: { "subject": string, "message": string, "angle": string, "sourcedDetail": string, "evidenceIds": string[] }
Subject pattern: Including {Clinic} in the Novalyte directory?`;

export function fallbackDraft(prospect: OutreachProspect, evidence: OutreachEvidence[]) {
  const sourced = pickSourcedDetail(prospect, evidence);
  const clinic = prospect.clinicName;
  const subject = `Including ${clinic} in the Novalyte directory?`;
  const message = [
    "Hello there,",
    "",
    "My name is Jamil, and I’m the founder of Novalyte AI.",
    "",
    "Novalyte AI is a men’s health ecosystem that includes a curated clinic directory designed to help patients discover reputable providers and book through each clinic’s existing website or scheduling link.",
    "",
    `${clinic} stood out because of ${sourced.detail}. I would like to feature your clinic in the directory at no cost, with no contract or obligation.`,
    "",
    "Before anything is published, I would simply verify your clinic information and receive your approval.",
    "",
    `Would you be open to having ${clinic} included?`,
    "",
    "Best,",
    "Jamil",
    "Founder, Novalyte AI",
    "novalyte.io",
  ].join("\n");
  return {
    subject,
    message,
    angle: sourced.angle,
    sourcedDetail: sourced.detail,
    evidenceIds: sourced.evidenceIds,
  };
}

export function pickSourcedDetail(prospect: OutreachProspect, evidence: OutreachEvidence[]) {
  const ads = evidence.filter((row) => row.evidenceType === "ADVERTISING_RECORD");
  const news = evidence.filter((row) => row.evidenceType === "NEWS_MENTION");
  const pages = evidence.filter((row) => row.evidenceType === "WEBSITE_PAGE" || row.evidenceType === "CONTACT_PAGE");
  const first = ads[0] ?? news[0] ?? pages[0] ?? evidence[0];
  if (!first) {
    const gap = !prospect.websiteUrl
      ? "there is no public website on file, and I want to confirm the right listing details"
      : `your public presence in ${prospect.city ?? "this market"}`;
    return { detail: gap, angle: prospect.websiteUrl ? "Directory inclusion" : "Missing website", evidenceIds: [] as string[] };
  }
  const excerpt = (first.excerpt || first.sourceTitle || "your publicly listed services").replace(/\s+/g, " ").slice(0, 140);
  const angle = first.evidenceType === "ADVERTISING_RECORD"
    ? "Active or recent public advertising"
    : first.evidenceType === "NEWS_MENTION"
      ? "Public news or press mention"
      : "Public website positioning";
  return { detail: excerpt, angle, evidenceIds: [first.id] };
}
