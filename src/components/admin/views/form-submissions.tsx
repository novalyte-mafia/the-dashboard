"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, Mail, RefreshCw, Search, Slack } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader, LoadingState } from "@/components/admin/shared";

type Delivery = {
  id: string;
  channel: "slack" | "email";
  status: string;
  attempt_count: number;
  last_error: string | null;
};

type Submission = {
  id: string;
  submission_id: string;
  form_type: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  organization: string | null;
  safe_message: string | null;
  safe_metadata: Record<string, string | number | boolean | null>;
  source_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  notification_status: string;
  slack_status: string;
  email_status: string;
  is_read: boolean;
  follow_up_status: string;
  assigned_owner: string | null;
  last_error: string | null;
  contains_sensitive_health_data: boolean;
  submitted_at: string;
  deliveries: Delivery[];
};

const FORM_TYPES = [
  "patient_assessment",
  "campaign_lead",
  "clinic_application",
  "clinic_onboarding",
  "clinic_claim",
  "directory_listing",
  "professional_onboarding",
  "job_application",
  "employer_onboarding",
  "job_posting",
  "vendor_onboarding",
  "marketplace_quote",
  "consultation_request",
  "contact_inquiry",
  "newsletter_signup",
  "investor_access_request",
  "investor_meeting_request",
];

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string) {
  if (status === "sent") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "partially_sent" || status === "pending" || status === "retrying") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-rose-200 bg-rose-50 text-rose-800";
}

