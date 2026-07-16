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
      { key: "slack", label: "Slack", status: process.env.SLACK_ANALYTICS_WEBHOOK_URL ? "connected" : "configuration_required", note: "Conversion alerts" },
      { key: "firecrawl", label: "Firecrawl", status: process.env.FIRECRAWL_API_KEY ? "connected" : "configuration_required", note: "Clinic research" },
      { key: "vapi", label: "Vapi", status: process.env.VAPI_API_KEY && process.env.VAPI_ASSISTANT_ID && process.env.VAPI_PHONE_NUMBER_ID ? "connected" : "configuration_required", note: "Provider-backed calling" },
      { key: "glm", label: "GLM Copilot", status: process.env.GLM_API_KEY ? "connected" : "configuration_required", note: "AI call coaching" },
      { key: "posthog_live", label: "PostHog Live Activity", status: process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID ? "connected" : "configuration_required", note: "Server-side activity feed" },
      { key: "email", label: "Email Provider", status: "configuration_required", note: "Transactional email" },
      { key: "calendar", label: "Calendar", status: "not_connected", note: "Meeting sync" },
      { key: "openai", label: "OpenAI", status: "not_connected", note: "Call Copilot (Release 2)" },
    ],
  });
}
