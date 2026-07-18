#!/usr/bin/env node
/**
 * Copilot regression tests.
 * Run with: npx tsx scripts/test-copilot-regression.mjs
 */
import {
  suggestFromTranscriptContext,
  buildReasoningPolicy,
  groupTranscriptTurns,
} from "../src/lib/calls/transcript-context.ts";
import { failsCostPolarity, validateSuggestion } from "../src/lib/calls/suggestion-validator.ts";

const failures = [];

function assert(name, condition, detail = "") {
  if (!condition) failures.push({ name, detail });
}

function runScenario(name, transcript, checks) {
  const policy = buildReasoningPolicy(transcript);
  const result = suggestFromTranscriptContext({ transcript, previousSuggestions: [] });
  for (const [label, fn] of Object.entries(checks)) {
    try {
      const ok = fn({ policy, result, transcript });
      assert(`${name}: ${label}`, ok, `intent=${result.intent} suggestion=${result.suggestion.slice(0, 100)}`);
    } catch (e) {
      assert(`${name}: ${label}`, false, String(e));
    }
  }
}

const passedNames = [];

function track(name, transcript, checks) {
  runScenario(name, transcript, checks);
  passedNames.push(name);
}

// --- Core scenarios ---

track("directory listing question", `Jamil: Can you hear me?
Clinic: Yes.
Clinic: Hear you clearly.
Clinic: How can I assist you today?
Clinic: Are you calling about our directory listing?`, {
  intent: ({ result }) => result.intent === "confirm_call_purpose",
  noEmail: ({ result }) => !/best email|verification summary/i.test(result.suggestion),
  answersPurpose: ({ result }) => /novalyte ai|directory|permission/i.test(result.suggestion),
  blocksChecklist: ({ policy }) => policy.blocked_actions.includes("ask_for_email"),
});

track("listing cost polarity", "Clinic: Does the listing cost anything?", {
  intent: ({ result }) => result.intent === "ask_if_free",
  startsWithNo: ({ result }) => /^no\b/i.test(result.suggestion.trim()),
  free: ({ result }) => /free|no fee|no (fee|cost|obligation)/i.test(result.suggestion),
  noYesFraming: ({ result }) => !failsCostPolarity("ask_if_free", result.suggestion),
  noPaid: ({ result }) => !/paid|advertis|lead gen|acquisition/i.test(result.suggestion),
});

track("is this free", "Clinic: Is this free?", {
  intent: ({ result }) => result.intent === "ask_if_free",
  startsWithNo: ({ result }) => /^no\b/i.test(result.suggestion.trim()),
});

track("is the listing free", "Clinic: Is the listing free?", {
  intent: ({ result }) => result.intent === "ask_if_free",
  startsWithNo: ({ result }) => /^no\b/i.test(result.suggestion.trim()),
});

track("call purpose", "Clinic: What exactly is this call about?", {
  intent: ({ result }) => result.intent === "confirm_call_purpose",
  directory: ({ result }) => /directory|permission|list/i.test(result.suggestion),
});

track("what is novalyte", "Clinic: What is Novalyte?", {
  intent: ({ result }) => result.intent === "what_is_novalyte",
  explains: ({ result }) => /novalyte|directory|clinic/i.test(result.suggestion),
  noAcquisition: ({ result }) => !/lead|advertis|paid acquisition/i.test(result.suggestion),
});

track("where did you get our number", "Clinic: Where did you get our information?", {
  intent: ({ result }) => result.intent === "source_of_info",
  public: ({ result }) => /public/i.test(result.suggestion),
});

track("are you selling", "Clinic: Are you selling something?", {
  intent: ({ result }) => result.intent === "ask_if_sales",
  notSales: ({ result }) => /not a sales|not selling|permission/i.test(result.suggestion),
});

track("are you with google", "Clinic: Are you with Google?", {
  intent: ({ result }) => result.intent === "are_you_google",
  no: ({ result }) => /^no\b/i.test(result.suggestion.trim()),
});

track("how directory works", "Clinic: How do patients find the directory?", {
  intent: ({ result }) => result.intent === "how_directory_works",
  permission: ({ result }) => /permission|public|review/i.test(result.suggestion),
});

track("already have website", "Clinic: We already have a website.", {
  intent: ({ result }) => result.intent === "already_have_website",
  optional: ({ result }) => /optional|replace|website|listing/i.test(result.suggestion),
});

