/**
 * Deterministic speakable responses for founder-led directory-permission calls.
 * Primary lines must be short enough to read aloud under pressure.
 */

import type { ExtractedClinicFacts, QuestionIntent } from "./copilot-types";

export type CopilotResponseBundle = {
  intent: QuestionIntent;
  primary: string;
  shorter: string;
  askNext: string | null;
  doNotSay: string[];
  freezeRecovery: string;
  reason: string;
};

const DO_NOT_SAY_DEFAULT = [
  "paid advertising / patient acquisition / lead packages",
  "pricing, contracts, or partnerships",
  "claiming the clinic is already listed or that patients are ready",
];

const FREEZE = {
  clarify: "Let me say that more clearly.",
  repeat: "Sorry — could you repeat that?",
  unsure: "I don't want to give you the wrong information — let me confirm and follow up.",
  understand: "Just to make sure I understood you correctly…",
  pause: "One moment — I want to answer that accurately.",
};

function bundle(
  intent: QuestionIntent,
  primary: string,
  shorter: string,
  reason: string,
  extras?: Partial<Pick<CopilotResponseBundle, "askNext" | "doNotSay" | "freezeRecovery">>,
): CopilotResponseBundle {
  return {
    intent,
    primary,
    shorter,
    askNext: extras?.askNext ?? null,
    doNotSay: extras?.doNotSay ?? DO_NOT_SAY_DEFAULT,
    freezeRecovery: extras?.freezeRecovery ?? FREEZE.clarify,
    reason,
  };
}

export function openingLine(): CopilotResponseBundle {
  return bundle(
    "smalltalk_or_greeting",
    "Hi — this is Jamil with Novalyte AI. I'm calling to ask permission to include your clinic in our free men's health directory. Do you have about two minutes?",
    "Hi, Jamil with Novalyte AI — quick call about a free directory listing for your clinic. Is now okay?",
    "Pre-call opening: free directory permission only.",
    { freezeRecovery: FREEZE.pause },
  );
}

