/**
 * Extract what the clinic already said so the copilot never re-asks answered questions.
 * Used by both the live API path and the offline field-guide fallback.
 */

export type ExtractedClinicFacts = {
  phone?: string;
  services?: string;
  acceptingNewPatients?: boolean;
  permissionGranted?: boolean;
  permissionDeclined?: boolean;
  askedForEmail?: boolean;
  askedWhyCalling?: boolean;
  askedIfFree?: boolean;
  askedIfSales?: boolean;
  busy?: boolean;
  ownerUnavailable?: boolean;
  rawClinicText: string;
};

export function extractClinicFacts(transcript: string): ExtractedClinicFacts {
  const clinicLines = transcript
    .split("\n")
    .filter((l) => /^clinic\s*:/i.test(l.trim()) || (!/^jamil\s*:/i.test(l.trim()) && !/^coach\s*:/i.test(l.trim())))
    .map((l) => l.replace(/^clinic\s*:\s*/i, "").trim())
    .filter(Boolean);

  // Also accept plain transcript blobs without speaker labels
  const clinicText =
    clinicLines.length > 0
      ? clinicLines.join(" ")
      : transcript.replace(/^jamil\s*:.*$/gim, "").replace(/^coach\s*:.*$/gim, "").trim();

  const lower = clinicText.toLowerCase();

  const phoneMatch =
    clinicText.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/) ||
    clinicText.match(/(?:number\s+(?:is\s+)?|phone\s+(?:is\s+)?)([\d\s().-]{7,})/i);

  // Digit-spaced phone: "4 1 0 5 5 5 7 8 9 0"
  const spacedDigits = clinicText.match(/(?:\b\d\b[\s.,-]*){7,}/);
  let phone: string | undefined;
  if (phoneMatch) {
    phone = phoneMatch[0].replace(/\D/g, "").slice(-10);
  } else if (spacedDigits) {
    const digits = spacedDigits[0].replace(/\D/g, "");
    if (digits.length >= 7) phone = digits.slice(-10);
  }

  let services: string | undefined;
  if (/\b(trt|telehealth|glp-?1|hormone|medical spa|spa treatments?|weight loss|hair)\b/i.test(clinicText)) {
    const svc = clinicText.match(
      /\b(?:offer|provide|do|specialize in)\s+([^.?!]{4,80})/i,
    );
    services = svc?.[1]?.trim() || clinicText.match(/\b(trt|telehealth|glp-?1|hormone(?:\s+optimization)?|medical spa(?: treatments?)?|weight loss|hair)\b/i)?.[0];
  }

  let acceptingNewPatients: boolean | undefined;
  if (/\b(accept|taking|see)\s+(new\s+)?patients?\b/i.test(lower) && /\b(yes|we do|we are|currently)\b/i.test(lower)) {
    acceptingNewPatients = true;
  } else if (/\b(yes[,.]?\s+we\s+(do\s+)?accept)\b/i.test(lower)) {
    acceptingNewPatients = true;
  } else if (/\b(not accepting|no new patients|waitlist|fully booked)\b/i.test(lower)) {
    acceptingNewPatients = false;
  }

  const permissionGranted =
    /\b(you can list|go ahead and list|permission to list|list us|include us|sounds good|that's fine)\b/i.test(lower) ||
    (/\b(yes|okay|ok|sure)\b/i.test(lower) && /\b(list|listing|directory|publish|include)\b/i.test(lower));

  return {
    phone: phone && phone.length >= 7 ? phone : undefined,
    services,
    acceptingNewPatients,
    permissionGranted,
    permissionDeclined: /\b(not interested|no thanks|don't call|do not list|don't list)\b/i.test(lower),
    askedForEmail: /\b(email|send me|send us|mail)\b/i.test(lower),
    askedWhyCalling: /\b(why.*(call|calling)|reason for (this )?call)\b/i.test(lower),
    askedIfFree: /\b(free|fee|cost|charge|catch|pay)\b/i.test(lower),
    askedIfSales: /\b(sales|selling|marketing|spam|solicitation)\b/i.test(lower),
    busy: /\b(busy|bad time|call back|not a good time)\b/i.test(lower),
    ownerUnavailable: /\b(owner|manager|doctor).*(not|unavailable|out)|not (here|available)\b/i.test(lower),
    rawClinicText: clinicText,
  };
}