export function FormSubmissionsView() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    formType: "",
    notificationStatus: "",
    source: "",
    campaign: "",
    read: "",
    followUp: "",
    from: "",
    to: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    try {
      const response = await fetch(`/api/form-submissions?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load submissions.");
      setSubmissions(payload.submissions ?? []);
      setCount(payload.count ?? 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load submissions.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const unread = useMemo(() => submissions.filter((item) => !item.is_read).length, [submissions]);
  const failed = useMemo(
    () => submissions.filter((item) => ["failed", "partially_sent"].includes(item.notification_status)).length,
    [submissions],
  );

  async function update(body: Record<string, unknown>) {
    const response = await fetch("/api/form-submissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Update failed.");
    await load();
  }

  async function retry(item: Submission) {
    try {
      await update({ action: "retry", submissionId: item.id });
      toast.success("Failed notification channels queued for retry.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed.");
    }
  }

  async function open(item: Submission) {
    setSelected(item);
    if (!item.is_read) {
      try {
        await update({ action: "mark_read", submissionId: item.id, isRead: true });
      } catch {
        // Detail remains usable if read state cannot be persisted.
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Forms & Notifications"
        description="Real production submissions with Slack and email delivery state"
        action={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Recent submissions" value={count} icon={BellRing} />
        <Stat label="Unread on this page" value={unread} icon={Mail} />
        <Stat label="Needs delivery attention" value={failed} icon={RefreshCw} />
      </div>

      <Card className="mb-4 gap-3 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            aria-label="Search submissions"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search name, email, organization, or submission ID"
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <Select
            label="Form type"
            value={filters.formType}
            options={FORM_TYPES}
            onChange={(value) => setFilters((current) => ({ ...current, formType: value }))}
          />
          <Select
            label="Notification"
            value={filters.notificationStatus}
            options={["pending", "sent", "partially_sent", "failed", "retrying"]}
            onChange={(value) => setFilters((current) => ({ ...current, notificationStatus: value }))}
          />
          <Select
            label="Read state"
            value={filters.read}
            options={["unread", "read"]}
            onChange={(value) => setFilters((current) => ({ ...current, read: value }))}
          />
          <Select
            label="Follow-up"
            value={filters.followUp}
            options={["new", "in_progress", "waiting", "completed", "closed"]}
            onChange={(value) => setFilters((current) => ({ ...current, followUp: value }))}
          />
          <input
            aria-label="UTM source"
            placeholder="UTM source"
            value={filters.source}
            onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
          <input
            aria-label="UTM campaign"
            placeholder="Campaign"
            value={filters.campaign}
            onChange={(event) => setFilters((current) => ({ ...current, campaign: event.target.value }))}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
          <input
            aria-label="From date"
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
          <input
            aria-label="To date"
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading real form submissions…" />
      ) : submissions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No production submissions match these filters.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Submission</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Slack</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Follow-up</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {submissions.map((item) => (
                <tr key={item.id} className={item.is_read ? "" : "bg-teal-50/40"}>
                  <td className="px-4 py-3">
                    <button className="text-left font-medium hover:underline" onClick={() => void open(item)}>
                      {label(item.form_type)}
                    </button>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {item.submission_id.slice(0, 12)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{item.contact_name || item.organization || "—"}</div>
                    <div className="text-xs text-muted-foreground">{item.contact_email || "—"}</div>
                  </td>
                  <td className="max-w-[220px] px-4 py-3">
                    <div className="truncate">{item.source_page || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">
                      {[item.utm_source, item.utm_campaign].filter(Boolean).join(" / ") || "Unattributed"}
                    </div>
                  </td>
                  <td className="px-4 py-3"><ChannelStatus channel="slack" status={item.slack_status} /></td>
                  <td className="px-4 py-3"><ChannelStatus channel="email" status={item.email_status} /></td>
                  <td className="px-4 py-3">{label(item.follow_up_status)}</td>
                  <td className="px-4 py-3 text-xs">{new Date(item.submitted_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {item.notification_status !== "sent" && (
                      <Button size="sm" variant="outline" onClick={() => void retry(item)}>
                        <RefreshCw className="size-3.5" /> Retry
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onClick={() => setSelected(null)}>
          <aside
            aria-label="Submission details"
            className="h-full w-full max-w-xl overflow-y-auto bg-background p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{label(selected.form_type)}</h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{selected.submission_id}</p>
              </div>
              <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
            <div className="mt-6 grid gap-3 text-sm">
              <Detail label="Name" value={selected.contact_name} />
              <Detail label="Email" value={selected.contact_email} />
              <Detail label="Phone" value={selected.contact_phone} />
              <Detail label="Organization" value={selected.organization} />
              <Detail label="Source page" value={selected.source_page} />
              <Detail label="Referrer" value={selected.referrer} />
              <Detail label="UTM" value={[selected.utm_source, selected.utm_campaign].filter(Boolean).join(" / ")} />
              {selected.contains_sensitive_health_data ? (
                <Card className="border-amber-200 bg-amber-50 p-3 text-amber-900">
                  Sensitive healthcare details are intentionally excluded from this notification record.
                  Open the authorized patient workflow for full details.
                </Card>
              ) : (
                <Detail label="Message" value={selected.safe_message} />
              )}
              <Detail label="Error" value={selected.last_error} />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <select
                aria-label="Follow-up status"
                value={selected.follow_up_status}
                onChange={async (event) => {
                  await update({
                    action: "follow_up",
                    submissionId: selected.id,
                    status: event.target.value,
                    assignedOwner: selected.assigned_owner,
                  });
                  setSelected({ ...selected, follow_up_status: event.target.value });
                }}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                {["new", "in_progress", "waiting", "completed", "closed"].map((option) => (
                  <option key={option} value={option}>{label(option)}</option>
                ))}
              </select>
              {selected.notification_status !== "sent" && (
                <Button variant="outline" onClick={() => void retry(selected)}>
                  <RefreshCw className="size-4" /> Retry notification
                </Button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Stat({ label: statLabel, value, icon: Icon }: { label: string; value: number; icon: typeof BellRing }) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <Icon className="size-5 text-primary" />
      <div><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{statLabel}</p></div>
    </Card>
  );
}

function Select({ label: selectLabel, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={selectLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-md border bg-background px-3 text-sm"
    >
      <option value="">{selectLabel}: All</option>
      {options.map((option) => <option key={option} value={option}>{label(option)}</option>)}
    </select>
  );
}

function ChannelStatus({ channel, status }: { channel: "slack" | "email"; status: string }) {
  const Icon = channel === "slack" ? Slack : Mail;
  return (
    <Badge variant="outline" className={statusTone(status)}>
      <Icon className="mr-1 size-3" /> {label(status)}
    </Badge>
  );
}

function Detail({ label: detailLabel, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-medium text-muted-foreground">{detailLabel}</p>
      <p className="mt-1 whitespace-pre-wrap break-words">{value || "—"}</p>
    </div>
  );
}
