"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  DataTable,
  StatusBadge,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Filter } from "lucide-react";
import { settingsService } from "@/services";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { AuditEvent } from "@/types";

const ACTION_FILTERS = [
  { value: "", label: "All actions" },
  { value: "admin", label: "Admin" },
  { value: "clinic", label: "Clinic" },
  { value: "call", label: "Call" },
  { value: "deal", label: "Deal" },
  { value: "settings", label: "Settings" },
  { value: "directory", label: "Directory" },
];

export function AuditLogsView() {
  const { refreshKey } = useNav();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    settingsService.listAuditEvents().then((d) => setEvents(d.events)).finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    if (!actionFilter) return events;
    return events.filter((e) => e.resourceType === actionFilter || e.action.startsWith(actionFilter));
  }, [events, actionFilter]);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Immutable record of every action taken in the system"
        action={
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-44 h-9">
              <Filter className="size-3.5 mr-1" />
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Card className="p-0">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <History className="size-4" /> Event Log
          </h3>
          <span className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "event" : "events"}</span>
        </div>
        {loading ? (
          <LoadingState label="Loading audit log…" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={History} title="No audit events" description="Try a different filter." />
        ) : (
          <DataTable
            data={filtered}
            columns={[
              {
                key: "timestamp",
                header: "Timestamp",
                render: (e) => (
                  <div>
                    <p className="text-xs font-medium tabular-nums">{formatDateTime(e.timestamp)}</p>
                    <p className="text-[11px] text-muted-foreground">{relativeTime(e.timestamp)}</p>
                  </div>
                ),
                sortValue: (e) => e.timestamp,
              },
              {
                key: "actor",
                header: "Actor",
                render: (e) => <span className="font-medium">{e.actorName}</span>,
                sortValue: (e) => e.actorName,
              },
              {
                key: "action",
                header: "Action",
                render: (e) => {
                  const parts = e.action.split(".");
                  const tone = actionTone(e.action);
                  return <StatusBadge label={parts[parts.length - 1].replace(/_/g, " ")} color={tone} />;
                },
                sortValue: (e) => e.action,
              },
              {
                key: "resourceType",
                header: "Resource",
                render: (e) => (
                  <span className="text-muted-foreground capitalize">
                    {e.resourceType}
                    {e.resourceId && <span className="text-[10px] block">{e.resourceId}</span>}
                  </span>
                ),
                hideOnMobile: true,
              },
              {
                key: "ip",
                header: "IP Address",
                render: (e) => <span className="text-xs text-muted-foreground tabular-nums">{e.ipAddress ?? "—"}</span>,
                hideOnMobile: true,
              },
            ]}
            pageSize={25}
          />
        )}
      </Card>
    </div>
  );
}

function actionTone(action: string): string {
  if (action.includes("signed_in")) return "teal";
  if (action.includes("created") || action.includes("approved")) return "green";
  if (action.includes("deleted") || action.includes("rejected") || action.includes("error")) return "rose";
  if (action.includes("changed") || action.includes("updated")) return "amber";
  return "slate";
}
