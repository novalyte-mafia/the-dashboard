"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, LoadingState, EmptyState, MetricCard, SectionCard, DataTable,
  StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { FileText, Clock, PenLine, CheckCircle2, XCircle, Send, Eye, DollarSign } from "lucide-react";
import { dealService } from "@/services";
import type { Deal } from "@/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

type ContractStatus = "drafting" | "sent" | "reviewing" | "signed" | "rejected";

type ContractRow = {
  id: string;
  dealId: string;
  dealName: string;
  clinicName: string;
  contactName?: string;
  value: number;
  monthly: number;
  status: ContractStatus;
  sentAt?: string;
  expectedSignDate?: string;
  ownerName?: string;
};

const STATUS_COLOR: Record<ContractStatus, string> = {
  drafting: "amber",
  sent: "teal",
  reviewing: "violet",
  signed: "green",
  rejected: "rose",
};

const STATUS_ICON: Record<ContractStatus, any> = {
  drafting: PenLine,
  sent: Send,
  reviewing: Eye,
  signed: CheckCircle2,
  rejected: XCircle,
};

export function ContractsView() {
  const { navigate, openClinic, refreshKey } = useNav();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    dealService
      .list()
      .then((d) => setDeals(d.deals))
      .catch(() => toast.error("Failed to load contracts"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Build contract records from deals (mock)
  const contracts: ContractRow[] = useMemo(() => {
    return deals
      .filter((d) => ["proposal_sent", "negotiation", "contract_sent", "contract_signed", "payment_pending", "active", "won"].includes(d.stage))
      .map((d) => {
        let status: ContractStatus = "drafting";
        if (d.contractStatus === "signed") status = "signed";
        else if (d.contractStatus === "sent") status = "sent";
        else if (d.contractStatus === "reviewing") status = "reviewing";
        else if (d.contractStatus === "rejected") status = "rejected";
        else if (d.stage === "negotiation" || d.stage === "contract_sent") status = "reviewing";
        else if (d.stage === "active" || d.stage === "won" || d.stage === "payment_pending") status = "signed";
        else if (d.stage === "proposal_sent") status = "drafting";

        return {
          id: `ctr_${d.id}`,
          dealId: d.id,
          dealName: d.name,
          clinicName: d.clinicName ?? "—",
          contactName: d.contactName,
          value: d.estimatedTotalValue,
          monthly: d.estimatedMonthlyValue,
          status,
          sentAt: status === "sent" || status === "reviewing" || status === "signed" ? d.updatedAt : undefined,
          expectedSignDate: d.expectedCloseDate,
          ownerName: d.ownerName,
        };
      });
  }, [deals]);

  const filtered = statusFilter ? contracts.filter((c) => c.status === statusFilter) : contracts;

  const drafting = contracts.filter((c) => c.status === "drafting").length;
  const inReview = contracts.filter((c) => c.status === "sent" || c.status === "reviewing").length;
  const signed = contracts.filter((c) => c.status === "signed").length;
  const rejected = contracts.filter((c) => c.status === "rejected").length;
  const signedValue = contracts.filter((c) => c.status === "signed").reduce((s, c) => s + c.value, 0);

  const columns: Column<ContractRow>[] = useMemo(() => [
    {
      key: "deal",
      header: "Deal / Clinic",
      render: (c) => (
        <div className="min-w-0">
          <p className="font-medium truncate max-w-[240px]">{c.dealName}</p>
          <p className="text-xs text-muted-foreground truncate">{c.clinicName}</p>
        </div>
      ),
      sortValue: (c) => c.dealName,
    },
    {
      key: "contact",
      header: "Contact",
      render: (c) => <span className="text-sm text-muted-foreground">{c.contactName ?? "—"}</span>,
      sortValue: (c) => c.contactName ?? "",
      hideOnMobile: true,
    },
    {
      key: "value",
      header: "Contract Value",
      render: (c) => (
        <div>
          <p className="font-medium tabular-nums">{formatCurrency(c.value)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(c.monthly)}/mo</p>
        </div>
      ),
      sortValue: (c) => c.value,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => {
        const Icon = STATUS_ICON[c.status];
        return (
          <span className="inline-flex items-center gap-1.5">
            <Icon className="size-3.5" />
            <StatusBadge label={c.status} color={STATUS_COLOR[c.status]} />
          </span>
        );
      },
      sortValue: (c) => c.status,
    },
    {
      key: "sent",
      header: "Sent",
      render: (c) => <span className="text-xs text-muted-foreground">{c.sentAt ? formatDate(c.sentAt) : "—"}</span>,
      sortValue: (c) => c.sentAt ?? "",
      hideOnMobile: true,
    },
    {
      key: "expectedSign",
      header: "Expected Sign",
      render: (c) => <span className="text-xs text-muted-foreground">{c.expectedSignDate ? formatDate(c.expectedSignDate) : "—"}</span>,
      sortValue: (c) => c.expectedSignDate ?? "",
      hideOnMobile: true,
    },
    {
      key: "owner",
      header: "Owner",
      render: (c) => <span className="text-xs text-muted-foreground">{c.ownerName ?? "—"}</span>,
      sortValue: (c) => c.ownerName ?? "",
      hideOnMobile: true,
    },
  ], []);

  if (loading) return <LoadingState label="Loading contracts…" />;

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Track contracts from drafting through signature"
        action={
          <Button variant="outline" onClick={() => navigate("deals")}>
            <FileText className="size-4" /> All deals
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <MetricCard label="Drafting" value={drafting} icon={PenLine} tone="amber" />
        <MetricCard label="In Review" value={inReview} icon={Eye} tone="violet" />
        <MetricCard label="Signed" value={signed} icon={CheckCircle2} tone="green" />
        <MetricCard label="Rejected" value={rejected} icon={XCircle} tone="rose" />
        <MetricCard label="Signed Value" value={formatCurrency(signedValue)} icon={DollarSign} tone="teal" />
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Button
          variant={statusFilter === "" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("")}
        >
          All ({contracts.length})
        </Button>
        {(["drafting", "sent", "reviewing", "signed", "rejected"] as ContractStatus[]).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
            className="capitalize"
          >
            {s} ({contracts.filter((c) => c.status === s).length})
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={FileText}
            title="No contracts"
            description="Contracts are generated automatically when deals progress to negotiation."
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            onRowClick={(c) => c.dealId && openClinic(c.dealId)}
            pageSize={25}
          />
        </SectionCard>
      )}
    </div>
  );
}
