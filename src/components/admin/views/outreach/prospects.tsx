"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/admin/shared";
import { OUTREACH_PAGE_SIZE } from "@/lib/outreach/accounts";
import type { OutreachProspectRow, OutreachSavedView, ProspectStatus } from "@/lib/outreach/types";
import { STATUS_LABELS, VERTICAL_LABELS } from "@/lib/outreach/labels";
import {
  AdSignalChip,
  ConfidenceChip,
  ContactRouteSummaryBadge,
  SafeExternalLink,
  SourceBadge,
  StatusChip,
  formatWhen,
} from "./shared";

const ALL_COLUMNS = [
  "clinic",
  "location",
  "vertical",
  "status",
  "owner",
  "signal",
  "website",
  "route",
  "confidence",
  "updated",
] as const;

export function ProspectsView({
  prospects,
  views,
  activeView,
  onView,
  onOpen,
  selected,
  onSelect,
  onSelectAll,
  onBulkArchive,
  onBulkStatus,
  onBulkOwner,
  onExport,
}: {
  prospects: OutreachProspectRow[];
  views: OutreachSavedView[];
  activeView: string;
  onView: (name: string) => void;
  onOpen: (id: string) => void;
  selected: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onBulkArchive: () => void;
  onBulkStatus: (status: ProspectStatus) => void;
  onBulkOwner: (ownerId: string) => void;
  onExport: (includeSuppressed: boolean) => void;
}) {
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "updatedAt", dir: "desc" });
  const [page, setPage] = useState(1);
  const [visible, setVisible] = useState<string[]>([...ALL_COLUMNS]);
  const [owner, setOwner] = useState("");
  const pageSize = OUTREACH_PAGE_SIZE;

  const sorted = useMemo(() => {
    const rows = [...prospects];
    rows.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.field === "clinicName") return a.clinicName.localeCompare(b.clinicName) * dir;
      if (sort.field === "status") return a.status.localeCompare(b.status) * dir;
      return a.updatedAt.localeCompare(b.updatedAt) * dir;
    });
    return rows;
  }, [prospects, sort]);

  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const show = (key: string) => visible.includes(key);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {views.map((view) => (
          <Button key={view.id} size="sm" variant={activeView === view.name ? "default" : "outline"} onClick={() => onView(view.name)}>
            {view.name}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Sort</span>
        <select className="h-8 rounded-md border px-2" value={sort.field} onChange={(e) => setSort({ ...sort, field: e.target.value })}>
          <option value="updatedAt">Last updated</option>
          <option value="clinicName">Clinic</option>
          <option value="status">Status</option>
        </select>
        <Button size="sm" variant="outline" onClick={() => setSort({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" })}>
          {sort.dir === "asc" ? "Asc" : "Desc"}
        </Button>
        <span className="text-muted-foreground ml-2">Columns</span>
        {ALL_COLUMNS.map((col) => (
          <label key={col} className="flex items-center gap-1">
            <Checkbox checked={show(col)} onCheckedChange={(v) => setVisible((prev) => v ? [...prev, col] : prev.filter((c) => c !== col))} />
            {col}
          </label>
        ))}
      </div>
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-xs">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={onBulkArchive}>Bulk archive</Button>
          <select className="h-8 rounded-md border px-2 text-xs" onChange={(e) => { if (e.target.value) onBulkStatus(e.target.value as ProspectStatus); e.target.value = ""; }}>
            <option value="">Assign status</option>
            {Object.entries(STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <input className="h-8 rounded-md border px-2 text-xs" placeholder="Owner id" value={owner} onChange={(e) => setOwner(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => onBulkOwner(owner)} disabled={!owner.trim()}>Assign owner</Button>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onExport(false)}>CSV export</Button>
        <Button size="sm" variant="outline" onClick={() => onExport(true)}>CSV export including suppressed</Button>
      </div>
      {!pageRows.length ? <EmptyState title="No prospects in this view" /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2"><Checkbox checked={pageRows.every((r) => selected.has(r.id)) && pageRows.length > 0} onCheckedChange={(v) => onSelectAll(Boolean(v))} /></th>
                {show("clinic") && <th className="px-3 py-2 text-left">Clinic</th>}
                {show("location") && <th className="px-3 py-2 text-left">Location</th>}
                {show("vertical") && <th className="px-3 py-2 text-left">Vertical</th>}
                {show("status") && <th className="px-3 py-2 text-left">Status</th>}
                {show("owner") && <th className="px-3 py-2 text-left">Owner</th>}
                {show("signal") && <th className="px-3 py-2 text-left">Signal</th>}
                {show("website") && <th className="px-3 py-2 text-left">Website</th>}
                {show("route") && <th className="px-3 py-2 text-left">Route</th>}
                {show("confidence") && <th className="px-3 py-2 text-left">Confidence</th>}
                {show("updated") && <th className="px-3 py-2 text-left">Updated</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {pageRows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2"><Checkbox checked={selected.has(row.id)} onCheckedChange={(v) => onSelect(row.id, Boolean(v))} /></td>
                  {show("clinic") && (
                    <td className="px-3 py-2">
                      <button className="font-medium hover:underline" onClick={() => onOpen(row.id)}>{row.clinicName}</button>
                    </td>
                  )}
                  {show("location") && <td className="px-3 py-2">{row.location || "—"}</td>}
                  {show("vertical") && <td className="px-3 py-2">{VERTICAL_LABELS[row.vertical]}</td>}
                  {show("status") && <td className="px-3 py-2"><StatusChip status={row.status} /></td>}
                  {show("owner") && <td className="px-3 py-2">{row.ownerId ?? "—"}</td>}
                  {show("signal") && <td className="px-3 py-2"><AdSignalChip value={row.adSignal} /></td>}
                  {show("website") && <td className="px-3 py-2">{row.websiteUrl ? <SafeExternalLink href={row.websiteUrl}>{row.canonicalDomain ?? "Open"}</SafeExternalLink> : "—"}</td>}
                  {show("route") && <td className="px-3 py-2"><ContactRouteSummaryBadge summary={row.contactRoute} /></td>}
                  {show("confidence") && <td className="px-3 py-2"><ConfidenceChip value={row.researchConfidence} /></td>}
                  {show("updated") && <td className="px-3 py-2 text-muted-foreground">{formatWhen(row.updatedAt)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Page {page} of {pages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
