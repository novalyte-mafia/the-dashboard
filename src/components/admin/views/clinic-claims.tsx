"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { workforceService } from "@/services";
import type { ClinicClaim } from "@/types";
import {
  PageHeader, DataTable, FilterBar, LoadingState, StatusBadge, ConfirmationDialog,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import { relativeTime } from "@/lib/format";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "revoked", label: "Revoked" },
];

export function ClinicClaimsView() {
  const { refreshKey } = useNav();
  const [data, setData] = useState<ClinicClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({ status: "submitted" });
  const [confirm, setConfirm] = useState<{ action: "approve" | "reject"; claim: ClinicClaim } | null>(null);

  useEffect(() => {
    setLoading(true);
    workforceService
      .listClinicClaims()
      .then((d) => setData(d.claims))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load clinic claims."))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((claim) => {
      if (filters.status && claim.status !== filters.status) return false;
      if (
        q &&
        !`${claim.clinicName} ${claim.organizationName} ${claim.status}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data, search, filters]);

  if (loading) return <LoadingState label="Loading clinic claims..." />;

  return (
    <div>
      <PageHeader
        title="Clinic Claims"
        description="Review employer organization claims against public Clinic profiles"
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => {
          setSearch("");
          setFilters({ status: "submitted" });
        }}
        searchPlaceholder="Search clinic or organization..."
      />

      <DataTable
        data={filtered}
        emptyTitle="No clinic claims"
        emptyDescription="Submitted employer clinic claims will appear here for review."
        columns={[
          {
            key: "clinic",
            header: "Clinic",
            render: (claim) => (
              <div>
                <div className="font-medium">{claim.clinicName}</div>
                <div className="text-xs text-muted-foreground">
                  {[claim.clinicCity, claim.clinicState].filter(Boolean).join(", ")}
                </div>
              </div>
            ),
          },
          {
            key: "org",
            header: "Organization",
            render: (claim) => claim.organizationName,
          },
          {
            key: "status",
            header: "Status",
            render: (claim) => (
              <StatusBadge
                label={claim.status}
                color={claim.status === "approved" ? "green" : claim.status === "rejected" ? "rose" : "amber"}
              />
            ),
          },
          {
            key: "created",
            header: "Submitted",
            render: (claim) => relativeTime(claim.createdAt),
          },
          {
            key: "actions",
            header: "",
            render: (claim) =>
              claim.status === "submitted" || claim.status === "under_review" ? (
                <div className="flex gap-2 justify-end">
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setConfirm({ action: "approve", claim })}>
                    <CheckCircle2 className="size-3" /> Approve
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-rose-600" onClick={() => setConfirm({ action: "reject", claim })}>
                    <XCircle className="size-3" /> Reject
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Building2 className="size-3" /> {claim.reviewedBy ?? "Reviewed"}
                </span>
              ),
          },
        ]}
      />

      <ConfirmationDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.action === "approve" ? "Approve clinic claim" : "Reject clinic claim"}
        description={
          confirm?.action === "approve"
            ? `Approve claim for ${confirm.claim.clinicName}? The clinic will be linked to the organization.`
            : `Reject claim for ${confirm?.claim.clinicName ?? "this clinic"}?`
        }
        confirmLabel={confirm?.action === "approve" ? "Approve" : "Reject"}
        destructive={confirm?.action === "reject"}
        onConfirm={async () => {
          if (!confirm) return;
          try {
            await workforceService.reviewClinicClaim(confirm.claim.id, confirm.action);
            toast.success(`Claim ${confirm.action}d.`);
            setData((prev) =>
              prev.map((c) =>
                c.id === confirm.claim.id
                  ? { ...c, status: confirm.action === "approve" ? "approved" : "rejected" }
                  : c,
              ),
            );
            setConfirm(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to review claim.");
          }
        }}
      />
    </div>
  );
}
