import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { getAssessmentTemplate } from "@/lib/campaigns/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSessionAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const template = await getAssessmentTemplate(id);
    if (!template) {
      return NextResponse.json({ error: "Assessment template not found." }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (error) {
    console.error("campaign assessment get", error);
    const message = error instanceof Error ? error.message : "Unable to load assessment.";
    if (/does not exist|relation/i.test(message)) {
      return NextResponse.json({ error: "Assessment templates not configured." }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
