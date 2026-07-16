"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, LoadingState, EmptyState, StatusBadge,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  Activity, AlertTriangle, CheckCircle2, FileWarning, Database, Globe, Users,
  Plug, FileText, Zap, RefreshCw, ArrowRight, Building2, Inbox, Cpu,
} from "lucide-react";
import {
  automationService, directoryService, patientService, settingsService, contentService,
} from "@/services";
import type { Automation, DirectoryProfile, PatientLead, Integration, Article } from "@/types";
import { relativeTime, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function OperationsOverviewView() {
  const { navigate, refreshKey } = useNav();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [directory, setDirectory] = useState<DirectoryProfile[]>([]);
  const [patients, setPatients] = useState<PatientLead[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      automationService.list(),
      directoryService.list(),
      patientService.listLeads(),
      settingsService.listIntegrations(),
      contentService.listArticles(),
    ])
      .then(([a, d, p, i, ar]) => {
        if (!active) return;
        setAutomations(a.automations);
        setDirectory(d.profiles);
        setPatients(p.leads);
        setIntegrations(i.integrations);
        setArticles(ar.articles);
      })
      .catch(() => active && toast.error("Failed to load operations data"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [refreshKey]);

  if (loading) return <LoadingState label="Loading operations…" />;

  const failedAutomations = automations.filter((a) => a.status === "error");
  const activeAutomations = automations.filter((a) => a.status === "active");
  const pausedAutomations = automations.filter((a) => a.status === "paused");
  const totalFailures = automations.reduce((s, a) => s + a.failureCount, 0);
  const totalRuns = automations.reduce((s, a) => s + a.runCount, 0);

  const publishedDir = directory.filter((d) => d.listingStatus === "published").length;
  const pendingDir = directory.filter((d) => ["unclaimed", "claim_requested", "identity_review", "information_required"].includes(d.listingStatus)).length;
  const approvedDir = directory.filter((d) => d.listingStatus === "approved").length;

  const newLeads = patients.filter((p) => p.status === "new").length;
  const qualifiedLeads = patients.filter((p) => p.status === "qualified").length;

  const healthyIntegrations = integrations.filter((i) => i.status === "connected").length;
  const failingIntegrations = integrations.filter((i) => i.status === "error" || i.status === "configuration_required").length;

  const publishedArticles = articles.filter((a) => a.status === "published").length;
  const scheduledArticles = articles.filter((a) => a.status === "scheduled").length;
  const reviewArticles = articles.filter((a) => a.status === "review" || a.status === "brief" || a.status === "draft").length;

  return (
    <div>
      <PageHeader
        title="Operations Overview"
        description="Operational health across automation, directory, leads, integrations, and content"
        action={
          <Button variant="outline" onClick={() => navigate("automation-overview")}>
            <Zap className="size-4" /> Automations
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard label="Active Automations" value={activeAutomations.length} icon={Zap} tone="teal" hint={`${totalRuns.toLocaleString()} runs`} onClick={() => navigate("automations")} />
        <MetricCard label="Failed Jobs" value={totalFailures} icon={AlertTriangle} tone="rose" hint={`${failedAutomations.length} automations`} onClick={() => navigate("failed-jobs")} />
        <MetricCard label="Directory Live" value={publishedDir} icon={Globe} tone="green" hint={`${pendingDir} pending`} onClick={() => navigate("directory")} />
        <MetricCard label="New Patient Leads" value={newLeads} icon={Users} tone="violet" hint={`${qualifiedLeads} qualified`} onClick={() => navigate("patient-leads")} />
        <MetricCard label="Healthy Integrations" value={healthyIntegrations} icon={Plug} tone="teal" hint={`${failingIntegrations} need attention`} onClick={() => navigate("integrations")} />
        <MetricCard label="Content Published" value={publishedArticles} icon={FileText} tone="amber" hint={`${scheduledArticles} scheduled`} onClick={() => navigate("articles")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Automation status */}
        <SectionCard
          title="Automation Status"
          description="Real-time automation health"
          bodyClassName="p-0"
          action={<Button variant="ghost" size="sm" onClick={() => navigate("automations")}>All <ArrowRight className="size-3.5" /></Button>}
        >
          <div className="divide-y divide-border/60">
            {automations.slice(0, 6).map((a) => (
              <button
                key={a.id}
                onClick={() => navigate("automations")}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left"
              >
                <div className={cn(
                  "size-2 rounded-full shrink-0",
                  a.status === "active" ? "bg-emerald-500"
                  : a.status === "error" ? "bg-rose-500"
                  : a.status === "paused" ? "bg-amber-500"
                  : "bg-slate-300"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.runCount.toLocaleString()} runs · {a.failureCount} failures
                    {a.lastRunAt && ` · last ${relativeTime(a.lastRunAt)}`}
                  </p>
                </div>
                <StatusBadge
                  label={a.status}
                  color={
                    a.status === "active" ? "green"
                    : a.status === "error" ? "rose"
                    : a.status === "paused" ? "amber"
                    : "slate"
                  }
                />
              </button>
            ))}
          </div>
        </SectionCard>

        {/* Recent failed jobs */}
        <SectionCard
          title="Recent Failures"
          description="Jobs requiring manual review"
          bodyClassName="p-0"
          action={<Button variant="ghost" size="sm" onClick={() => navigate("failed-jobs")}>View all <ArrowRight className="size-3.5" /></Button>}
        >
          {failedAutomations.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No failures" description="All automations are healthy." />
          ) : (
            <div className="divide-y divide-border/60">
              {failedAutomations.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate("failed-jobs")}
                  className="w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <FileWarning className="size-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.description}</p>
                      <p className="text-xs text-rose-600 mt-1">{a.failureCount} failures · last run {a.lastRunAt ? relativeTime(a.lastRunAt) : "—"}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Directory onboarding */}
        <SectionCard
          title="Directory Onboarding"
          description="Clinic directory listing progress"
          bodyClassName="p-0"
          action={<Button variant="ghost" size="sm" onClick={() => navigate("directory")}>All <ArrowRight className="size-3.5" /></Button>}
        >
          <div className="px-4 py-3 border-b border-border/60 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums text-emerald-600">{publishedDir}</p>
              <p className="text-xs text-muted-foreground">Published</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-teal-600">{approvedDir}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-amber-600">{pendingDir}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
          <div className="divide-y divide-border/60 max-h-64 overflow-y-auto nv-scroll">
            {directory.slice(0, 6).map((d) => (
              <button
                key={d.id}
                onClick={() => navigate("directory")}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left"
              >
                <Building2 className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.clinicName}</p>
                  <p className="text-xs text-muted-foreground">{d.profileCompleteness}% complete</p>
                </div>
                <StatusBadge
                  label={d.listingStatus.replace(/_/g, " ")}
                  color={
                    d.listingStatus === "published" ? "green"
                    : d.listingStatus === "approved" ? "teal"
                    : d.listingStatus === "suspended" || d.listingStatus === "archived" ? "slate"
                    : "amber"
                  }
                />
              </button>
            ))}
          </div>
        </SectionCard>

        {/* Patient lead queue */}
        <SectionCard
          title="Patient Lead Queue"
          description="Inbound leads awaiting action"
          bodyClassName="p-0"
          action={<Button variant="ghost" size="sm" onClick={() => navigate("patient-leads")}>All <ArrowRight className="size-3.5" /></Button>}
        >
          <div className="px-4 py-3 border-b border-border/60 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums text-violet-600">{newLeads}</p>
              <p className="text-xs text-muted-foreground">New</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-amber-600">{qualifiedLeads}</p>
              <p className="text-xs text-muted-foreground">Qualified</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-emerald-600">{patients.filter((p) => p.status === "routed" || p.status === "booked").length}</p>
              <p className="text-xs text-muted-foreground">Routed</p>
            </div>
          </div>
          <div className="divide-y divide-border/60 max-h-64 overflow-y-auto nv-scroll">
            {patients.filter((p) => p.status === "new" || p.status === "qualified").slice(0, 6).map((p) => (
              <button
                key={p.id}
                onClick={() => navigate("patient-leads")}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left"
              >
                <Users className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.treatmentInterest} · {p.city ?? "—"}, {p.state ?? ""}</p>
                </div>
                <StatusBadge label={p.status} color={p.status === "new" ? "teal" : "green"} />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Integration health */}
        <SectionCard
          title="Integration Health"
          description={`${healthyIntegrations} connected · ${failingIntegrations} need attention`}
          bodyClassName="p-0"
          action={<Button variant="ghost" size="sm" onClick={() => navigate("integrations")}>Configure <ArrowRight className="size-3.5" /></Button>}
        >
          <div className="divide-y divide-border/60 max-h-72 overflow-y-auto nv-scroll">
            {integrations.map((i) => (
              <div key={i.key} className="flex items-center gap-3 px-4 py-2.5">
                <Plug className={cn(
                  "size-4 shrink-0",
                  i.status === "connected" ? "text-emerald-500"
                  : i.status === "configuration_required" ? "text-amber-500"
                  : i.status === "error" ? "text-rose-500"
                  : "text-slate-400"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{i.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{i.note ?? "—"}{i.lastSyncAt && ` · synced ${relativeTime(i.lastSyncAt)}`}</p>
                </div>
                <StatusBadge
                  label={i.status.replace(/_/g, " ")}
                  color={
                    i.status === "connected" ? "green"
                    : i.status === "configuration_required" ? "amber"
                    : i.status === "error" ? "rose"
                    : "slate"
                  }
                />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Content publishing queue */}
        <SectionCard
          title="Content Publishing Queue"
          description="Articles in production & scheduled"
          bodyClassName="p-0"
          action={<Button variant="ghost" size="sm" onClick={() => navigate("articles")}>All <ArrowRight className="size-3.5" /></Button>}
        >
          <div className="px-4 py-3 border-b border-border/60 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums text-emerald-600">{publishedArticles}</p>
              <p className="text-xs text-muted-foreground">Published</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-teal-600">{scheduledArticles}</p>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums text-amber-600">{reviewArticles}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </div>
          <div className="divide-y divide-border/60 max-h-64 overflow-y-auto nv-scroll">
            {articles.filter((a) => a.status !== "published" && a.status !== "archived").slice(0, 6).map((a) => (
              <button
                key={a.id}
                onClick={() => navigate("articles")}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left"
              >
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.authorName}{a.publishDate ? ` · ${formatDateTime(a.publishDate)}` : ""}</p>
                </div>
                <StatusBadge
                  label={a.status.replace(/_/g, " ")}
                  color={a.status === "scheduled" ? "teal" : a.status === "approved" ? "green" : "amber"}
                />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
