import type { KnowledgeCategory } from "./types";

const INTENT_PATTERNS: Array<{ categories: KnowledgeCategory[]; pattern: RegExp; weight: number }> = [
  { categories: ["clinic_directory"], pattern: /\b(free|fee|fees|cost|charge|catch|pay|pricing)\b/i, weight: 3 },
  { categories: ["clinic_outreach", "company_identity"], pattern: /\b(why.*call|why are you calling|reason.*call|what do you want)\b/i, weight: 3 },
  { categories: ["company_identity"], pattern: /\b(what is novalyte|who is novalyte|novolyte|novolite|novolight|what do you do)\b/i, weight: 3 },
  { categories: ["clinic_directory"], pattern: /\b(directory|listing|list us|profile|listed)\b/i, weight: 2 },
  { categories: ["objection_handling"], pattern: /\b(sales call|selling|marketing|spam|didn't request|did not request)\b/i, weight: 3 },
  { categories: ["patient_acquisition", "compliance"], pattern: /\b(guarantee|guaranteed|how many patients|bring.*patients|patient volume)\b/i, weight: 3 },
  { categories: ["patient_acquisition"], pattern: /\b(patient|leads|referral|acquisition|bookings)\b/i, weight: 2 },
  { categories: ["compliance"], pattern: /\b(hipaa|patient records|medical records|privacy|phi)\b/i, weight: 3 },
  { categories: ["objection_handling"], pattern: /\b(send.*email|email me|mail me)\b/i, weight: 3 },
  { categories: ["objection_handling"], pattern: /\b(busy|bad time|call back|not a good time)\b/i, weight: 3 },
  { categories: ["objection_handling"], pattern: /\b(not interested|no thanks|don't call)\b/i, weight: 3 },
  { categories: ["objection_handling"], pattern: /\b(enough patients|full|booked|no room)\b/i, weight: 3 },
  { categories: ["objection_handling", "qualification"], pattern: /\b(owner|manager|doctor|decision maker|not here|unavailable)\b/i, weight: 2 },
  { categories: ["clinic_directory"], pattern: /\b(review.*first|remove|take down|approve.*listing)\b/i, weight: 2 },
  { categories: ["clinic_services"], pattern: /\b(advertising|agency|paid|performance|marketplace|workforce)\b/i, weight: 2 },
  { categories: ["qualification"], pattern: /\b(permission|yes.*list|go ahead|sounds good)\b/i, weight: 2 },
  { categories: ["qualification"], pattern: /\b(what.*need|information|verify|confirm.*details)\b/i, weight: 2 },
];

export function detectKnowledgeCategories(query: string, stage?: string): KnowledgeCategory[] {
  const text = `${query} ${stage ?? ""}`.toLowerCase();
  const scores = new Map<KnowledgeCategory, number>();

  for (const intent of INTENT_PATTERNS) {
    if (!intent.pattern.test(text)) continue;
    for (const category of intent.categories) {
      scores.set(category, (scores.get(category) ?? 0) + intent.weight);
    }
  }

  if (scores.size === 0) {
    return ["clinic_outreach", "clinic_directory", "qualification"];
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([category]) => category);
}

export function tokenizeForSearch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}
