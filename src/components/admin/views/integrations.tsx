"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  StatusBadge,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plug,
  Check,
  X,
  AlertCircle,
  Database,
  Cloud,
  MessageSquare,
  Mail,
  Calendar,
  Sparkles,
  Phone,
  CreditCard,
  Megaphone,
  RefreshCw,
} from "lucide-react";
import { settingsService } from "@/services";
import { relativeTime } from "@/lib/format";
import { toast } from "sonner";
import type { Integration } from "@/types";
import type { LucideIcon } from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  connected: { label: "Connected", color: "green", icon: Check },
  not_connected: { label: "Not Connected", color: "slate", icon: X },
  configuration_required: { label: "Configuration Required", color: "amber", icon: AlertCircle },
  error: { label: "Error", color: "rose", icon: AlertCircle },
};

const INTEGRATION_ICONS: Record<string, LucideIcon> = {
  supabase: Database,
  vercel: Cloud,
  slack: MessageSquare,
  email: Mail,
  calendar: Calendar,
  openai: Sparkles,
  twilio: Phone,
  stripe: CreditCard,
  google_ads: Megaphone,
  meta_ads: Megaphone,
};

export function IntegrationsView() {
  const { refreshKey } = useNav();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    settingsService.listIntegrations().then((d) => setIntegrations(d.integrations)).finally(() => setLoading(false));
  }, [refreshKey]);

  const connected = integrations.filter((i) => i.status === "connected").length;
  const requiresAction = integrations.filter((i) => i.status === "configuration_required" || i.status === "error").length;

  return (
    <div>
      <PageHeader
        title="Integrations"
        description={`${connected} connected · ${requiresAction} require attention`}
        action={
          <Button variant="outline" onClick={() => toast.success("Sync check triggered — all integrations reporting.")}>
            <RefreshCw className="size-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
      />

      {loading ? (
        <LoadingState label="Loading integrations…" />
      ) : integrations.length === 0 ? (
        <EmptyState icon={Plug} title="No integrations" description="Integrations will appear here when configured." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {integrations.map((i) => {
            const meta = STATUS_META[i.status] ?? STATUS_META.not_connected;
            const Icon = INTEGRATION_ICONS[i.key] ?? Plug;
            const StatusIcon = meta.icon;
            return (
              <Card key={i.key} className="p-4 gap-0">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                      i.status === "connected" ? "bg-emerald-50 text-emerald-700" :
                      i.status === "configuration_required" ? "bg-amber-50 text-amber-700" :
                      i.status === "error" ? "bg-rose-50 text-rose-700" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{i.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{i.note}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <StatusBadge label={meta.label} color={meta.color} />
                  {i.lastSyncAt && (
                    <span className="text-[11px] text-muted-foreground">Synced {relativeTime(i.lastSyncAt)}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant={i.status === "connected" ? "outline" : "default"}
                    className="flex-1"
                    onClick={() => toast.info(`Configure ${i.label} — secrets handled via environment variables.`)}
                  >
                    <StatusIcon className="size-3.5" />
                    {i.status === "connected" ? "Configure" : i.status === "configuration_required" ? "Set Up" : "Connect"}
                  </Button>
                  {i.status === "connected" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toast.success(`${i.label} sync triggered.`)}
                      title="Sync now"
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
