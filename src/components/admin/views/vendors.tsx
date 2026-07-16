"use client";

import { useEffect, useMemo, useState } from "react";
import { marketplaceService } from "@/services";
import type { Product, Order } from "@/types";
import {
  PageHeader, MetricCard, DataTable, LoadingState, StatusBadge,
} from "@/components/admin/shared/index";
import {
  Store, Package, DollarSign, TrendingUp, Building2, Star,
} from "lucide-react";
import { formatCurrencyFull, relativeTime } from "@/lib/format";

const VENDOR_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "green" },
  onboarding: { label: "Onboarding", color: "amber" },
  paused: { label: "Paused", color: "slate" },
  review: { label: "Under Review", color: "rose" },
};

interface VendorRow {
  id: string;
  name: string;
  contactEmail: string;
  productsCount: number;
  activeProducts: number;
  totalRevenue: number;
  orderCount: number;
  avgRating: number;
  status: keyof typeof VENDOR_STATUS;
  lastOrderAt: string;
}

export function VendorsView() {
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
  }, []);

  const vendors: VendorRow[] = useMemo(() => {
    // Group products by vendor
    const vendorMap = new Map<string, Product[]>();
    products.forEach((p) => {
      const arr = vendorMap.get(p.vendor) ?? [];
      arr.push(p);
      vendorMap.set(p.vendor, arr);
    });

    // Derive vendor status from product statuses
    const vendorStatusFromProducts = (prods: Product[]): keyof typeof VENDOR_STATUS => {
      const hasActive = prods.some((p) => p.status === "active");
      const hasArchived = prods.every((p) => p.status === "archived");
      if (hasArchived) return "paused";
      if (hasActive) return "active";
      return "onboarding";
    };

    return Array.from(vendorMap.entries()).map(([name, prods], i) => {
      // Estimate revenue: sum of orders containing this vendor's products
      const vendorProductTitles = new Set(prods.map((p) => p.title));
      const vendorOrders = orders.filter((o) =>
        o.items.some((it) => vendorProductTitles.has(it.name)) && o.paymentStatus === "paid"
      );
      const revenue = vendorOrders.reduce((s, o) => {
        const vendorItems = o.items.filter((it) => vendorProductTitles.has(it.name));
        return s + vendorItems.reduce((ss, it) => ss + it.qty * it.price, 0);
      }, 0);
      const ratings = prods.filter((p) => p.rating != null);
      return {
        id: `vnd_${i + 1}`,
        name,
        contactEmail: `orders@${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
        productsCount: prods.length,
        activeProducts: prods.filter((p) => p.status === "active").length,
        totalRevenue: revenue,
        orderCount: vendorOrders.length,
        avgRating: ratings.length > 0 ? Math.round((ratings.reduce((s, p) => s + (p.rating ?? 0), 0) / ratings.length) * 10) / 10 : 0,
        status: vendorStatusFromProducts(prods),
        lastOrderAt: vendorOrders.length > 0
          ? vendorOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
          : new Date(Date.now() - 30 * 86400000).toISOString(),
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [products, orders]);

  if (loading) return <LoadingState label="Loading vendors…" />;

  const totalRevenue = vendors.reduce((s, v) => s + v.totalRevenue, 0);
  const totalProducts = vendors.reduce((s, v) => s + v.productsCount, 0);
  const activeVendors = vendors.filter((v) => v.status === "active").length;

  return (
    <div>
      <PageHeader
        title="Vendors"
        description={`${vendors.length} suppliers powering the Novalyte marketplace`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Active Vendors" value={activeVendors} icon={Store} tone="green" />
        <MetricCard label="Total Products" value={totalProducts} icon={Package} tone="teal" />
        <MetricCard label="Total Revenue" value={formatCurrencyFull(totalRevenue)} icon={DollarSign} tone="default" hint="Paid orders" />
        <MetricCard label="Avg Order Volume" value={vendors.length > 0 ? Math.round(vendors.reduce((s, v) => s + v.orderCount, 0) / vendors.length) : 0} icon={TrendingUp} tone="violet" hint="Per vendor" />
      </div>

      <DataTable
        data={vendors}
        emptyTitle="No vendors yet"
        emptyDescription="Vendors will appear once products are added."
        columns={[
          {
            key: "name",
            header: "Vendor",
            sortValue: (v) => v.name,
            render: (v) => (
              <div>
                <div className="font-medium inline-flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-muted-foreground" />
                  {v.name}
                </div>
                <div className="text-xs text-muted-foreground">{v.contactEmail}</div>
              </div>
            ),
          },
          {
            key: "productsCount",
            header: "Products",
            sortValue: (v) => v.productsCount,
            render: (v) => (
              <span className="text-sm tabular-nums">
                <span className="font-medium">{v.activeProducts}</span>
                <span className="text-muted-foreground"> / {v.productsCount} active</span>
              </span>
            ),
          },
          {
            key: "totalRevenue",
            header: "Revenue",
            sortValue: (v) => v.totalRevenue,
            render: (v) => (
              <span className="text-sm font-semibold tabular-nums">{formatCurrencyFull(v.totalRevenue)}</span>
            ),
          },
          {
            key: "orderCount",
            header: "Orders",
            hideOnMobile: true,
            sortValue: (v) => v.orderCount,
            render: (v) => <span className="text-sm tabular-nums">{v.orderCount}</span>,
          },
          {
            key: "avgRating",
            header: "Rating",
            hideOnMobile: true,
            sortValue: (v) => v.avgRating,
            render: (v) => v.avgRating > 0 ? (
              <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                <Star className="size-3.5 text-amber-500 fill-amber-500" />
                {v.avgRating.toFixed(1)}
              </span>
            ) : <span className="text-xs text-muted-foreground">—</span>,
          },
          {
            key: "lastOrderAt",
            header: "Last Order",
            hideOnMobile: true,
            sortValue: (v) => new Date(v.lastOrderAt).getTime(),
            render: (v) => <span className="text-xs text-muted-foreground">{relativeTime(v.lastOrderAt)}</span>,
          },
          {
            key: "status",
            header: "Status",
            sortValue: (v) => v.status,
            render: (v) => {
              const s = VENDOR_STATUS[v.status];
              return <StatusBadge label={s.label} color={s.color} />;
            },
          },
        ]}
      />
    </div>
  );
}
