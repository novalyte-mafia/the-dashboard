"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, LoadingState, EmptyState, MetricCard, SectionCard, DataTable,
  StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle2, Clock, AlertTriangle, ArrowRight, DollarSign, Download } from "lucide-react";
import { dealService } from "@/services";
import type { Deal } from "@/types";
import { formatCurrency, formatCurrencyFull, formatDate } from "@/lib/format";
import { toast } from "sonner";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  clinicName: string;
  clinicId?: string;
  dealName: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "draft";
  issuedAt: string;
  dueDate: string;
  ownerName?: string;
};

const STATUS_COLOR: Record<string, string> = {
  paid: "green",
  pending: "amber",
  overdue: "rose",
  draft: "slate",
};

export function InvoicesView() {
  const { openClinic, navigate, refreshKey } = useNav();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dealService
      .list()
      .then((d) => setDeals(d.deals))
      .catch(() => toast.error("Failed to load invoices"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const rows: InvoiceRow[] = useMemo(() => {
    const out: InvoiceRow[] = [];
    deals.forEach((d, idx) => {
      if (["proposal_sent", "negotiation", "contract_sent", "contract_signed", "payment_pending", "active", "won"].includes(d.stage)) {
        // Setup invoice
        const issued = new Date(d.createdAt);
        const due = new Date(issued.getTime() + 14 * 86400000);
        let status: InvoiceRow["status"] = "draft";
        if (d.paymentStatus === "paid" || d.stage === "active" || d.stage === "won") status = "paid";
        else if (d.paymentStatus === "pending" || d.paymentStatus === "partial") status = "pending";
        else if (Date.now() > due.getTime()) status = "overdue";
        else status = "pending";

        if (d.setupFee > 0) {
          out.push({
            id: `inv_${d.id}_setup`,
            invoiceNumber: `INV-${10042 + idx}-S`,
            clinicName: d.clinicName ?? "—",
            clinicId: d.clinicId,
            dealName: `${d.name} — Setup Fee`,
            amount: d.setupFee,
            status: d.paymentStatus === "paid" ? "paid" : status,
            issuedAt: issued.toISOString(),
            dueDate: due.toISOString(),
            ownerName: d.ownerName,
          });
        }
        // First monthly invoice
        out.push({
          id: `inv_${d.id}_m1`,
          invoiceNumber: `INV-${10042 + idx}-M1`,
          clinicName: d.clinicName ?? "—",
          clinicId: d.clinicId,
          dealName: `${d.name} — Month 1`,
          amount: d.estimatedMonthlyValue,
          status: d.paymentStatus === "paid" || d.stage === "active" || d.stage === "won" ? "paid" : status,
          issuedAt: new Date(issued.getTime() + 30 * 86400000).toISOString(),
          dueDate: new Date(issued.getTime() + 44 * 86400000).toISOString(),
          ownerName: d.ownerName,
        });
      }
    });
    return out;
  }, [deals]);

  const totalOutstanding = rows.filter((r) => r.status === "pending" || r.status === "overdue").reduce((s, r) => s + r.amount, 0);
  const totalPaid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const overdueCount = rows.filter((r) => r.status === "overdue").length;
  const draftCount = rows.filter((r) => r.status === "draft").length;

  const columns: Column<InvoiceRow>[] = useMemo(() => [
    {
      key: "invoice",
      header: "Invoice #",
      render: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span>,
      sortValue: (r) => r.invoiceNumber,
    },
    {
      key: "clinic",
      header: "Clinic",
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium truncate max-w-[180px]">{r.clinicName}</p>
          <p className="text-xs text-muted-foreground truncate">{r.dealName}</p>
        </div>
      ),
      sortValue: (r) => r.clinicName,
    },
    {
      key: "amount",
      header: "Amount",
      render: (r) => <span className="font-medium tabular-nums">{formatCurrencyFull(r.amount)}</span>,
      sortValue: (r) => r.amount,
    },
    {
      key: "issued",
      header: "Issued",
      render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.issuedAt)}</span>,
      sortValue: (r) => r.issuedAt,
      hideOnMobile: true,
    },
    {
      key: "due",
      header: "Due",
      render: (r) => (
        <span className={`text-xs tabular-nums ${r.status === "overdue" ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>
          {formatDate(r.dueDate)}
        </span>
      ),
      sortValue: (r) => r.dueDate,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge label={r.status} color={STATUS_COLOR[r.status] ?? "slate"} />,
      sortValue: (r) => r.status,
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            toast.success(`Downloading ${r.invoiceNumber}.pdf…`);
          }}
        >
          <Download className="size-3.5" /> PDF
        </Button>
      ),
      hideOnMobile: true,
    },
  ], []);

  if (loading) return <LoadingState label="Loading invoices…" />;

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Billing invoices for setup fees and monthly services"
        action={
          <Button variant="outline" onClick={() => navigate("payments")}>
            <DollarSign className="size-4" /> View payments
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Outstanding" value={formatCurrency(totalOutstanding)} icon={Clock} tone="amber" hint="Pending + overdue" />
        <MetricCard label="Collected" value={formatCurrency(totalPaid)} icon={CheckCircle2} tone="green" hint="Paid invoices" />
        <MetricCard label="Overdue" value={overdueCount} icon={AlertTriangle} tone="rose" hint="Past due" />
        <MetricCard label="Draft" value={draftCount} icon={FileText} tone="violet" hint="Not yet sent" />
      </div>

      {rows.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={FileText}
            title="No invoices"
            description="Invoices are generated when deals reach proposal stage or beyond."
            action={<Button onClick={() => navigate("deals")}>View deals <ArrowRight className="size-4" /></Button>}
          />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="p-0">
          <DataTable
            columns={columns}
            data={rows}
            onRowClick={(r) => r.clinicId && openClinic(r.clinicId)}
            pageSize={25}
          />
        </SectionCard>
      )}
    </div>
  );
}
