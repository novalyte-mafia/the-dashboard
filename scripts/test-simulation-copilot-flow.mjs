#!/usr/bin/env node
/**
 * Simulates the Vapi practice transcript path + client copilot logic
 * for the screenshot failure scenario.
 */
import { suggestFromTranscriptContext, groupTranscriptTurns } from "../src/lib/calls/transcript-context.ts";

function mergeClinicFragments(fragments) {
  const lines = fragments.map((text, i) => ({
    speaker: i === 0 ? "Jamil" : "Clinic",
    text,
    timestamp: new Date(Date.now() + i * 400).toISOString(),
  }));
  // Vapi handler merges consecutive same-speaker within 2800ms
  const merged = [];
  for (const line of lines) {
    const prev = merged.at(-1);
    if (prev && prev.speaker === line.speaker) {
      prev.text = `${prev.text} ${line.text}`.replace(/\s+/g, " ").trim();
    } else {
      merged.push({ ...line });
    }
  }
  return merged;
}

const fragments = [
  "Can you hear me?",
  "Yes.",
  "Hear you clearly.",
  "How can I assist you today?",
  "Are you calling about our directory listing?",
];

const merged = mergeClinicFragments(fragments);
const transcript = merged.map((l) => `${l.speaker}: ${l.text}`).join("\n");
const grouped = groupTranscriptTurns(merged);

console.log("Merged transcript:\n", transcript);
console.log("\nGrouped clinic turn:", grouped.filter((t) => t.speaker === "Clinic").at(-1)?.text);

const result = suggestFromTranscriptContext({ transcript, previousSuggestions: [] });
console.log("\nIntent:", result.intent);
console.log("Policy:", result.policy.allowed_next_action, "blocked:", result.policy.blocked_actions);
console.log("Suggestion:", result.suggestion);

const ok =
  result.intent === "confirm_call_purpose" &&
  !/best email|verification summary/i.test(result.suggestion) &&
  /novalyte ai|directory|permission/i.test(result.suggestion);

console.log(ok ? "\n✓ SIMULATION FLOW PASS" : "\n✗ SIMULATION FLOW FAIL");
process.exit(ok ? 0 : 1);
