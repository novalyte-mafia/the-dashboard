"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  SectionCard,
  LoadingState,
  StatusBadge,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Flag, Beaker, Rocket, Shield } from "lucide-react";
import { appConfig } from "@/config/app-config";
import { toast } from "sonner";

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  environment: "production" | "staging" | "development";
  source: "config" | "mock";
}

const MOCK_FLAGS: FeatureFlag[] = [
  { id: "directory_public_launch", name: "Directory — Public Launch", description: "Enable public-facing directory pages", enabled: true, environment: "production", source: "mock" },
  { id: "lead_routing_v2", name: "Lead Routing v2", description: "AI-powered multi-factor clinic matching", enabled: true, environment: "staging", source: "mock" },
  { id: "pilot_billing", name: "Pilot Billing Module", description: "Per-lead billing for pilot clinics", enabled: false, environment: "staging", source: "mock" },
  { id: "patient_assessment_v3", name: "Patient Assessment v3", description: "Updated symptoms questionnaire with scoring", enabled: true, environment: "production", source: "mock" },
  { id: "twilio_voice_integration", name: "Twilio Voice Integration", description: "In-app click-to-call via Twilio", enabled: false, environment: "development", source: "mock" },
  { id: "marketplace_checkout_v2", name: "Marketplace Checkout v2", description: "Stripe-powered checkout with Apple Pay", enabled: false, environment: "development", source: "mock" },
  { id: "content_ai_copilot", name: "Content AI Copilot", description: "Inline AI suggestions for article editor", enabled: true, environment: "staging", source: "mock" },
  { id: "audit_log_export", name: "Audit Log CSV Export", description: "Allow CSV export of audit events", enabled: true, environment: "production", source: "mock" },
];

const ENV_TONE: Record<string, string> = {
  production: "rose",
  staging: "amber",
  development: "slate",
};

const ENV_ICON: Record<string, typeof Rocket> = {
  production: Rocket,
  staging: Beaker,
  development: Shield,
};

export function FeatureFlagsView() {
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);

  useEffect(() => {
    // Build flags from appConfig.features + mock flags
    const configFlags: FeatureFlag[] = Object.entries(appConfig.features).map(([key, value]) => ({
      id: key,
      name: prettifyKey(key),
      description: describeConfigFlag(key),
      enabled: Boolean(value),
      environment: "production",
      source: "config",
    }));
    setFlags([...configFlags, ...MOCK_FLAGS]);
    setLoading(false);
  }, []);

  function toggle(id: string) {
    setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));
    const f = flags.find((x) => x.id === id);
    toast.success(`${f?.name ?? "Flag"} ${f?.enabled ? "disabled" : "enabled"}`);
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Feature Flags" description="Toggle features on/off per environment" />
        <LoadingState label="Loading feature flags…" />
      </div>
    );
  }

  const enabled = flags.filter((f) => f.enabled).length;
  const byEnv = (env: string) => flags.filter((f) => f.environment === env);

  return (
    <div>
      <PageHeader
        title="Feature Flags"
        description={`${enabled} of ${flags.length} flags enabled`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {(["production", "staging", "development"] as const).map((env) => {
          const envFlags = byEnv(env);
          const Icon = ENV_ICON[env];
          return (
            <SectionCard
              key={env}
              title={env.charAt(0).toUpperCase() + env.slice(1)}
              description={`${envFlags.filter((f) => f.enabled).length} of ${envFlags.length} enabled`}
              bodyClassName="p-0"
            >
              {envFlags.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4">No flags for this environment.</p>
              ) : (
                <div className="divide-y">
                  {envFlags.map((f) => (
                    <div key={f.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Icon className="size-3.5 text-muted-foreground" />
                          <p className="text-sm font-medium truncate">{f.name}</p>
                          {f.source === "config" && <StatusBadge label="config" color="violet" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{f.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{f.id}</p>
                      </div>
                      <Switch checked={f.enabled} onCheckedChange={() => toggle(f.id)} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          );
        })}
      </div>

      <Card className="p-4 mt-4">
        <div className="flex items-start gap-2.5">
          <Flag className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">About Feature Flags</p>
            <p>
              Flags tagged <StatusBadge label="config" color="violet" /> are defined in <code className="px-1 py-0.5 bg-muted rounded text-[10px]">appConfig.features</code> and reflect
              release gates (e.g. live telephony, AI copilot). Mock flags demonstrate environment-based rollouts.
              In production, toggles persist via the backend settings service.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function prettifyKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function describeConfigFlag(key: string): string {
  switch (key) {
    case "callConsoleLiveAudio":
      return "Live telephony in the call console (Release 2)";
    case "aiCallCopilot":
      return "Realtime AI call coaching & objection suggestions";
    case "liveTranscripts":
      return "Live call transcription during calls";
    default:
      return "Configured feature flag";
  }
}
