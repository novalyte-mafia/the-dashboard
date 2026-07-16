"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, LoadingState, EmptyState, MetricCard, SectionCard, DataTable,
  StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { DollarSign, CheckCircle2, Clock, AlertTriangle, ArrowRight, CreditCard, Wallet } from "lucide-react";
import { dealService } from "@/services";
import type { Deal } from "@/types";
import { formatCurrency, formatCurrencyFull, formatDate } from "@/lib/format";
import { toast } from "sonner";

type PaymentRow = {
  id: string;
  clinicName: string;
  clinicId?: string;
  dealName: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "partial" | "failed";
  method: string;
  date: string;
  invoiceNumber: string;
};

const STATUS_COLOR: Record<string, string> = {
  paid: "green",
  pending: "amber",
  overdue: "rose",
  partial: "violet",
  failed: "rose",
};

const METHOD_LABEL: Record<string, string> = {
  card: "Credit Card",
  ach: "ACH Transfer",
  wire: "Wire Transfer",
  check: "Check",
};

export function PaymentsView() {
  const { openClinic, navigate, refreshKey } = useNav();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dealService
      .list()
      .then((d) => setDeals(d.deals))
      .catch(() => toast.error("Failed to load payments"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Build mock payment records from deals with setup fees + monthly payments
  const rows: PaymentRow[] = useMemo(() => {
    const out: PaymentRow[] = [];
    deals.forEach((d, idx) => {
      if (d.contractStatus === "signed" || d.stage === "active" || d.stage === "won" || d.paymentStatus === "paid" || d.paymentStatus === "partial") {
        // Setup fee payment
        if (d.setupFee > 0) {
          out.push({
            id: `pay_${d.id}_setup`,
            clinicName: d.clinicName ?? "—",
            clinicId: d.clinicId,
            dealName: `${d.name} — Setup`,
            amount: d.setupFee,
            status: d.paymentStatus === "paid" ? "paid" : d.paymentStatus === "partial" ? "partial" : "pending",
            method: idx % 3 === 0 ? "card" : idx % 3 === 1 ? "ach" : "wire",
            date: d.pilotStartDate ?? d.createdAt,
            invoiceNumber: `INV-${10000 + idx}-S`,
          });
        }
        // Monthly payment
        out.push({
          id: `pay_${d.id}_m1`,
          clinicName: d.clinicName ?? "—",
          clinicId: d.clinicId,
          dealName: `${d.name} — Monthly`,
          amount: d.estimatedMonthlyValue,
          status: d.paymentStatus === "paid" ? "paid" : d.paymentStatus === "partial" ? "partial" : d.stage === "active" || d.stage === "won" ? "paid" : "pending",
          method: idx % 2 === 0 ? "card" : "ach",
          date: new Date(new Date(d.pilotStartDate ?? d.createdAt).getTime() + 30 * 86400000).toISOString(),
          invoiceNumber: `INV-${10000 + idx}-M1`,
        });
        // Overdue mock for some
        if (d.paymentStatus === "partial") {
          out.push({
            id: `pay_${d.id}_m2`,
            clinicName: d.clinicName ?? "—",
            clinicId: d.clinicId,
            dealName: `${d.name} — Monthly (overdue)`,
            amount: d.estimatedMonthlyValue,
            status: "overdue",
            method: "ach",
            date: new Date(new Date(d.pilotStartDate ?? d.createdAt).getTime() - 7 * 86400000).toISOString(),
            invoiceNumber: `INV-${10000 + idx}-M2`,
          });
        }
      }
    });
    return out;
  }, [deals]);

  const totalPaid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const totalPending = rows.filter((r) => r.status === "pending" || r.status === "partial").reduce((s, r) => s + r.amount, 0);
  const totalOverdue = rows.filter((r) => r.status === "overdue").reduce((s, r) => s + r.amount, 0);
  const failedCount = rows.filter((r) => r.status === "failed").length;

  const columns: Column<PaymentRow>[] = useMemo(() => [
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
      key: "method",
      header: "Method",
      render: (r) => <span className="text-sm text-muted-foreground">{METHOD_LABEL[r.method] ?? r.method}</span>,
      sortValue: (r) => r.method,
      hideOnMobile: true,
    },
    {
      key: "date",
      header: "Date",
      render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.date)}</span>,
      sortValue: (r) => r.date,
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge label={r.status} color={STATUS_COLOR[r.status] ?? "slate"} />,
      sortValue: (r) => r.status,
    },
  ], []);

  if (loading) return <LoadingState label="Loading payments…" />;

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Payment records across signed deals"
        action={
          <Button variant="outline" onClick={() => navigate("invoices")}>
            <CreditCard className="size-4" /> View invoices
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Paid" value={formatCurrency(totalPaid)} icon={CheckCircle2} tone="green" hint="Collected" />
        <MetricCard label="Pending" value={formatCurrency(totalPending)} icon={Clock} tone="amber" hint="Awaiting payment" />
        <MetricCard label="Overdue" value={formatCurrency(totalOverdue)} icon={AlertTriangle} tone="rose" hint="Past due" />
        <MetricCard label="Failed" value={failedCount} icon={DollarSign} tone="violet" hint="Need retry" />
      </div>

      {rows.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={Wallet}
            title="No payments yet"
            description="Payment records appear here once deals reach contract signature."
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