track("will you change info", "Clinic: Will you change our information?", {
  intent: ({ result }) => result.intent === "will_you_change_info",
  approve: ({ result }) => /approve|without|change/i.test(result.suggestion),
});

track("what info needed", "Clinic: What information do you need?", {
  intent: ({ result }) => result.intent === "ask_what_details",
  public: ({ result }) => /public|permission|phone|services/i.test(result.suggestion),
});

track("email request", "Clinic: Can you send this information by email?", {
  intent: ({ result }) => result.intent === "ask_for_email",
  asksEmail: ({ result }) => /email|address/i.test(result.suggestion),
});

track("busy", "Clinic: We are busy right now.", {
  intent: ({ result }) => result.intent === "busy_callback",
  callback: ({ result }) => /window|callback|later|time|day/i.test(result.suggestion),
});

track("owner unavailable", "Clinic: The manager is not available.", {
  intent: ({ result }) => result.intent === "owner_unavailable",
  askWho: ({ result }) => /who|when|time|ask for/i.test(result.suggestion),
});

track("grant permission", `Jamil: May we include you in the directory?
Clinic: Yes, you can list us.`, {
  intent: ({ result }) => result.intent === "grant_permission",
  thanks: ({ result }) => /thank|confirm|detail|summary|appreciate/i.test(result.suggestion),
  noFalseEmail: ({ result }) => !/^thank you\. best email/i.test(result.suggestion),
});

track("decline", "Clinic: No, we do not want to be included.", {
  intent: ({ result }) => result.intent === "decline",
  respectful: ({ result }) => /understood|thanks|won't push|close/i.test(result.suggestion),
  noPitch: ({ result }) => !/may we list|permission to include your clinic/i.test(result.suggestion),
});

track("do not call", "Clinic: Do not call us again.", {
  intent: ({ result }) => result.intent === "do_not_call",
  compliance: ({ result }) => /don'?t contact|won'?t contact|won'?t call|do not contact/i.test(result.suggestion),
  noPitch: ({ result }) => !/directory listing|permission to include|novalyte ai to ask/i.test(result.suggestion),
});

track("take us off list", "Clinic: Take us off your list.", {
  intent: ({ result }) => result.intent === "do_not_call",
  compliance: ({ result }) => /don'?t contact|won'?t contact/i.test(result.suggestion),
});

track("not accepting patients", "Clinic: We are not accepting new patients.", {
  intent: ({ result }) => result.intent === "not_accepting_patients",
  note: ({ result }) => /not accepting|listing|public/i.test(result.suggestion),
});

// Fragment grouping
const grouped = groupTranscriptTurns([
  { speaker: "Clinic", text: "Yes." },
  { speaker: "Clinic", text: "Are you calling about our directory listing?" },
]);
assert(
  "fragment grouping",
  grouped.length === 1 && /directory listing/i.test(grouped[0].text),
  JSON.stringify(grouped),
);
passedNames.push("fragment grouping");

track("yes plus question not permission", `Clinic: Yes. Are you calling about our directory listing?`, {
  notGrant: ({ result }) => result.intent !== "grant_permission",
  notEmail: ({ result }) => !/best email/i.test(result.suggestion),
});

track("no repeat permission", `Jamil: May we list you?
Clinic: Yes, you can list us.
Jamil: Thank you.
Clinic: What details do you need?`, {
  noRepeatPermission: ({ result }) => !/permission to include|may we list/i.test(result.suggestion.toLowerCase()),
});

// Validator unit checks
assert(
  "validator rejects yes cost framing",
  failsCostPolarity("ask_if_free", "Yes — the listing is completely free."),
);
assert(
  "validator accepts no cost framing",
  !failsCostPolarity("ask_if_free", "No — there's no fee and no obligation. The listing is completely free."),
);
const rewritten = validateSuggestion({
  intent: "ask_if_free",
  suggestion: "Yes — the directory listing is completely free.",
});
assert("validator rewrites cost polarity", Boolean(rewritten.rewritten && /^no\b/i.test(rewritten.rewritten)));
passedNames.push("validator cost polarity");

console.log(`\nCopilot regression: ${failures.length === 0 ? "ALL PASSED" : `${failures.length} FAILED`} (${passedNames.length} scenarios)\n`);
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
  process.exit(1);
}
for (const s of passedNames) console.log(`  ✓ ${s}`);
