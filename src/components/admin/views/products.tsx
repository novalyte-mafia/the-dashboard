"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { marketplaceService } from "@/services";
import type { Product } from "@/types";
import {
  PageHeader, MetricCard, DataTable, FilterBar, DetailDrawer, LoadingState,
  StatusBadge,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  Package, AlertTriangle, Star, DollarSign, TrendingUp, Plus, Box,
} from "lucide-react";
import { formatCurrencyFull } from "@/lib/format";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "out_of_stock", label: "Out of Stock" },
  { value: "archived", label: "Archived" },
];

const STATUS_COLOR: Record<string, string> = {
  active: "green", draft: "amber", out_of_stock: "rose", archived: "slate",
};

export function ProductsView() {
  const { refreshKey } = useNav();
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    setLoading(true);
    marketplaceService.listProducts()
      .then((d) => setData(d.products))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const categories = useMemo(
    () => Array.from(new Set(data.map((p) => p.category))).sort(),
    [data]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((p) => {
      if (q && !`${p.title} ${p.sku} ${p.vendor} ${p.category}`.toLowerCase().includes(q)) return false;
      if (filters.category && p.category !== filters.category) return false;
      if (filters.status && p.status !== filters.status) return false;
      return true;
    });
  }, [data, search, filters]);

  if (loading) return <LoadingState label="Loading products…" />;

  const active = data.filter((p) => p.status === "active").length;
  const outOfStock = data.filter((p) => p.status === "out_of_stock").length;
  const lowStock = data.filter((p) => p.inventory > 0 && p.inventory < 100).length;
  const avgMargin = data.length > 0 ? Math.round(data.reduce((s, p) => s + p.margin, 0) / data.length) : 0;

  return (
    <div>
      <PageHeader
        title="Products"
        description={`${data.length} SKUs across ${categories.length} categories`}
        action={
          <Button onClick={() => toast.info("Product editor opening soon.")}>
            <Plus className="size-4" /> Add Product
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Active" value={active} icon={Package} tone="green" onClick={() => setFilters({ status: "active" })} />
        <MetricCard label="Out of Stock" value={outOfStock} icon={AlertTriangle} tone="rose" onClick={() => setFilters({ status: "out_of_stock" })} />
        <MetricCard label="Low Stock" value={lowStock} icon={Box} tone="amber" hint="< 100 units" />
        <MetricCard label="Avg Margin" value={`${avgMargin}%`} icon={TrendingUp} tone="teal" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          { key: "category", label: "Category", options: categories.map((c) => ({ value: c, label: c })) },
          { key: "status", label: "Status", options: STATUS_OPTIONS },
        ]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => { setSearch(""); setFilters({}); }}
        searchPlaceholder="Search by title, SKU, vendor…"
      />

      <DataTable
        data={filtered}
        onRowClick={(p) => setSelected(p)}
        emptyTitle="No products match"
        emptyDescription="Try adjusting filters or status."
        columns={[
          {
            key: "title",
            header: "Product",
            sortValue: (p) => p.title,
            render: (p) => (
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{p.sku}</div>
              </div>
            ),
          },
          {
            key: "category",
            header: "Category",
            hideOnMobile: true,
            sortValue: (p) => p.category,
            render: (p) => <span className="text-sm">{p.category}</span>,
          },
          {
            key: "vendor",
            header: "Vendor",
            hideOnMobile: true,
            sortValue: (p) => p.vendor,
            render: (p) => <span className="text-sm">{p.vendor}</span>,
          },
          {
            key: "price",
            header: "Price",
            sortValue: (p) => p.price,
            render: (p) => (
              <div>
                <div className="text-sm font-medium tabular-nums">{formatCurrencyFull(p.price)}</div>
                {p.compareAtPrice && (
                  <div className="text-xs text-muted-foreground line-through tabular-nums">{formatCurrencyFull(p.compareAtPrice)}</div>
                )}
              </div>
            ),
          },
          {
            key: "inventory",
            header: "Inventory",
            sortValue: (p) => p.inventory,
            render: (p) => (
              <span className={`text-sm tabular-nums ${p.inventory === 0 ? "text-rose-600 font-medium" : p.inventory < 100 ? "text-amber-700 font-medium" : ""}`}>
                {p.inventory}
              </span>
            ),
          },
          {
            key: "margin",
            header: "Margin",
            hideOnMobile: true,
            sortValue: (p) => p.margin,
            render: (p) => <span className="text-sm tabular-nums">{p.margin}%</span>,
          },
          {
            key: "status",
            header: "Status",
            sortValue: (p) => p.status,
            render: (p) => <StatusBadge label={p.status.replace(/_/g, " ")} color={STATUS_COLOR[p.status]} />,
          },
          {
            key: "rating",
            header: "Rating",
            hideOnMobile: true,
            sortValue: (p) => p.rating ?? 0,
            render: (p) => p.rating != null ? (
              <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                <Star className="size-3.5 text-amber-500 fill-amber-500" />
                {p.rating.toFixed(1)}
              </span>
            ) : "—",
          },
        ]}
      />

      <DetailDrawer
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.title ?? ""}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">SKU</div>
                <div className="text-sm font-medium tabular-nums">{selected.sku}</div>
              </div>
              <StatusBadge label={selected.status.replace(/_/g, " ")} color={STATUS_COLOR[selected.status]} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Category</div>
                <div className="font-medium">{selected.category}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Vendor</div>
                <div className="font-medium">{selected.vendor}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Visibility</div>
                <div className="font-medium capitalize">{selected.visibility}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Reviews</div>
                <div className="font-medium tabular-nums">{selected.reviewCount}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-md bg-muted/60">
                <div className="text-xs text-muted-foreground">Price</div>
                <div className="text-sm font-semibold tabular-nums mt-0.5">{formatCurrencyFull(selected.price)}</div>
              </div>
              <div className="p-3 rounded-md bg-muted/60">
                <div className="text-xs text-muted-foreground">Cost</div>
                <div className="text-sm font-semibold tabular-nums mt-0.5">{formatCurrencyFull(selected.cost)}</div>
              </div>
              <div className="p-3 rounded-md bg-muted/60">
                <div className="text-xs text-muted-foreground">Margin</div>
                <div className="text-sm font-semibold tabular-nums mt-0.5 text-teal-700">{selected.margin}%</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Inventory</div>
                <div className={`font-medium tabular-nums ${selected.inventory === 0 ? "text-rose-600" : selected.inventory < 100 ? "text-amber-700" : ""}`}>
                  {selected.inventory} units
                </div>
              </div>
              {selected.rating != null && (
                <div>
                  <div className="text-xs text-muted-foreground">Rating</div>
                  <div className="font-medium tabular-nums inline-flex items-center gap-1">
                    <Star className="size-3.5 text-amber-500 fill-amber-500" />
                    {selected.rating.toFixed(1)} ({selected.reviewCount})
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.info(`Restock request created for ${selected.title}.`)}
              >
                <Box className="size-3.5" /> Request Restock
              </Button>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => toast.success(`Pricing updated for ${selected.title}.`)}
              >
                <DollarSign className="size-3.5" /> Update Pricing
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
