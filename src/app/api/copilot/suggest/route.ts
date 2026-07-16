import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAdmin } from "@/lib/auth";
import { generateCopilotSuggestion } from "@/lib/providers/glm";

const schema = z.object({
  clinicName: z.string().min(1).max(200),
  clinicContext: z.string().max(2000).default(""),
  transcript: z.string().max(6000).default(""),
  question: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  if (!(await getSessionAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const suggestion = await generateCopilotSuggestion(schema.parse(await req.json()));
    return NextResponse.json({ suggestion });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Copilot request failed." }, { status: 502 });
  }
}
