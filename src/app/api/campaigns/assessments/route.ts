import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { listAssessmentTemplates } from "@/lib/campaigns/store";

export async function GET() {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const assessments = await listAssessmentTemplates();
    return NextResponse.json({ assessments });
  } catch (error) {
    console.error("campaign assessments list", error);
    const message = error instanceof Error ? error.message : "Unable to load assessments.";
    if (/does not exist|relation/i.test(message)) {
      return NextResponse.json({ assessments: [] });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
