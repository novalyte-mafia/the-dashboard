"use client";

import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState, SectionCard, StatusBadge } from "@/components/admin/shared";
import { JOB_STATUS_LABELS } from "@/lib/outreach/labels";
import type { OutreachActivity, OutreachResearchJob } from "@/lib/outreach/types";
import { formatWhen } from "./shared";

export function JobsActivityView({
  jobs,
  activity,
  selected,
  range,
  onRange,
  onSelect,
  onRetry,
  onCancel,
  onOpenProspect,
}: {
  jobs: OutreachResearchJob[];
  activity: OutreachActivity[];
  selected: OutreachResearchJob | null;
  range: "today" | "7d" | "30d" | "all";
  onRange: (range: "today" | "7d" | "30d" | "all") => void;
  onSelect: (id: string | null) => void;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onOpenProspect: (id: string) => void;
}) {
  return (
    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
      <SectionCard title="Jobs" description="Every research, Meta search, import, and draft job recorded in this session.">
        {jobs.length === 0 ? (
          <EmptyState title="No jobs have run" description="Search Meta Ads Library or run research on selected clinics. Job IDs, logs, and errors will list here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  {["Job", "Type", "Source", "Status", "Progress", "Started", "Errors", "Actions"].map((h) => (
                    <th key={h} className="text-left font-medium px-2 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/30">
                    <td className="px-2 py-2">
                      <button className="text-left font-medium hover:underline" onClick={() => onSelect(job.id)}>{job.scope || job.id}</button>
                      <p className="text-[11px] text-muted-foreground">{job.id}</p>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">{job.jobType.replaceAll("_", " ")}</td>
                    <td className="px-2 py-2">{job.source}</td>
                    <td className="px-2 py-2"><StatusBadge label={JOB_STATUS_LABELS[job.status]} color={job.status === "FAILED" ? "rose" : "teal"} /></td>
                    <td className="px-2 py-2">{job.progressCurrent}/{job.progressTotal || 1}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{formatWhen(job.startedAt)}</td>
                    <td className="px-2 py-2 max-w-[180px] truncate">{job.errorMessage || "—"}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => onSelect(job.id)}>Logs</Button>
                      {job.status === "FAILED" || job.status === "NOT_CONFIGURED" ? <Button size="sm" variant="ghost" onClick={() => onRetry(job.id)}>Retry</Button> : null}
                      {job.status === "QUEUED" || job.status === "RUNNING" ? <Button size="sm" variant="ghost" onClick={() => onCancel(job.id)}>Cancel</Button> : null}
                      {job.prospectId ? <Button size="sm" variant="ghost" onClick={() => onOpenProspect(job.prospectId!)}>Clinic</Button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="space-y-4">
        {selected ? (
          <SectionCard title="Job detail" description={selected.id}>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Triggered by</dt><dd>{selected.requestedBy}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Adapter</dt><dd>{selected.adapterName}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Scope</dt><dd>{selected.scope}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Completed</dt><dd>{formatWhen(selected.completedAt)}</dd></div>
            </dl>
            {selected.errorMessage ? (
              <p className="text-sm text-rose-700 mt-3">{selected.errorMessage}</p>
            ) : null}
            <pre className="mt-3 text-[11px] bg-muted/50 rounded-md p-2 overflow-x-auto">{JSON.stringify(selected.resultSummary, null, 2)}</pre>
            <ol className="mt-3 space-y-1 text-xs">
              {selected.logs.map((log, index) => (
                <li key={`${log.at}-${index}`}>{formatWhen(log.at)} · {log.stage}: {log.message}</li>
              ))}
            </ol>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => onRetry(selected.id)}>Retry</Button>
              <Button size="sm" variant="outline" onClick={() => onSelect(null)}>Close</Button>
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Select a job" description="Open logs, retry failed records, or jump to affected clinics.">
            <p className="text-sm text-muted-foreground">Choose a row to inspect parameters, progress, and recommended fixes.</p>
          </SectionCard>
        )}

        <SectionCard title="Activity feed">
          <div className="flex flex-wrap gap-1 mb-3">
            {(["today", "7d", "30d", "all"] as const).map((item) => (
              <Button key={item} size="sm" variant={range === item ? "default" : "outline"} onClick={() => onRange(item)}>
                {item === "today" ? "Today" : item === "all" ? "All" : item}
              </Button>
            ))}
          </div>
          {activity.length === 0 ? <EmptyState title="No activity in this range" description="Run a search or research job to populate the audit trail." /> : null}
          <ul className="space-y-2 max-h-[420px] overflow-y-auto nv-scroll">
            {activity.map((item) => (
              <li key={item.id} className="text-sm border rounded-md px-3 py-2">
                <p>{item.description}</p>
                <p className="text-[11px] text-muted-foreground">{formatWhen(item.createdAt)} · {item.eventType.replaceAll("_", " ")}</p>
                {item.prospectId ? <button className="text-xs text-teal-700 hover:underline" onClick={() => onOpenProspect(item.prospectId!)}>Open clinic</button> : null}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

export function JobsLoading() {
  return <LoadingState label="Loading jobs…" />;
}
