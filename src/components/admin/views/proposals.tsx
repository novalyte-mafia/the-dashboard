"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, LoadingState, EmptyState, MetricCard, SectionCard, DataTable,
  StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { FileText, Clock, DollarSign, TrendingUp, AlertTriangle, ArrowRight, Mail, PhoneCall } from "lucide-react";
import { dealService } from "@/services";
import type { Deal } from "@/types";
import { formatCurrency, formatCurrencyFull, formatDate } from "@/lib/format";
import { toast } from "sonner";

export function ProposalsView() {
  const { openClinic, navigate, refreshKey } = useNav();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dealService
      .list()
      .then((d) => {
        setAllDeals(d.deals);
        setDeals(d.deals.filter((x) => x.stage === "proposal_sent"));
      })
      .catch(() => toast.error("Failed to load proposals"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const totalOutstanding = deals.reduce((s, d) => s + d.estimatedTotalValue, 0);
  const avgAge = deals.length > 0
    ? Math.round(deals.reduce((s, d) => {
        const sent = new Date(d.updatedAt).getTime();
        return s + (Date.now() - sent) / 86400000;
      }, 0) / deals.length)
    : 0;
  const overdueCount = deals.filter((d) => {
    const sent = new Date(d.updatedAt).getTime();
    return (Date.now() - sent) / 86400000 > 5;
  }).length;
  const expectedCloseThisMonth = deals.filter((d) => {
    if (!d.expectedCloseDate) return false;
    const c = new Date(d.expectedCloseDate);
    const now = new Date();
    return c.getMonth() === now.getMonth() && c.getFullYear() === now.getFullYear();
  }).length;

  const rows = useMemo(() => deals.map((d) => {
    const ageDays = Math.round((Date.now() - new Date(d.updatedAt).getTime()) / 86400000);
    return { ...d, ageDays };
  }), [deals]);

  const columns: Column<Deal & { ageDays: number }>[] = useMemo(() => [
    {
      key: "name",
      header: "Deal",
      render: (d) => (
        <div className="min-w-0">
          <p className="font-medium truncate max-w-[240px]">{d.name}</p>
          {d.offer && <p className="text-xs text-muted-foreground truncate">{d.offer}</p>}
        </div>
      ),
      sortValue: (d) => d.name,
    },
    {
      key: "clinic",
      header: "Clinic",
      render: (d) => <span className="text-sm text-muted-foreground">{d.clinicName ?? "—"}</span>,
      sortValue: (d) => d.clinicName ?? "",
      hideOnMobile: true,
    },
    {
      key: "contact",
      header: "Contact",
      render: (d) => <span className="text-sm text-muted-foreground">{d.contactName ?? "—"}</span>,
      sortValue: (d) => d.contactName ?? "",
      hideOnMobile: true,
    },
    {
      key: "value",
      header: "Value",
      render: (d) => <span className="font-medium tabular-nums">{formatCurrency(d.estimatedTotalValue)}</span>,
      sortValue: (d) => d.estimatedTotalValue,
    },
    {
      key: "monthly",
      header: "Monthly",
      render: (d) => <span className="tabular-nums text-muted-foreground">{formatCurrency(d.estimatedMonthlyValue)}</span>,
      sortValue: (d) => d.estimatedMonthlyValue,
      hideOnMobile: true,
    },
    {
      key: "age",
      header: "Days Out",
      render: (d) => (
        <span className={`tabular-nums ${d.ageDays > 5 ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>
          {d.ageDays}d
        </span>
      ),
      sortValue: (d) => d.ageDays,
    },
    {
      key: "nextAction",
      header: "Next Action",
      render: (d) => (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate max-w-[160px]">
            {d.ageDays > 5 ? "Escalate — follow up urgently" : "Send check-in email"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              if (d.clinicId) openClinic(d.clinicId);
            }}
          >
            Open <ArrowRight className="size-3" />
          </Button>
        </div>
      ),
    },
  ], [openClinic]);

  if (loading) return <LoadingState label="Loading proposals…" />;

  return (
    <div>
      <PageHeader
        title="Proposals Outstanding"
        description="Deals in proposal_sent stage awaiting clinic response"
        action={
          <Button variant="outline" onClick={() => navigate("deals")}>
            <FileText className="size-4" /> All deals
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Proposals Out" value={deals.length} icon={FileText} tone="amber" hint="Awaiting reply" />
        <MetricCard label="Total Value" value={formatCurrency(totalOutstanding)} icon={DollarSign} tone="teal" />
        <MetricCard label="Avg Days Out" value={avgAge} icon={Clock} tone="violet" hint="Days since sent" />
        <MetricCard label="Overdue (>5d)" value={overdueCount} icon={AlertTriangle} tone="rose" hint="Needs escalation" />
      </div>

      {deals.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={FileText}
            title="No outstanding proposals"
            description="When deals reach proposal_sent stage they'll appear here."
            action={<Button onClick={() => navigate("deals")}>View all deals <ArrowRight className="size-4" /></Button>}
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={rows}
            onRowClick={(d) => d.clinicId && openClinic(d.clinicId)}
            pageSize={25}
          />
        </SectionCard>
      )}

      {/* Quick actions */}
      {deals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <SectionCard title="Proposal Activity" description="Recent proposal-related actions">
            <div className="space-y-2 text-sm">
              {deals.slice(0, 4).map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{d.name}</span>
                  <span className="text-xs text-muted-foreground">Sent {formatDate(d.updatedAt)}</span>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Quick Actions" description="Expedite outstanding proposals">
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("activity")}>
                <Mail className="size-4" /> Send check-in emails
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("call-queue")}>
                <PhoneCall className="size-4" /> Call proposal contacts
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("contracts")}>
                <FileText className="size-4" /> Draft contracts for ready deals
              </Button>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
