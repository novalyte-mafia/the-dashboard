"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { marketplaceService } from "@/services";
import type { Product, Order } from "@/types";
import {
  PageHeader, MetricCard, ChartCard, LoadingState, SectionCard, StatusBadge,
} from "@/components/admin/shared/index";
import {
  DollarSign, ShoppingBag, TrendingUp, Package, Star,
} from "lucide-react";
import { formatCurrencyFull, formatDate } from "@/lib/format";

const PAY_COLOR: Record<string, string> = {
  paid: "green", pending: "amber", refunded: "violet", failed: "rose",
};

export function MarketplaceAnalyticsView() {
  const { refreshKey } = useNav();
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

  const revenueTrend = useMemo(() => {
    // Last 14 days
    const days: { label: string; value: number }[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 86400000);
      const next = new Date(day.getTime() + 86400000);
      const label = `${day.getMonth() + 1}/${day.getDate()}`;
      const value = orders
        .filter((o) => o.paymentStatus === "paid")
        .filter((o) => {
          const t = new Date(o.createdAt).getTime();
          return t >= day.getTime() && t < next.getTime();
        })
        .reduce((s, o) => s + o.total, 0);
      days.push({ label, value });
    }
    return days;
  }, [orders]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { revenue: number; units: number }>();
    orders.filter((o) => o.paymentStatus === "paid").forEach((o) => {
      o.items.forEach((it) => {
        const cur = map.get(it.name) ?? { revenue: 0, units: 0 };
        cur.revenue += it.qty * it.price;
        cur.units += it.qty;
        map.set(it.name, cur);
      });
    });
    return Array.from(map.entries())
      .map(([label, v]) => ({ label, value: v.revenue, units: v.units, color: "#14b8a6" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [orders]);

  const ordersByStatus = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => {
      map.set(o.paymentStatus, (map.get(o.paymentStatus) ?? 0) + 1);
    });
    const colors: Record<string, string> = {
      paid: "#10b981", pending: "#f59e0b", refunded: "#a78bfa", failed: "#f43f5e",
    };
    return Array.from(map.entries()).map(([label, value]) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      value,
      color: colors[label] ?? "#94a3b8",
    }));
  }, [orders]);

  const inventoryValue = useMemo(() => {
    return products
      .map((p) => ({
        label: p.title,
        value: p.inventory * p.cost,
        units: p.inventory,
        color: p.status === "out_of_stock" ? "#f43f5e" : p.inventory < 100 ? "#f59e0b" : "#14b8a6",
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [products]);

  if (loading) return <LoadingState label="Loading marketplace analytics…" />;

  const totalRevenue = orders.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.total, 0);
  const totalUnits = orders.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.items.reduce((ss, it) => ss + it.qty, 0), 0);
  const avgOrderValue = orders.filter((o) => o.paymentStatus === "paid").length > 0
    ? Math.round(totalRevenue / orders.filter((o) => o.paymentStatus === "paid").length)
    : 0;
  const totalInventoryValue = products.reduce((s, p) => s + p.inventory * p.cost, 0);

  return (
    <div>
      <PageHeader
        title="Marketplace Analytics"
        description="Revenue trends, top products, and inventory health"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total Revenue" value={formatCurrencyFull(totalRevenue)} icon={DollarSign} tone="green" hint="Paid orders" trend={12} />
        <MetricCard label="Units Sold" value={totalUnits} icon={ShoppingBag} tone="teal" />
        <MetricCard label="Avg Order Value" value={formatCurrencyFull(avgOrderValue)} icon={TrendingUp} tone="violet" />
        <MetricCard label="Inventory Value" value={formatCurrencyFull(totalInventoryValue)} icon={Package} tone="default" hint="At cost" />
      </div>

      <ChartCard
        title="Revenue Trend (Last 14 Days)"
        data={revenueTrend}
        type="line"
        className="mb-4"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard
          title="Top Products by Revenue"
          data={topProducts.map((p) => ({ label: p.label, value: p.value, color: p.color }))}
          type="bar"
        />
        <ChartCard
          title="Orders by Payment Status"
          data={ordersByStatus}
          type="bar"
        />
      </div>

      <ChartCard
        title="Inventory Value by Product (At Cost)"
        data={inventoryValue}
        type="bar"
        className="mb-4"
      />

      <SectionCard
        title="Top Products Detail"
        description="Revenue and units sold"
        bodyClassName="p-0"
      >
        {topProducts.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No paid orders yet.</div>
        ) : (
          <div className="overflow-x-auto nv-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="font-medium text-muted-foreground px-3 py-2.5">Product</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 text-right">Units Sold</th>
                  <th className="font-medium text-muted-foreground px-3 py-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.label} className="border-b last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{p.label}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.units}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatCurrencyFull(p.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
