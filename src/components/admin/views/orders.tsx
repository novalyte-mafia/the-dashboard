"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { marketplaceService } from "@/services";
import type { Order } from "@/types";
import {
  PageHeader, MetricCard, DataTable, FilterBar, DetailDrawer, LoadingState,
  StatusBadge,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag, DollarSign, AlertTriangle, Truck, Package, Flag, Truck as TruckIcon,
} from "lucide-react";
import { formatCurrencyFull, relativeTime, formatDateTime } from "@/lib/format";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Payment Pending" },
  { value: "refunded", label: "Refunded" },
  { value: "failed", label: "Failed" },
  { value: "unfulfilled", label: "Unfulfilled" },
  { value: "shipped", label: "Shipped" },
];

const PAY_COLOR: Record<string, string> = {
  paid: "green", pending: "amber", refunded: "violet", failed: "rose",
};
const FULFILL_COLOR: Record<string, string> = {
  fulfilled: "green", shipped: "teal", partial: "amber", unfulfilled: "slate",
};

export function OrdersView() {
  const { refreshKey } = useNav();
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Order | null>(null);

  useEffect(() => {
    setLoading(true);
    marketplaceService.listOrders()
      .then((d) => setData(d.orders))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((o) => {
      if (q && !`${o.orderNumber} ${o.customerName} ${o.customerEmail ?? ""}`.toLowerCase().includes(q)) return false;
      if (filters.paymentStatus && o.paymentStatus !== filters.paymentStatus) return false;
      if (filters.fulfillmentStatus && o.fulfillmentStatus !== filters.fulfillmentStatus) return false;
      return true;
    });
  }, [data, search, filters]);

  if (loading) return <LoadingState label="Loading orders…" />;

  const totalRevenue = data.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.total, 0);
  const pendingPayment = data.filter((o) => o.paymentStatus === "pending" || o.paymentStatus === "failed").length;
  const pendingFulfillment = data.filter((o) => o.fulfillmentStatus === "unfulfilled" || o.fulfillmentStatus === "partial").length;
  const riskFlags = data.filter((o) => o.riskFlags && o.riskFlags.length > 0).length;

  return (
    <div>
      <PageHeader
        title="Orders"
        description={`${data.length} orders · ${formatCurrencyFull(totalRevenue)} in paid revenue`}
        action={
          <Button variant="outline" onClick={() => toast.info("Export started.")}>
            Export
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Paid Revenue" value={formatCurrencyFull(totalRevenue)} icon={DollarSign} tone="green" />
        <MetricCard label="Pending Payment" value={pendingPayment} icon={AlertTriangle} tone="amber" />
        <MetricCard label="Pending Fulfillment" value={pendingFulfillment} icon={Package} tone="teal" />
        <MetricCard label="Risk Flagged" value={riskFlags} icon={Flag} tone="rose" hint="Needs review" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          { key: "paymentStatus", label: "Payment", options: STATUS_OPTIONS.slice(0, 4) },
          { key: "fulfillmentStatus", label: "Fulfillment", options: [
            { value: "fulfilled", label: "Fulfilled" },
            { value: "shipped", label: "Shipped" },
            { value: "partial", label: "Partial" },
            { value: "unfulfilled", label: "Unfulfilled" },
          ] },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => { setSearch(""); setFilters({}); }}
        searchPlaceholder="Search by order #, customer name, email…"
      />

      <DataTable
        data={filtered}
        onRowClick={(o) => setSelected(o)}
        emptyTitle="No orders match"
        emptyDescription="Try adjusting filters."
        columns={[
          {
            key: "orderNumber",
            header: "Order",
            sortValue: (o) => o.orderNumber,
            render: (o) => (
              <div>
                <div className="font-medium tabular-nums">{o.orderNumber}</div>
                <div className="text-xs text-muted-foreground">{o.customerName}</div>
              </div>
            ),
          },
          {
            key: "items",
            header: "Items",
            hideOnMobile: true,
            sortValue: (o) => o.items.length,
            render: (o) => (
              <span className="text-xs text-muted-foreground">
                {o.items.length} {o.items.length === 1 ? "item" : "items"}
              </span>
            ),
          },
          {
            key: "total",
            header: "Total",
            sortValue: (o) => o.total,
            render: (o) => (
              <span className="text-sm font-medium tabular-nums">{formatCurrencyFull(o.total)}</span>
            ),
          },
          {
            key: "paymentStatus",
            header: "Payment",
            sortValue: (o) => o.paymentStatus,
            render: (o) => <StatusBadge label={o.paymentStatus} color={PAY_COLOR[o.paymentStatus]} />,
          },
          {
            key: "fulfillmentStatus",
            header: "Fulfillment",
            sortValue: (o) => o.fulfillmentStatus,
            render: (o) => <StatusBadge label={o.fulfillmentStatus} color={FULFILL_COLOR[o.fulfillmentStatus]} />,
          },
          {
            key: "risk",
            header: "Risk",
            hideOnMobile: true,
            render: (o) => o.riskFlags && o.riskFlags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {o.riskFlags.map((r) => (
                  <StatusBadge key={r} label={r} color="rose" />
                ))}
              </div>
            ) : <span className="text-xs text-muted-foreground">—</span>,
          },
          {
            key: "createdAt",
            header: "Date",
            sortValue: (o) => new Date(o.createdAt).getTime(),
            render: (o) => <span className="text-xs text-muted-foreground">{relativeTime(o.createdAt)}</span>,
          },
        ]}
      />

      <DetailDrawer
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={`Order ${selected?.orderNumber ?? ""}`}
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Customer</div>
                <div className="font-medium">{selected.customerName}</div>
                {selected.customerEmail && (
                  <div className="text-xs text-muted-foreground">{selected.customerEmail}</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Order Date</div>
                <div className="font-medium">{formatDateTime(selected.createdAt)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Payment</div>
                <div><StatusBadge label={selected.paymentStatus} color={PAY_COLOR[selected.paymentStatus]} /></div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Fulfillment</div>
                <div><StatusBadge label={selected.fulfillmentStatus} color={FULFILL_COLOR[selected.fulfillmentStatus]} /></div>
              </div>
            </div>

            {selected.riskFlags && selected.riskFlags.length > 0 && (
              <div className="p-3 rounded-md border border-rose-200 bg-rose-50">
                <div className="text-xs text-rose-800 font-medium uppercase tracking-wide mb-1.5 inline-flex items-center gap-1.5">
                  <Flag className="size-3.5" /> Risk Flags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.riskFlags.map((r) => (
                    <StatusBadge key={r} label={r} color="rose" />
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Items</div>
              <div className="space-y-2">
                {selected.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-md border border-border/60">
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {item.qty} × {formatCurrencyFull(item.price)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {formatCurrencyFull(item.qty * item.price)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <span className="text-sm font-medium">Total</span>
                <span className="text-base font-semibold tabular-nums">{formatCurrencyFull(selected.total)}</span>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Fulfillment Timeline</div>
              <div className="space-y-2.5">
                <TimelineItem
                  label="Order placed"
                  timestamp={selected.createdAt}
                  done
                />
                <TimelineItem
                  label="Payment captured"
                  timestamp={selected.paymentStatus === "paid" ? selected.createdAt : undefined}
                  done={selected.paymentStatus === "paid"}
                  tone={selected.paymentStatus === "failed" ? "error" : "default"}
                  note={selected.paymentStatus === "failed" ? "Payment declined" : undefined}
                />
                <TimelineItem
                  label="Packed & shipped"
                  timestamp={selected.fulfillmentStatus === "shipped" || selected.fulfillmentStatus === "fulfilled" ? selected.createdAt : undefined}
                  done={selected.fulfillmentStatus === "shipped" || selected.fulfillmentStatus === "fulfilled"}
                />
                {selected.trackingNumber && (
                  <div className="pl-5 -mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                    <TruckIcon className="size-3" /> Tracking: <span className="font-mono">{selected.trackingNumber}</span>
                  </div>
                )}
                <TimelineItem
                  label="Delivered"
                  timestamp={undefined}
                  done={selected.fulfillmentStatus === "fulfilled"}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.success(`Refund initiated for ${selected.orderNumber}.`)}
                disabled={selected.paymentStatus !== "paid"}
              >
                Issue Refund
              </Button>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => toast.success(`Fulfillment started for ${selected.orderNumber}.`)}
                disabled={selected.fulfillmentStatus === "fulfilled" || selected.fulfillmentStatus === "shipped"}
              >
                <Truck className="size-3.5" /> Mark Fulfilled
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

function TimelineItem({
  label, timestamp, done, tone = "default", note,
}: {
  label: string;
  timestamp?: string;
  done?: boolean;
  tone?: "default" | "error";
  note?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="relative flex flex-col items-center">
        <div className={`size-2.5 rounded-full ${done ? (tone === "error" ? "bg-rose-500" : "bg-teal-500") : "bg-muted-foreground/30 border border-muted-foreground/40"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}>{label}</div>
        {timestamp ? (
          <div className="text-xs text-muted-foreground">{formatDateTime(timestamp)}</div>
        ) : note ? (
          <div className={`text-xs ${tone === "error" ? "text-rose-600" : "text-muted-foreground"}`}>{note}</div>
        ) : (
          <div className="text-xs text-muted-foreground/70">Pending</div>
        )}
      </div>
    </div>
  );
}
