import type {
  ExtractedContact,
  PostCallReview,
  Scorecard,
  TalkListenMetrics,
  TranscriptTurn,
  VerifiedClinicFields,
} from "./types";
import { OPENING_LINE } from "./fallbacks";

function joinTurns(turns: TranscriptTurn[]): string {
  return turns.map((t) => t.text).join(" ");
}

function grab(pattern: RegExp, text: string): string {
  const match = text.match(pattern);
  return match?.[1]?.trim() || "";
}

export function extractReviewFromTranscript(
  turns: TranscriptTurn[],
  metrics: TalkListenMetrics,
): PostCallReview {
  const all = joinTurns(turns);
  const prospect = turns.filter((t) => t.speaker !== "founder").map((t) => t.text).join(" ");
  const founder = turns.filter((t) => t.speaker === "founder").map((t) => t.text).join(" ");

  const email = grab(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i, all);
  const phone = grab(/((?:\+?1[ .\-]?)?(?:\(\d{3}\)|\d{3})[ .\-]?\d{3}[ .\-]?\d{4})/, all);
  const busy = /\b(busy|call back|in a meeting)\b/i.test(prospect);
  const notInterested = /\b(not interested|no thanks|remove us)\b/i.test(prospect);
  const permission = /\b(you (?:can|may) (?:list|include)|permission granted|that's fine|go ahead)\b/i.test(prospect)
    ? "Permission indicated — confirm in writing."
    : /\b(do not|don't|no permission)\b/i.test(prospect)
      ? "Permission declined or unclear."
      : "Not confirmed.";

  let outcome = "connected";
  if (notInterested) outcome = "not_interested";
  else if (busy) outcome = "call_back_requested";
  else if (email) outcome = "information_requested";
  else if (!turns.length) outcome = "no_answer";

  const objectionTags: string[] = [];
  if (busy) objectionTags.push("busy");
  if (notInterested) objectionTags.push("not_interested");
  if (/\bsales\b/i.test(prospect)) objectionTags.push("sales_concern");
  if (/\bemail\b/i.test(prospect)) objectionTags.push("prefers_email");

  const longestFounder = [...turns]
    .filter((t) => t.speaker === "founder")
    .sort((a, b) => b.text.length - a.text.length)[0];

  const shorterPhrase = longestFounder
    ? longestFounder.text.split(/[.!?]/)[0]?.trim().slice(0, 120) || OPENING_LINE
    : OPENING_LINE;

  const whatWentWell = metrics.questionCount > 0
    ? `You asked ${metrics.questionCount} question${metrics.questionCount === 1 ? "" : "s"} — that keeps the call two-way.`
    : "You showed up and started the conversation. Next time, land one clear question early.";
  const oneImprovement = metrics.talkingTooLong
    ? "Stop sooner after your point and hand the floor back with a question."
    : metrics.fillerCount > 4
      ? "Replace filler words with a short pause. Silence is fine."
      : "Confirm a next step (email, name, or time) before hanging up.";
  const scorecard: Scorecard = {
    whatWentWell,
    oneImprovement,
    shorterPhrase,
    nextCallOpening: OPENING_LINE,
    coachSummary: `${whatWentWell} ${oneImprovement}`,
    source: "fallback",
  };

  const extractedContacts: ExtractedContact[] = email
    ? [{ firstName: "", lastName: "", title: "", email, phone, isDecisionMaker: false }]
    : [];

  const verified: VerifiedClinicFields = {
    phone,
    email,
    services: "",
    website: "",
    decisionMaker: "",
    permission,
  };

  return {
    outcome,
    decisionMakerStatus: /\b(owner|manager|doctor|decision)\b/i.test(all) ? "Possibly reached or identified" : "Unknown",
    contactName: "",
    contactRole: "",
    contactEmail: email,
    verifiedDetails: [phone && `Phone: ${phone}`, email && `Email: ${email}`].filter(Boolean).join(" · ") || "None verified — do not invent.",
    permissions: permission,
    objections: objectionTags.join(", ") || "None tagged",
    promisedFollowUp: /\b(i('ll| will) send|follow up|email)\b/i.test(founder) ? "Founder offered a short follow-up note." : "",
    nextAction: email || busy ? "Send a short verification email / schedule callback." : "Log the attempt and retry with a routing question.",
    followUpDate: "",
    followUpNotes: "",
    notes: "",
    extractedContacts,
    verifiedClinicFields: verified,
    objectionTags,
    scorecard,
  };
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function mergeModelReview(base: PostCallReview, model: Record<string, unknown>): PostCallReview {
  const score = (model.scorecard && typeof model.scorecard === "object")
    ? (model.scorecard as Record<string, unknown>)
    : {};
  const contactEmail = str(model.contactEmail, base.contactEmail);
  const phone = str((model.verifiedClinicFields as { phone?: unknown } | undefined)?.phone, base.verifiedClinicFields.phone);
  return {
    ...base,
    outcome: str(model.outcome, base.outcome),
    decisionMakerStatus: str(model.decisionMakerStatus, base.decisionMakerStatus),
    contactName: str(model.contactName, base.contactName),
    contactRole: str(model.contactRole, base.contactRole),
    contactEmail,
    verifiedDetails: str(model.verifiedDetails, base.verifiedDetails),
    permissions: str(model.permissions, base.permissions),
    objections: str(model.objections, base.objections),
    promisedFollowUp: str(model.promisedFollowUp, base.promisedFollowUp),
    nextAction: str(model.nextAction, base.nextAction),
    notes: str(model.notes, base.notes),
    scorecard: {
      whatWentWell: str(score.whatWentWell, base.scorecard.whatWentWell),
      oneImprovement: str(score.oneImprovement, base.scorecard.oneImprovement),
      shorterPhrase: str(score.shorterPhrase, base.scorecard.shorterPhrase),
      nextCallOpening: str(score.nextCallOpening, base.scorecard.nextCallOpening),
      coachSummary: str(score.coachSummary, base.scorecard.coachSummary),
      source: "gemini",
    },
    verifiedClinicFields: {
      ...base.verifiedClinicFields,
      phone: phone || base.verifiedClinicFields.phone,
      email: contactEmail || base.verifiedClinicFields.email,
    },
  };
}
