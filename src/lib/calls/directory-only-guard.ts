/** Blocks paid-acquisition language from copilot suggestions during directory-permission calls. */

const PROHIBITED_DIRECTORY_CALL_PATTERNS = [
  /\b(paid|pay-per|performance-based)\s+(lead|patient|acquisition|campaign|service)/i,
  /\b(advertising|ad spend|marketing package|lead generation|lead gen)\b/i,
  /\b(patient acquisition|paid leads|paid patient|commercial offer)\b/i,
  /\b\d+\s*(patients?|leads?)\s*(per|a)\s*(month|week)\b/i,
  /\b(pilot|roi|revenue|bookings?)\s+(fee|channel|campaign)\b/i,
  /\boptional paid\b/i,
  /\bmarketplace\b/i,
  /\bworkforce\b/i,
];

export function containsProhibitedCommercialLanguage(text: string): boolean {
  return PROHIBITED_DIRECTORY_CALL_PATTERNS.some((p) => p.test(text));
}

export function sanitizeDirectoryOnlySuggestion(text: string): string {
  if (!containsProhibitedCommercialLanguage(text)) return text;
  return "This call is only about requesting permission for your free Novalyte AI directory listing — there's no paid service involved today.";
}

export const DIRECTORY_ONLY_COPILOT_RULES = `
NON-NEGOTIABLE CALL OBJECTIVE:
- This call is ONLY to request permission to include the clinic in the Novalyte AI directory and verify basic listing information.
- NEVER mention paid acquisition, advertising, paid services, patient-acquisition packages, lead generation, or future commercial offers.
- NEVER suggest paid services as a next step, even optionally.
- If asked whether Novalyte AI is selling something: explain this specific call is only about directory listing permission.
- Jamil is the caller. You are a silent internal coach — suggest what Jamil should say, never speak as the clinic.
- Success = reach correct person, explain directory, get permission, verify details, agree follow-up.
`.trim();
