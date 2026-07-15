"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { PageHeader, LoadingState, SectionCard } from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User, Settings as SettingsIcon, Bell, Plug, LogOut, ShieldCheck, Check, X, AlertCircle } from "lucide-react";
import { initials, formatDate, fullName } from "@/lib/format";
import { roleLabel } from "@/lib/constants";
import { toast } from "sonner";

interface SettingsData {
  config: {
    pipelineStages: { id: string; label: string; category: string; color: string; active: boolean }[];
    callOutcomes: { id: string; label: string }[];
    followUpTypes: { id: string; label: string }[];
    dealStages: { id: string; label: string }[];
    services: { name: string; slug: string }[];
    priorities: { id: string; label: string }[];
    directoryStages: { id: string; label: string }[];
    contactTypes: { id: string; label: string }[];
    timezones: { id: string; label: string }[];
  };
  integrations: { key: string; label: string; status: string; note: string }[];
}

const STATUS_STYLES: Record<string, { label: string; className: string; icon: typeof Check }> = {
  connected: { label: "Connected", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Check },
  not_connected: { label: "Not Connected", className: "bg-muted text-muted-foreground border-border", icon: X },
  configuration_required: { label: "Configuration Required", className: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertCircle },
  error: { label: "Error", className: "bg-rose-50 text-rose-700 border-rose-200", icon: AlertCircle },
};

export function SettingsView() {
  const { admin } = useNav();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setData).catch(() => toast.error("Failed to load settings")).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <LoadingState label="Loading settings…" />;

  return (
    <div>
      <PageHeader title="Settings" description="Account, business configuration, and integrations" />

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
              <Avatar className="size-14"><AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">{initials(admin.firstName, admin.lastName)}</AvatarFallback></Avatar>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{fullName(admin.firstName, admin.lastName)}</h3>
                <p className="text-sm text-muted-foreground">{admin.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge className="bg-primary/10 text-primary border-primary/20">{roleLabel(admin.role)}</Badge>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200"><ShieldCheck className="size-3" /> Active</Badge>
                </div>
              </div>
            </div>
          </Card>

          <SectionCard title="Profile Details">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-muted-foreground">First Name</p><Input defaultValue={admin.firstName} className="mt-1" /></div>
              <div><p className="text-xs text-muted-foreground">Last Name</p><Input defaultValue={admin.lastName} className="mt-1" /></div>
              <div><p className="text-xs text-muted-foreground">Email</p><Input defaultValue={admin.email} className="mt-1" disabled /></div>
              <div><p className="text-xs text-muted-foreground">Role</p><Input defaultValue={roleLabel(admin.role)} className="mt-1" disabled /></div>
            </div>
            <div className="flex justify-end mt-3"><Button onClick={() => toast.info("Profile updates are managed by an admin.")}>Save Changes</Button></div>
          </SectionCard>

          <SectionCard title="Security">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Password</p><p className="text-xs text-muted-foreground">Change your password regularly</p></div>
                <Button variant="outline" size="sm" onClick={() => toast.info("Password reset is configured by your administrator.")}>Change Password</Button>
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Last Login</p><p className="text-xs text-muted-foreground">{formatDate(admin.lastLoginAt)}</p></div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div><p className="text-sm font-medium text-destructive">Sign Out</p><p className="text-xs text-muted-foreground">End your session on this device</p></div>
                <Button variant="outline" size="sm" className="text-destructive" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.reload(); }}><LogOut className="size-4" /> Sign Out</Button>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* Business config */}
        <TabsContent value="business" className="space-y-4">
          <SectionCard title="Calling Configuration" description="Default outreach parameters">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-muted-foreground">Default Calling Hours</p><div className="flex gap-2 mt-1"><Input defaultValue="08:00" /><Input defaultValue="20:00" /></div></div>
              <div><p className="text-xs text-muted-foreground">Default Timezone</p>
                <select className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {data.config.timezones.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ConfigList title="Pipeline Stages" items={data.config.pipelineStages.map((s) => ({ id: s.id, label: s.label, hint: s.category }))} />
            <ConfigList title="Call Outcomes" items={data.config.callOutcomes.map((o) => ({ id: o.id, label: o.label }))} />
            <ConfigList title="Follow-Up Types" items={data.config.followUpTypes.map((t) => ({ id: t.id, label: t.label }))} />
            <ConfigList title="Deal Stages" items={data.config.dealStages.map((s) => ({ id: s.id, label: s.label }))} />
            <ConfigList title="Clinic Services" items={data.config.services.map((s) => ({ id: s.slug, label: s.name }))} />
            <ConfigList title="Priorities" items={data.config.priorities.map((p) => ({ id: p.id, label: p.label }))} />
            <ConfigList title="Directory Stages" items={data.config.directoryStages.map((s) => ({ id: s.id, label: s.label }))} />
            <ConfigList title="Contact Types" items={data.config.contactTypes.map((t) => ({ id: t.id, label: t.label }))} />
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          <SectionCard title="Notification Channels" description="Where to receive alerts (Release 1 — configuration placeholders)">
            <div className="space-y-3">
              {[["Email", true], ["Slack", false], ["In-app", true]].map(([label, on]) => (
                <div key={label as string} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{label as string}</span>
                  <Badge variant={on ? "default" : "outline"} className={on ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}>{on ? "Enabled" : "Not configured"}</Badge>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Alert Types" description="Events that trigger notifications">
            <div className="space-y-2">
              {["New clinic application", "New patient inquiry", "Follow-up overdue", "Meeting booked", "Deal stage changed", "Proposal accepted", "System error"].map((t) => (
                <label key={t} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm">{t}</span>
                  <input type="checkbox" defaultChecked className="accent-primary size-4" />
                </label>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations">
          <SectionCard title="Integrations" description="Connection status for ecosystem services">
            <div className="space-y-2">
              {data.integrations.map((i) => {
                const s = STATUS_STYLES[i.status] ?? STATUS_STYLES.not_connected;
                const Icon = s.icon;
                return (
                  <div key={i.key} className="flex items-center justify-between p-3 rounded-md border">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-md bg-muted flex items-center justify-center"><Plug className="size-4 text-muted-foreground" /></div>
                      <div>
                        <p className="text-sm font-medium">{i.label}</p>
                        <p className="text-xs text-muted-foreground">{i.note}</p>
                      </div>
                    </div>
                    <Badge className={s.className + " border"}><Icon className="size-3" /> {s.label}</Badge>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Secret values are never displayed in the UI. Configure integrations via environment variables.</p>
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
            <span>{it.label}</span>
            {it.hint && <Badge variant="outline" className="text-[10px] capitalize">{it.hint}</Badge>}
          </div>
        ))}
      </div>
    </Card>
  );
}
