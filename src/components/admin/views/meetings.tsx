"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, EmptyState, LoadingState, FilterBar, DataTable,
  StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import {
  Calendar, Clock, MapPin, Users, CheckCircle2, XCircle, CalendarPlus, Phone, Video,
  Building2, ArrowRight,
} from "lucide-react";
import { followUpService } from "@/services";
import type { FollowUpTask } from "@/types";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = {
  open: "teal",
  in_progress: "amber",
  completed: "green",
  cancelled: "rose",
  rescheduled: "amber",
  overdue: "rose",
};

type MeetingStatus = "scheduled" | "completed" | "cancelled" | "rescheduled" | "overdue";

type MeetingRow = {
  id: string;
  title: string;
  clinicName?: string;
  contactName?: string;
  date: string;
  time?: string;
  duration: string;
  format: "video" | "phone" | "in_person";
  status: MeetingStatus;
  assignedAdminName?: string;
  notes?: string;
};

export function MeetingsView() {
  const { openClinic, navigate, refreshKey } = useNav();
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    followUpService
      .list()
      .then((d) => setTasks(d.tasks))
      .catch(() => toast.error("Failed to load meetings"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Filter for meeting-type tasks; mock some additional upcoming meetings
  const meetings: MeetingRow[] = useMemo(() => {
    const fromTasks = tasks
      .filter((t) => t.taskType === "meeting")
      .map((t, idx): MeetingRow => {
        let status: MeetingStatus = "scheduled";
        if ((t.status as string) === "completed") status = "completed";
        else if ((t.status as string) === "cancelled") status = "cancelled";
        else if ((t.status as string) === "rescheduled") status = "rescheduled";
        else if (t.dueDate && new Date(t.dueDate) < new Date() && (t.status as string) !== "completed") status = "overdue";
        return {
          id: t.id,
          title: t.title,
          clinicName: t.clinicName,
          contactName: t.contactName,
          date: t.dueDate ?? t.createdAt,
          time: t.dueTime ?? "10:00",
          duration: idx % 2 === 0 ? "30 min" : "60 min",
          format: idx % 3 === 0 ? "video" : idx % 3 === 1 ? "phone" : "in_person",
          status,
          assignedAdminName: t.assignedAdminName,
          notes: t.notes,
        };
      });
    return fromTasks;
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings.filter((m) => {
      if (q && !`${m.title} ${m.clinicName ?? ""} ${m.contactName ?? ""} ${m.assignedAdminName ?? ""}`.toLowerCase().includes(q)) return false;
      if (activeFilters.status && m.status !== activeFilters.status) return false;
      if (activeFilters.format && m.format !== activeFilters.format) return false;
      return true;
    });
  }, [meetings, search, activeFilters]);

  const upcoming = filtered.filter((m) => m.status === "scheduled" && new Date(m.date) >= new Date())
    .sort((a, b) => a.date.localeCompare(b.date));
  const past = filtered.filter((m) => m.status === "completed" || (m.status === "scheduled" && new Date(m.date) < new Date()))
    .sort((a, b) => b.date.localeCompare(a.date));
  const cancelled = filtered.filter((m) => m.status === "cancelled" || m.status === "rescheduled" || m.status === "overdue");

  const totalScheduled = meetings.filter((m) => m.status === "scheduled").length;
  const totalCompleted = meetings.filter((m) => m.status === "completed").length;
  const totalOverdue = meetings.filter((m) => m.status === "overdue").length;
  const totalThisWeek = meetings.filter((m) => {
    const d = new Date(m.date);
    const now = new Date();
    const inWeek = new Date(now.getTime() + 7 * 86400000);
    return d >= now && d <= inWeek && m.status === "scheduled";
  }).length;

  const columns: Column<MeetingRow>[] = useMemo(() => [
    {
      key: "title",
      header: "Meeting",
      render: (m) => (
        <div className="min-w-0">
          <p className="font-medium truncate max-w-[200px]">{m.title}</p>
          <p className="text-xs text-muted-foreground truncate">{m.clinicName ?? "—"} · {m.contactName ?? "—"}</p>
        </div>
      ),
      sortValue: (m) => m.title,
    },
    {
      key: "date",
      header: "Date & Time",
      render: (m) => (
        <div>
          <p className="text-sm font-medium tabular-nums">{formatDate(m.date)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{m.time} · {m.duration}</p>
        </div>
      ),
      sortValue: (m) => m.date,
    },
    {
      key: "format",
      header: "Format",
      render: (m) => (
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          {m.format === "video" ? <Video className="size-3.5" /> : m.format === "phone" ? <Phone className="size-3.5" /> : <MapPin className="size-3.5" />}
          <span className="capitalize">{m.format.replace("_", " ")}</span>
        </span>
      ),
      sortValue: (m) => m.format,
      hideOnMobile: true,
    },
    {
      key: "owner",
      header: "Owner",
      render: (m) => <span className="text-sm text-muted-foreground">{m.assignedAdminName ?? "—"}</span>,
      sortValue: (m) => m.assignedAdminName ?? "",
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: (m) => <StatusBadge label={m.status} color={STATUS_COLOR[m.status] ?? "slate"} />,
      sortValue: (m) => m.status,
    },
  ], []);

  if (loading) return <LoadingState label="Loading meetings…" />;

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Scheduled meetings and discovery calls"
        action={
          <Button variant="outline" onClick={() => navigate("follow-ups")}>
            <CalendarPlus className="size-4" /> Schedule meeting
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Scheduled" value={totalScheduled} icon={Calendar} tone="teal" hint="Upcoming" />
        <MetricCard label="This Week" value={totalThisWeek} icon={Clock} tone="violet" />
        <MetricCard label="Completed" value={totalCompleted} icon={CheckCircle2} tone="green" />
        <MetricCard label="Overdue" value={totalOverdue} icon={XCircle} tone="rose" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          {
            key: "status", label: "Status", options: [
              { value: "scheduled", label: "Scheduled" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
              { value: "rescheduled", label: "Rescheduled" },
              { value: "overdue", label: "Overdue" },
            ],
          },
          {
            key: "format", label: "Format", options: [
              { value: "video", label: "Video" },
              { value: "phone", label: "Phone" },
              { value: "in_person", label: "In-Person" },
            ],
          },
        ]}
        activeFilters={activeFilters}
        onFilterChange={(k, v) => setActiveFilters((prev) => {
          const next = { ...prev };
          if (v) next[k] = v; else delete next[k];
          return next;
        })}
        onClear={() => setActiveFilters({})}
        searchPlaceholder="Search meetings by title, clinic, contact…"
      />

      {filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Calendar}
            title="No meetings"
            description="Schedule meetings from a clinic's follow-up list or call log."
            action={<Button onClick={() => navigate("follow-ups")}>View follow-ups <ArrowRight className="size-4" /></Button>}
          />
        </SectionCard>
      ) : (
        <>
          {upcoming.length > 0 && (
            <SectionCard
              title="Upcoming"
              description={`${upcoming.length} scheduled meeting${upcoming.length === 1 ? "" : "s"}`}
              className="mb-4"
              bodyClassName="p-0"
            >
              <DataTable
                columns={columns}
                data={upcoming}
                onRowClick={() => navigate("follow-ups")}
                pageSize={10}
              />
            </SectionCard>
          )}

          {past.length > 0 && (
            <SectionCard
              title="Past Meetings"
              description={`${past.length} completed or lapsed`}
              className="mb-4"
              bodyClassName="p-0"
            >
              <DataTable
                columns={columns}
                data={past}
                onRowClick={() => navigate("follow-ups")}
                pageSize={10}
              />
            </SectionCard>
          )}

          {cancelled.length > 0 && (
            <SectionCard
              title="Cancelled / Rescheduled / Overdue"
              description={`${cancelled.length} meeting${cancelled.length === 1 ? "" : "s"}`}
              bodyClassName="p-0"
            >
              <DataTable
                columns={columns}
                data={cancelled}
                onRowClick={() => navigate("follow-ups")}
                pageSize={10}
              />
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