function formatPhone(digits: string): string {
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

/**
 * Next spoken line grounded in what the clinic already said.
 * Never re-asks answered checklist items.
 */
export function suggestFromTranscriptContext(input: {
  transcript: string;
  latestClinicUtterance?: string;
  previousSuggestions?: string[];
}): { suggestion: string; facts: ExtractedClinicFacts; answered: string[] } {
  const facts = extractClinicFacts(input.transcript);
  const latest = (input.latestClinicUtterance || facts.rawClinicText).toLowerCase();
  const answered: string[] = [];
  if (facts.phone) answered.push("phone");
  if (facts.services) answered.push("services");
  if (facts.acceptingNewPatients !== undefined) answered.push("accepting_patients");

  const previous = (input.previousSuggestions ?? []).map((s) => s.toLowerCase());

  const pick = (line: string) => {
    // Avoid repeating recent suggestions
    if (previous.some((p) => p.includes(line.slice(0, 40).toLowerCase()) || line.toLowerCase().includes(p.slice(0, 40)))) {
      return null;
    }
    return line;
  };

  // Direct questions first
  if (facts.askedIfFree || /\b(free|fee|cost|catch)\b/i.test(latest)) {
    return {
      suggestion: pick("Yep — the directory listing is free. No fee and no obligation.") ||
        "Yep — free listing, no fee.",
      facts,
      answered,
    };
  }
  if (facts.askedIfSales || /\b(sales|selling)\b/i.test(latest)) {
    return {
      suggestion: pick("Not a sales call — I'm just asking permission to list your public clinic details in our free directory.") ||
        "Just directory permission today — nothing paid.",
      facts,
      answered,
    };
  }
  if (facts.askedWhyCalling) {
    return {
      suggestion: pick("Calling about your free Novalyte AI directory listing — can I confirm a couple public details?") ||
        "It's about a free directory listing for your clinic.",
      facts,
      answered,
    };
  }
  if (facts.askedForEmail) {
    return {
      suggestion: pick("Sure — what's the best email, and who handles the clinic listing?") ||
        "Happy to email that. Best address?",
      facts,
      answered,
    };
  }
  if (facts.busy) {
    return {
      suggestion: pick("Totally — when’s a better two-minute window?") ||
        "No problem — better day or time?",
      facts,
      answered,
    };
  }
  if (facts.ownerUnavailable) {
    return {
      suggestion: pick("Got it. Who handles the listing, and when’s a good time to reach them?") ||
        "Who should I ask for on the listing decision?",
      facts,
      answered,
    };
  }
  if (facts.permissionDeclined) {
    return {
      suggestion: pick("Understood — I’ll leave it there. Want a one-page email anyway, or prefer no follow-up?") ||
        "Understood. I’ll close the file unless you’d like an email.",
      facts,
      answered,
    };
  }

  // Clinic just gave facts — acknowledge and move forward
  if (facts.phone && facts.services && facts.acceptingNewPatients === true) {
    return {
      suggestion:
        pick(
          `Perfect — got ${formatPhone(facts.phone)}, ${facts.services}, and you’re accepting new patients. Do we have permission to list those public details?`,
        ) ||
        "Got it — phone, services, and accepting patients. Permission to list those public details?",
      facts,
      answered,
    };
  }

  if (facts.phone && facts.acceptingNewPatients === true && !facts.services) {
    return {
      suggestion:
        pick(`Thanks — ${formatPhone(facts.phone)}, and you are accepting new patients. What core services should we list?`) ||
        "Thanks — phone and accepting patients noted. What services should we list?",
      facts,
      answered,
    };
  }

  if (facts.phone && facts.services && facts.acceptingNewPatients === undefined) {
    return {
      suggestion:
        pick(`Got ${formatPhone(facts.phone)} and ${facts.services}. Are you accepting new patients right now?`) ||
        "Got phone and services. Accepting new patients?",
      facts,
      answered,
    };
  }

  if (facts.acceptingNewPatients === true && !facts.phone) {
    return {
      suggestion:
        pick("Great that you’re accepting new patients. What’s the best public phone number for the listing?") ||
        "Thanks — and the public phone for the listing?",
      facts,
      answered,
    };
  }

  if (facts.phone && !facts.services) {
    return {
      suggestion:
        pick(`Thanks — ${formatPhone(facts.phone)}. What services should we show on the listing?`) ||
        "Thanks for the number. What services should we list?",
      facts,
      answered,
    };
  }

  if (facts.services && !facts.phone) {
    return {
      suggestion:
        pick(`Got it — ${facts.services}. What’s the public phone number for the listing?`) ||
        "Thanks. What’s the public phone for the listing?",
      facts,
      answered,
    };
  }

  if (facts.permissionGranted) {
    return {
      suggestion:
        pick("Thank you. Best email for the verification summary before anything goes live?") ||
        "Appreciate it — best email for the verification link?",
      facts,
      answered,
    };
  }

  // Default: ask only for the next missing item — never the full checklist dump
  if (!facts.phone) {
    return {
      suggestion: pick("What’s the best public phone number for the listing?") ||
        "Best public phone for the listing?",
      facts,
      answered,
    };
  }
  if (!facts.services) {
    return {
      suggestion: pick("What core services should we list?") || "What services should we show?",
      facts,
      answered,
    };
  }
  if (facts.acceptingNewPatients === undefined) {
    return {
      suggestion: pick("Are you accepting new patients right now?") || "Accepting new patients?",
      facts,
      answered,
    };
  }

  return {
    suggestion: pick("Do we have permission to include those public details in the free directory?") ||
      "Permission to list those public details?",
    facts,
    answered,
  };
}
