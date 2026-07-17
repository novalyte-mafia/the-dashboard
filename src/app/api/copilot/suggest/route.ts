import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { generateCopilotSuggestion, generateFieldGuideSuggestion } from "@/lib/providers/glm";

const schema = z.object({
  clinicName: z.string().min(1).max(200),
  clinicContext: z.string().max(2000).default(""),
  transcript: z.string().max(6000).default(""),
  question: z.string().max(500).optional(),
  stage: z.string().max(200).optional(),
  qualificationSummary: z.string().max(800).optional(),
  missingQualification: z.string().max(800).optional(),
  detectedObjections: z.string().max(800).optional(),
  previousSuggestions: z.string().max(1600).optional(),
});

export async function POST(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid coaching request." }, { status: 400 });
  try {
    const suggestion = await generateCopilotSuggestion(parsed.data);
    return NextResponse.json({ suggestion, source: "ai" });
  } catch {
    return NextResponse.json({ suggestion: generateFieldGuideSuggestion(parsed.data.transcript), source: "field_guide" });
  }
}
