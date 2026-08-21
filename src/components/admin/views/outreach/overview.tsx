"use client";

import { AlertTriangle, Building2, FileText, Megaphone, Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, MetricCard, SectionCard, StatusBadge } from "@/components/admin/shared";
import { JOB_STATUS_LABELS, META_TRUST_LABELS } from "@/lib/outreach/labels";
import type { OutreachActivity, OutreachResearchJob, OutreachSubview } from "@/lib/outreach/types";
import { OUTREACH_WORKSPACE_NAME } from "@/lib/outreach/routing";
import type { CommandCenterResponse } from "./api";
import { formatWhen } from "./shared";

const PIPELINE: Array<{ key: string; label: string }> = [
  { key: "imported", label: "Imported" },
  { key: "needsResearch", label: "Needs Research" },
  { key: "researching", label: "Researching" },
  { key: "needsReview", label: "Needs Review" },
  { key: "researchReady", label: "Research Ready" },
  { key: "contacted", label: "Contacted" },
  { key: "followUp", label: "Follow-up" },
  { key: "archived", label: "Archived" },
];

export function OverviewCommandCenter({
  data,
  onGo,
  onOpenJob,
  onOpenProspect,
}: {
  data: CommandCenterResponse | null;
  onGo: (subview: OutreachSubview, extra?: Record<string, unknown>) => void;
  onOpenJob: (id: string) => void;
  onOpenProspect: (id: string) => void;
}) {
  if (!data) return <p className="text-sm text-muted-foreground">Loading command center…</p>;
  const required = data.actionRequired.filter((row) => row.count > 0);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{OUTREACH_WORKSPACE_NAME}</p>
        <h2 className="text-lg font-semibold mt-1">Clinic acquisition command center</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Sending and contact-form paste stay manual. This workspace runs research jobs, stores evidence, and shows what needs a human.
        </p>
        <div className="mt-3">
          <StatusBadge label={META_TRUST_LABELS[data.metaTrustMode]} color={data.metaApiConfigured ? "teal" : "amber"} />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button onClick={() => onGo("meta-ads")}><Megaphone className="size-4 mr-1.5" />Search Meta Ads Library</Button>
          <Button variant="outline" onClick={() => onGo("discover")}><Search className="size-4 mr-1.5" />Research selected clinics</Button>
          <Button variant="outline" onClick={() => onGo("discover", { importOpen: true })}><FileText className="size-4 mr-1.5" />Import clinic list</Button>
          <Button variant="outline" onClick={() => onGo("research-queue")}><Sparkles className="size-4 mr-1.5" />Review research queue</Button>
          <Button variant="outline" onClick={() => onGo("discover", { addOpen: true })}><Plus className="size-4 mr-1.5" />Create prospect manually</Button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Action required</h3>
        {required.length === 0 ? (
          <EmptyState
            title="No research activity yet"
            description="Import a clinic list, add a clinic, or search the Meta Ads Library. Counts stay at zero until real work is recorded."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.actionRequired.map((card) => (
              <MetricCard
                key={card.key}
                label={card.label}
                value={card.count}
                hint="Click to open the filtered workspace"
                icon={card.key === "jobs" ? AlertTriangle : Building2}
                tone={card.count ? "amber" : "default"}
                onClick={() => onGo(card.subview, { filters: card.filters })}
              />
            ))}
          </div>
        )}
      </div>

      <SectionCard title="Pipeline by stage" description="Outreach research records only — CRM import volume lives on Discover.">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
          {PIPELINE.map((stage) => (
            <button
              key={stage.key}
              className="rounded-lg border p-3 text-left hover:bg-muted/40"
              onClick={() => onGo(stage.key === "archived" ? "prospects" : "research-queue")}
            >
              <p className="text-xs text-muted-foreground">{stage.label}</p>
              <p className="text-xl font-semibold tabular-nums mt-1">{data.pipeline[stage.key] ?? 0}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Live activity" description="Real events from this server session. Nothing is fabricated.">
          <ActivityList items={data.activity} onOpenProspect={onOpenProspect} />
        </SectionCard>
        <SectionCard title="Jobs running now" description="Background research, Meta searches, and website scans.">
          {data.runningJobs.length === 0 && data.recentJobs.length === 0 ? (
            <EmptyState
              title="No jobs yet"
              description="Start a Meta Ads Library search or run research on selected clinics. Jobs and logs will appear here."
            />
          ) : (
            <div className="space-y-2">
              {(data.runningJobs.length ? data.runningJobs : data.recentJobs).map((job) => (
                <JobRow key={job.id} job={job} onOpen={() => onOpenJob(job.id)} />
              ))}
              <Button size="sm" variant="outline" onClick={() => onGo("jobs")}>Open Jobs & Activity</Button>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ActivityList({ items, onOpenProspect }: { items: OutreachActivity[]; onOpenProspect: (id: string) => void }) {
  if (!items.length) {
    return (
      <EmptyState
        title="No activity yet"
        description="When you search Meta, research a website, or attach evidence, each event is timestamped here."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {items.slice(0, 12).map((item) => (
        <li key={item.id} className="rounded-md border px-3 py-2 text-sm">
          <div className="flex items-start justify-between gap-2">
            <p>{item.description}</p>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatWhen(item.createdAt)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {item.eventType.replaceAll("_", " ")}
            {item.metadata && typeof item.metadata.source === "string" ? ` · ${item.metadata.source}` : ""}
          </p>
          {item.prospectId ? (
            <button className="text-xs text-teal-700 mt-1 hover:underline" onClick={() => onOpenProspect(item.prospectId!)}>
              Open clinic
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function JobRow({ job, onOpen }: { job: OutreachResearchJob; onOpen: () => void }) {
  return (
    <button className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted/40" onClick={onOpen}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate">{job.scope || job.jobType}</p>
        <StatusBadge label={JOB_STATUS_LABELS[job.status]} color={job.status === "FAILED" ? "rose" : job.status === "RUNNING" ? "teal" : "slate"} />
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        {job.jobType.replaceAll("_", " ")} · {job.source} · {job.progressCurrent}/{job.progressTotal || 1}
        {job.errorMessage ? ` · ${job.errorMessage}` : ""}
      </p>
    </button>
  );
}
