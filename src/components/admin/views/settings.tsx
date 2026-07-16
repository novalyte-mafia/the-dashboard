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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  User,
  Settings as SettingsIcon,
  Bell,
  Plug,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  Lock,
  Clock,
} from "lucide-react";
import { appConfig } from "@/config/app-config";
import { settingsService } from "@/services";
import { PIPELINE_STAGES, DEAL_STAGES, CALL_OUTCOMES, FOLLOWUP_TYPES, SERVICE_CATALOG, PRIORITIES, DIRECTORY_STAGES, CONTACT_TYPES, US_TIMEZONES, ADMIN_ROLES, roleLabel } from "@/lib/constants";
import { initials, fullName, relativeTime } from "@/lib/format";
import { toast } from "sonner";
import type { Integration } from "@/types";

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Check }> = {
  connected: { label: "Connected", color: "green", icon: Check },
  not_connected: { label: "Not Connected", color: "slate", icon: X },
  configuration_required: { label: "Configuration Required", color: "amber", icon: AlertCircle },
  error: { label: "Error", color: "rose", icon: AlertCircle },
};

export function SettingsView() {
  const { admin } = useNav();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifToggles, setNotifToggles] = useState<Record<string, boolean>>({
    "New clinic application": true,
    "New patient inquiry": true,
    "Follow-up overdue": true,
    "Meeting booked": true,
    "Deal stage changed": true,
    "Proposal accepted": true,
    "System error": true,
  });

  useEffect(() => {
    setLoading(true);
    settingsService.listIntegrations().then((d) => setIntegrations(d.integrations)).finally(() => setLoading(false));
  }, []);

  const founder = appConfig.brand.founder;
  const displayName = fullName(founder.firstName, founder.lastName);
  const displayEmail = founder.email;

  if (loading) return (
    <div>
      <PageHeader title="Settings" description="Account, business configuration, notifications & integrations" />
      <LoadingState label="Loading settings…" />
    </div>
  );

  return (
    <div>
      <PageHeader title="Settings" description="Account, business configuration, notifications & integrations" />

      <Tabs defaultValue="account">
        <TabsList className="mb-4">
          <TabsTrigger value="account" className="gap-1.5"><User className="size-3.5" /> Account</TabsTrigger>
          <TabsTrigger value="business" className="gap-1.5"><SettingsIcon className="size-3.5" /> Business</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="size-3.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="integrations" className="gap-1.5"><Plug className="size-3.5" /> Integrations</TabsTrigger>
        </TabsList>

        {/* Account */}
        <TabsContent value="account" className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <Avatar className="size-14">
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">{founder.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{displayName}</h3>
                <p className="text-sm text-muted-foreground">{displayEmail}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusBadge label={roleLabel(founder.role)} color="teal" />
                  <StatusBadge label="Active" color="green" />
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                </div>
              </div>
            </div>
          </Card>

          <SectionCard title="Profile Details" description="Personal information for your admin account">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">First Name</p>
                <Input defaultValue={founder.firstName} className="mt-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Name</p>
                <Input defaultValue={founder.lastName} className="mt-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <Input defaultValue={displayEmail} className="mt-1" disabled />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <Input defaultValue={roleLabel(founder.role)} className="mt-1" disabled />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <Button onClick={() => toast.info("Profile updates are managed by an admin.")}>Save Changes</Button>
            </div>
          </SectionCard>

          <SectionCard title="Security" description="Password & session management">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2">
                  <Lock className="size-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-xs text-muted-foreground">Change your password regularly</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info("Password reset is configured by your administrator.")}>Change Password</Button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2">
                  <Clock className="size-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Last Login</p>
                    <p className="text-xs text-muted-foreground">2 hours ago · 73.14.22.108</p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* Business */}
        <TabsContent value="business" className="space-y-4">
          <SectionCard title="Calling Configuration" description="Default outreach parameters">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Calling Hours Start</p>
                <Input defaultValue="08:00" className="mt-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Calling Hours End</p>
                <Input defaultValue="20:00" className="mt-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Default Timezone</p>
                <select className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {US_TIMEZONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <Button variant="outline" size="sm" onClick={() => toast.success("Calling configuration saved")}>Save Configuration</Button>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfigList title="Pipeline Stages" items={PIPELINE_STAGES.filter((s) => s.active).map((s) => ({ id: s.id, label: s.label, hint: s.category }))} />
            <ConfigList title="Call Outcomes" items={CALL_OUTCOMES.map((o) => ({ id: o.id, label: o.label, hint: o.connected ? "connected" : "not connected" }))} />
            <ConfigList title="Follow-Up Types" items={FOLLOWUP_TYPES.map((t) => ({ id: t.id, label: t.label }))} />
            <ConfigList title="Deal Stages" items={DEAL_STAGES.map((s) => ({ id: s.id, label: s.label, hint: `${s.probability}%` }))} />
            <ConfigList title="Clinic Services" items={SERVICE_CATALOG.map((s) => ({ id: s.slug, label: s.name }))} />
            <ConfigList title="Priorities" items={PRIORITIES.map((p) => ({ id: p.id, label: p.label }))} />
            <ConfigList title="Directory Stages" items={DIRECTORY_STAGES.map((s) => ({ id: s.id, label: s.label }))} />
            <ConfigList title="Contact Types" items={CONTACT_TYPES.map((t) => ({ id: t.id, label: t.label }))} />
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          <SectionCard title="Notification Channels" description="Where to receive alerts">
            <div className="space-y-3">
              {[
                { label: "Email", enabled: true },
                { label: "Slack", enabled: false },
                { label: "In-app", enabled: true },
              ].map((c) => (
                <div key={c.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.enabled ? "Configured" : "Not configured"}</p>
                  </div>
                  <StatusBadge label={c.enabled ? "Enabled" : "Off"} color={c.enabled ? "green" : "slate"} />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Alert Types" description="Events that trigger notifications">
            <div className="space-y-1">
              {Object.keys(notifToggles).map((t) => (
                <div key={t} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm">{t}</span>
                  <Switch
                    checked={notifToggles[t]}
                    onCheckedChange={(v) => {
                      setNotifToggles((prev) => ({ ...prev, [t]: v }));
                      toast.success(`${t}: ${v ? "enabled" : "disabled"}`);
                    }}
                  />
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations">
          <SectionCard title="Integrations" description="Connection status for ecosystem services">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {integrations.map((i) => {
                const meta = STATUS_META[i.status] ?? STATUS_META.not_connected;
                const Icon = meta.icon;
                return (
                  <div key={i.key} className="flex items-center justify-between p-3 rounded-md border">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Plug className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{i.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{i.note}</p>
                        {i.lastSyncAt && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">Last sync: {relativeTime(i.lastSyncAt)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge label={meta.label} color={meta.color} />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast.info(`Configure ${i.label} — handled via environment variables.`)}
                      >
                        <Icon className="size-3.5" /> Configure
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Secret values are never displayed in the UI. Configure integrations via environment variables.
            </p>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConfigList({ title, items }: { title: string; items: { id: string; label: string; hint?: string }[] }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      <div className="space-y-1 max-h-56 overflow-y-auto nv-scroll">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between text-xs py-1">
            <span className="truncate">{it.label}</span>
            {it.hint && <StatusBadge label={it.hint} color="slate" />}
          </div>
        ))}
      </div>
    </Card>
  );
}