function formatPhone(digits?: string): string {
  if (!digits) return "";
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

export function responseForIntent(
  intent: QuestionIntent,
  facts: ExtractedClinicFacts,
  previousSuggestions: string[] = [],
): CopilotResponseBundle {
  const previous = previousSuggestions.map((s) => s.toLowerCase());
  const pick = (a: CopilotResponseBundle, b: CopilotResponseBundle) => {
    const key = a.primary.slice(0, 45).toLowerCase();
    if (previous.some((p) => p.includes(key) || a.primary.toLowerCase().includes(p.slice(0, 45)))) {
      return b;
    }
    return a;
  };

  switch (intent) {
    case "confirm_call_purpose":
      return pick(
        bundle(
          intent,
          "Yes — I'm calling from Novalyte AI about permission to include your clinic in our free men's health directory and confirm a few public details before anything is published.",
          "Yes — Novalyte AI, free directory listing permission for your clinic.",
          "Clinic asked what the call is about; answer purpose only.",
        ),
        bundle(
          intent,
          "This is about a free Novalyte AI directory listing — I'm only asking permission to include your public clinic details.",
          "Free Novalyte directory listing permission — that's it for this call.",
          "Alternate purpose answer.",
        ),
      );

    case "ask_if_free":
      // Polarity: cost questions must begin with No.
      return pick(
        bundle(
          intent,
          "No — there's no fee and no obligation. The listing is completely free.",
          "No — the listing is free; no fee or obligation.",
          "Cost question: negative polarity required, then free confirmation.",
          {
            doNotSay: [...DO_NOT_SAY_DEFAULT, 'starting with "Yes" on a cost question', "any fee, charge, or paid listing"],
            freezeRecovery: FREEZE.clarify,
          },
        ),
        bundle(
          intent,
          "No cost at all — it's a free listing. I only need permission to include your public details.",
          "No cost — free listing, permission only.",
          "Alternate free confirmation without Yes-framing.",
        ),
      );

    case "ask_if_sales":
      return bundle(
        intent,
        "Not a sales call — I'm only asking permission for a free directory listing and to confirm a few public details.",
        "No — not selling anything today; just free directory permission.",
        "Clinic asked if this is a sales call.",
        { doNotSay: [...DO_NOT_SAY_DEFAULT, "pivoting into an offer"] },
      );

    case "what_is_novalyte":
      return bundle(
        intent,
        "Novalyte AI helps men find verified men's health clinics. I'm only calling about listing your clinic in our free directory.",
        "Novalyte helps men find men's health clinics — this call is only about a free listing.",
        "Clinic asked what Novalyte is.",
      );

    case "source_of_info":
      return bundle(
        intent,
        "From public clinic information online. I'm only confirming whether you'd like to be included in the free directory.",
        "Public information online — checking if you want to be listed for free.",
        "Clinic asked where we got their information.",
      );

    case "how_directory_works":
      return bundle(
        intent,
        "We show public clinic details so patients can find providers. Nothing goes live without your permission, and you can review before it's published.",
        "Public details only, with your permission, and you review before it goes live.",
        "Clinic asked how the directory works.",
      );

    case "are_you_google":
      return bundle(
        intent,
        "No — I'm with Novalyte AI. This is only about a free listing in our men's health directory.",
        "No, Novalyte AI — free men's health directory listing only.",
        "Clinic asked if we are Google or similar.",
      );

    case "already_have_website":
      return bundle(
        intent,
        "Understood — this wouldn't replace your website. It's just an optional free directory listing that points people to your public details.",
        "Got it — optional free listing only; it doesn't replace your site.",
        "Clinic said they already have a website.",
      );

    case "will_you_change_info":
      return bundle(
        intent,
        "We only use the public details you approve — we won't change your information without checking with you.",
        "Only approved public details; we won't change anything without you.",
        "Clinic asked whether we will change their information.",
      );

    case "ask_hipaa":
      return bundle(
        intent,
        "For the free listing we only use public clinic information — we don't need any patient records.",
        "Public details only — no patient records.",
        "Clinic raised privacy/HIPAA concern.",
      );

    case "ask_for_email":
      return bundle(
        intent,
        "Happy to email it — what's the best address, and who should I send it to?",
        "Sure — best email, and who should get it?",
        "Clinic asked to receive information by email.",
        { askNext: "Confirm spelling of the email before ending.", freezeRecovery: FREEZE.understand },
      );

    case "ask_what_details":
      if (facts.permissionGranted) {
        if (!facts.phone) {
          return bundle(
            intent,
            "Just a few public items — what's the best phone number to show on the listing?",
            "What's the best public phone number for the listing?",
            "Permission granted; collect phone next.",
          );
        }
        if (!facts.services) {
          return bundle(
            intent,
            "Got it — what core services should we show, like TRT or telehealth?",
            "Which services should appear on the listing?",
            "Permission granted; collect services next.",
          );
        }
        if (facts.acceptingNewPatients === undefined) {
          return bundle(
            intent,
            "Perfect — are you accepting new patients right now?",
            "Are you taking new patients currently?",
            "Permission granted; collect accepting status.",
          );
        }
        return bundle(
          intent,
          "That's everything I need — I'll send a short summary for you to review before anything goes live. What's the best email for that?",
          "I'll email a summary for review — best email?",
          "Details complete; confirm email for summary.",
        );
      }
      return bundle(
        intent,
        "Mainly permission to list your public clinic details, plus phone, services, and whether you're accepting new patients.",
        "Permission, plus public phone, services, and new-patient status.",
        "Clinic asked what information is needed before permission.",
      );

    case "busy_callback":
      return bundle(
        intent,
        "Understood — what day or time works better for a two-minute call?",
        "No problem — when is a better quick window?",
        "Clinic is busy; schedule callback.",
        { freezeRecovery: FREEZE.understand },
      );

    case "owner_unavailable":
      return bundle(
        intent,
        "No problem — who should I ask for about the listing, and when's a better time to reach them?",
        "Who handles listings, and when should I call back?",
        "Decision-maker unavailable.",
      );

    case "decline":
      return bundle(
        intent,
        "Understood — thanks for your time. I'll close this out and won't push further.",
        "Understood — I won't push. Thanks for your time.",
        "Clinic declined; exit without persuasion.",
        {
          doNotSay: [...DO_NOT_SAY_DEFAULT, "continuing to pitch", "asking for email unsolicited after a clear no"],
          freezeRecovery: FREEZE.understand,
        },
      );

    case "do_not_call":
      return bundle(
        intent,
        "Understood. I'll make sure we don't contact you again about this.",
        "Understood — we won't contact you again.",
        "Do-not-call / remove request; compliance close only.",
        {
          doNotSay: [...DO_NOT_SAY_DEFAULT, "any further pitch", "asking for email", "directory explanation"],
          freezeRecovery: FREEZE.understand,
        },
      );

    case "grant_permission":
      return pick(
        bundle(
          intent,
          "Thank you — I'll confirm just a couple of public details, then send a summary before anything goes live. What's the best public phone number to list?",
          "Thank you — what's the best public phone number to list?",
          "Permission granted; move to public details.",
          { askNext: "Services and accepting-new-patients after phone." },
        ),
        bundle(
          intent,
          "Appreciate it — let me confirm a couple public details before it's published. What's the best public phone number?",
          "Appreciate it — best public phone number?",
          "Alternate grant acknowledgment.",
        ),
      );

    case "provide_info":
      return acknowledgeBundle(facts);

    case "not_accepting_patients":
      return bundle(
        intent,
        "Got it — we can note that you're not accepting new patients right now on the listing. Is it still okay to include your public details?",
        "Understood — we can show not accepting new patients. Okay to still list public details?",
        "Clinic said they are not accepting new patients.",
      );

    case "smalltalk_or_greeting":
      return openingLine();

    case "unknown":
    default:
      if (facts.permissionGranted) return acknowledgeBundle(facts);
      return bundle(
        intent,
        "Just to make sure I answer you accurately — are you asking about the free directory listing, or something else?",
        "Quick clarify — is this about the free directory listing?",
        "Unknown intent: ask a safe clarification instead of guessing.",
        { freezeRecovery: FREEZE.unsure },
      );
  }
}

function acknowledgeBundle(facts: ExtractedClinicFacts): CopilotResponseBundle {
  const parts: string[] = [];
  if (facts.phone) parts.push(formatPhone(facts.phone));
  if (facts.services) parts.push(facts.services);
  if (facts.acceptingNewPatients === true) parts.push("accepting new patients");
  if (facts.acceptingNewPatients === false) parts.push("not taking new patients right now");
  const ack = parts.length ? `Got it — ${parts.join(", ")}.` : "Got it.";

  if (!facts.phone) {
    return bundle(
      "provide_info",
      `${ack} What's the best public phone number to list?`,
      `${ack} And the public phone number?`,
      "Acknowledge provided info; collect phone.",
    );
  }
  if (!facts.services) {
    return bundle(
      "provide_info",
      `${ack} What core services should we show on the listing?`,
      `${ack} What services should we list?`,
      "Acknowledge provided info; collect services.",
    );
  }
  if (facts.acceptingNewPatients === undefined) {
    return bundle(
      "provide_info",
      `${ack} Are you accepting new patients right now?`,
      `${ack} Accepting new patients currently?`,
      "Acknowledge provided info; collect accepting status.",
    );
  }
  if (!facts.permissionGranted) {
    return bundle(
      "provide_info",
      `${ack} Do we have your permission to include those public details in the free directory?`,
      `${ack} Okay to list those public details?`,
      "Details known; ask permission explicitly.",
    );
  }
  return bundle(
    "provide_info",
    `${ack} I'll send a short summary for review before anything goes live. Best email for that?`,
    `${ack} Best email for a quick summary?`,
    "Details + permission present; confirm email for summary.",
  );
}

/** Always-visible emergency card for the founder UI. */
export function emergencyFallbackCard() {
  return {
    opening: openingLine().primary,
    cost: responseForIntent("ask_if_free", emptyFacts()).primary,
    dnc: responseForIntent("do_not_call", emptyFacts()).primary,
    freeze: FREEZE.clarify,
    decline: responseForIntent("decline", emptyFacts()).primary,
  };
}

function emptyFacts(): ExtractedClinicFacts {
  return {
    permissionGranted: false,
    permissionDeclined: false,
    rawClinicText: "",
  };
}
