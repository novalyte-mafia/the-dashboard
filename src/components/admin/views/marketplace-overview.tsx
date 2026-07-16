"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { marketplaceService } from "@/services";
import type { Product, Order } from "@/types";
import {
  PageHeader, MetricCard, SectionCard, DataTable, LoadingState, EmptyState,
  StatusBadge,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  DollarSign, ShoppingBag, Package, TrendingUp, AlertTriangle, ArrowRight,
  PackageX, Star,
} from "lucide-react";
import { formatCurrency, formatCurrencyFull, relativeTime } from "@/lib/format";
import { toast } from "sonner";

const PAY_COLOR: Record<string, string> = {
  paid: "green", pending: "amber", refunded: "violet", failed: "rose",
};
const FULFILL_COLOR: Record<string, string> = {
  fulfilled: "green", shipped: "teal", partial: "amber", unfulfilled: "slate",
};

export function MarketplaceOverviewView() {
  const { navigate, refreshKey } = useNav();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      marketplaceService.listProducts(),
      marketplaceService.listOrders(),
    ])
      .then(([p, o]) => {
        setProducts(p.products);
        setOrders(o.orders);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <LoadingState label="Loading marketplace overview…" />;

  const totalRevenue = orders.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.total, 0);
  const paidOrders = orders.filter((o) => o.paymentStatus === "paid").length;
  const avgOrderValue = paidOrders > 0 ? Math.round(totalRevenue / paidOrders) : 0;
  const pendingFulfillment = orders.filter((o) => o.fulfillmentStatus === "unfulfilled" || o.fulfillmentStatus === "partial").length;
  const lowInventory = products.filter((p) => p.inventory > 0 && p.inventory < 100);

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Marketplace"
        description="Products, orders, and fulfillment for the Novalyte supply store"
        action={
          <Button variant="outline" onClick={() => toast.info("Sales report queued.")}>
            <TrendingUp className="size-4" /> Sales Report
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <MetricCard
          label="Total Revenue"
          value={formatCurrencyFull(totalRevenue)}
          icon={DollarSign}
          tone="green"
          hint="From paid orders"
          trend={12}
        />
        <MetricCard
          label="Total Orders"
          value={orders.length}
          icon={ShoppingBag}
          tone="teal"
          onClick={() => navigate("orders")}
        />
        <MetricCard
          label="Products"
          value={products.length}
          icon={Package}
          tone="default"
          onClick={() => navigate("products")}
        />
        <MetricCard
          label="Avg Order Value"
          value={formatCurrency(avgOrderValue)}
          icon={TrendingUp}
          tone="violet"
          hint="Per paid order"
        />
        <MetricCard
          label="Pending Fulfillment"
          value={pendingFulfillment}
          icon={AlertTriangle}
          tone="amber"
          hint="Unfulfilled / partial"
          onClick={() => navigate("orders")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard
          title="Recent Orders"
          description="Latest transactions"
          className="lg:col-span-2"
          bodyClassName="p-0"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate("orders")}>
              View all <ArrowRight className="size-3.5" />
            </Button>
          }
        >
          {recentOrders.length === 0 ? (
            <EmptyState title="No orders yet" description="Orders will appear here." />
          ) : (
            <DataTable
              data={recentOrders}
              pageSize={6}
              onRowClick={() => navigate("orders")}
              columns={[
                {
                  key: "orderNumber",
                  header: "Order",
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
                  render: (o) => <span className="text-sm font-medium tabular-nums">{formatCurrencyFull(o.total)}</span>,
                },
                {
                  key: "paymentStatus",
                  header: "Payment",
                  render: (o) => <StatusBadge label={o.paymentStatus} color={PAY_COLOR[o.paymentStatus]} />,
                },
                {
                  key: "fulfillmentStatus",
                  header: "Fulfillment",
                  hideOnMobile: true,
                  render: (o) => <StatusBadge label={o.fulfillmentStatus} color={FULFILL_COLOR[o.fulfillmentStatus]} />,
                },
                {
                  key: "createdAt",
                  header: "Date",
                  hideOnMobile: true,
                  render: (o) => <span className="text-xs text-muted-foreground">{relativeTime(o.createdAt)}</span>,
                },
              ]}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Low Inventory Alerts"
          description="Restock soon"
          bodyClassName="p-0"
          action={
            lowInventory.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => navigate("products")}>
                Manage <ArrowRight className="size-3.5" />
              </Button>
            )
          }
        >
          {lowInventory.length === 0 ? (
            <EmptyState icon={Package} title="Inventory healthy" description="All products well stocked." />
          ) : (
            <div className="divide-y divide-border/60">
              {lowInventory.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate("products")}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/40 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.title}</div>
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <PackageX className="size-3" />
                      SKU {p.sku}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums text-amber-700">{p.inventory}</div>
                    <div className="text-xs text-muted-foreground">in stock</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Top Products"
        description="Highest-rated items in catalog"
        className="mt-4"
        bodyClassName="p-0"
      >
        <div className="divide-y divide-border/60">
          {[...products]
            .filter((p) => p.rating != null)
            .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
            .slice(0, 4)
            .map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.category} · {p.vendor}</div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{formatCurrencyFull(p.price)}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{p.inventory} units</div>
                  </div>
                  <div className="inline-flex items-center gap-1 text-sm tabular-nums">
                    <Star className="size-3.5 text-amber-500 fill-amber-500" />
                    {p.rating?.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </SectionCard>
    </div>
  );
}
