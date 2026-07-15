import { NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import { PIPELINE_STAGES, CALL_OUTCOMES, FOLLOWUP_TYPES, DEAL_STAGES, SERVICE_CATALOG, PRIORITIES, DIRECTORY_STAGES, CONTACT_TYPES, US_TIMEZONES } from "@/lib/constants";

export async function GET() {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    config: {
      pipelineStages: PIPELINE_STAGES,
      callOutcomes: CALL_OUTCOMES,
      followUpTypes: FOLLOWUP_TYPES,
      dealStages: DEAL_STAGES,
      services: SERVICE_CATALOG,
      priorities: PRIORITIES,
      directoryStages: DIRECTORY_STAGES,
      contactTypes: CONTACT_TYPES,
      timezones: US_TIMEZONES,
    },
    integrations: [
      { key: "supabase", label: "Supabase", status: "connected", note: "Database & auth" },
      { key: "vercel", label: "Vercel", status: "connected", note: "Deployment" },
      { key: "slack", label: "Slack", status: "configuration_required", note: "Notifications" },
      { key: "email", label: "Email Provider", status: "configuration_required", note: "Transactional email" },
      { key: "calendar", label: "Calendar", status: "not_connected", note: "Meeting sync" },
      { key: "openai", label: "OpenAI", status: "not_connected", note: "Call Copilot (Release 2)" },
    ],
  });
}
