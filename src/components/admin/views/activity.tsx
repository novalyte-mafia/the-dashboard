"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { PageHeader, LoadingState, EmptyState, SectionCard } from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity as ActivityIcon, Filter } from "lucide-react";
import { relativeTime, fullName } from "@/lib/format";
import { activityService } from "@/services";
import type { ActivityEvent } from "@/types";
import { toast } from "sonner";

const ENTITY_TYPES = [
  { value: "__all", label: "All activity" },
  { value: "clinic", label: "Clinics" },
  { value: "contact", label: "Contacts" },
  { value: "call", label: "Calls" },
  { value: "followup", label: "Follow-ups" },
  { value: "deal", label: "Deals" },
  { value: "directory", label: "Directory" },
  { value: "patient_lead", label: "Patient Leads" },
  { value: "admin", label: "Admin" },
];

const ACTION_ICONS: Record<string, string> = {
  clinic_created: "➕",
  clinic_updated: "✏️",
  clinic_imported: "📥",
  contact_added: "👤",
  contact_updated: "✏️",
  stage_changed: "🔄",
  call_logged: "📞",
  followup_created: "📌",
  followup_completed: "✅",
  deal_created: "💼",
  deal_stage_changed: "🔄",
  directory_status_changed: "🌐",
  admin_signed_in: "🔐",
  patient_lead_created: "🆕",
};

export function ActivityView() {
  const { refreshKey } = useNav();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("__all");

  useEffect(() => {
    setLoading(true);
    activityService
      .list(entityType === "__all" ? undefined : entityType)
      .then((d) => setActivities(d.activities))
      .catch(() => toast.error("Failed to load activity"))
      .finally(() => setLoading(false));
  }, [entityType, refreshKey]);

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Immutable history of every important action across the platform"
        action={
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-44 h-9"><Filter className="size-4" /><SelectValue placeholder="All activity" /></SelectTrigger>
            <SelectContent>{ENTITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      <Card className="p-0">
        {loading ? (
          <LoadingState label="Loading activity…" />
        ) : activities.length === 0 ? (
          <EmptyState icon={ActivityIcon} title="No activity recorded" description="Try a different filter or check back later." />
        ) : (
          <div className="divide-y">
            {activities.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                <div className="size-8 rounded-full bg-muted flex items-center justify-center text-sm shrink-0">
                  {ACTION_ICONS[a.action] ?? "•"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{a.summary}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="capitalize">{a.entityType.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span className="font-mono text-[10px] bg-muted px-1 rounded">{a.action}</span>
                    {a.adminName && (<><span>·</span><span>{a.adminName}</span></>)}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{relativeTime(a.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
