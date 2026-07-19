"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import { workforceService } from "@/services";
import type { Professional } from "@/types";
import {
  PageHeader, MetricCard, DataTable, FilterBar, DetailDrawer, LoadingState,
  StatusBadge, ConfirmationDialog, EmptyState,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, ShieldAlert, ShieldX, FileText, Award, Calendar, CheckCircle2, XCircle,
} from "lucide-react";
import { relativeTime, formatDate } from "@/lib/format";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_COLOR: Record<string, string> = {
  verified: "green", pending: "amber", expired: "rose", rejected: "rose",
};

export function CredentialsView() {
  const { refreshKey } = useNav();
  const [data, setData] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({ status: "pending" });
  const [selected, setSelected] = useState<Professional | null>(null);
  const [confirm, setConfirm] = useState<{ type: "verify" | "reject"; pro: Professional } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadProfessionals() {
    setLoading(true);
    try {
      const result = await workforceService.listProfessionals();
      setData(result.professionals);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load credentials queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfessionals();
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return data.filter((p) => {
      if (q && !`${p.name} ${p.role} ${p.specialty}`.toLowerCase().includes(q)) return false;
      if (!filters.status) {
        if (p.credentialStatus !== "pending" && p.credentialStatus !== "expired") return false;
      } else if (p.credentialStatus !== filters.status) {
        return false;
      }
      return true;
    });
  }, [data, search, filters]);

  if (loading) return <LoadingState label="Loading credentials queue…" />;

  const pending = data.filter((p) => p.credentialStatus === "pending").length;
  const expired = data.filter((p) => p.credentialStatus === "expired").length;
  const verified = data.filter((p) => p.credentialStatus === "verified").length;
  const rejected = data.filter((p) => p.credentialStatus === "rejected").length;

  return (
    <div>
      <PageHeader
        title="Credential Reviews"
        description="Verify professional licenses and certifications"
        action={
          <Button variant="outline" onClick={() => toast.info("Bulk verify coming soon.")}>
            <ShieldCheck className="size-4" /> Bulk Verify
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Pending Review" value={pending} icon={ShieldAlert} tone="amber" onClick={() => setFilters({ status: "pending" })} />
        <MetricCard label="Expired" value={expired} icon={ShieldX} tone="rose" onClick={() => setFilters({ status: "expired" })} />
        <MetricCard label="Verified" value={verified} icon={CheckCircle2} tone="green" onClick={() => setFilters({ status: "verified" })} />
        <MetricCard label="Rejected" value={rejected} icon={XCircle} tone="default" onClick={() => setFilters({ status: "rejected" })} />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
        activeFilters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => { setSearch(""); setFilters({ status: "pending" }); }}
        searchPlaceholder="Search by name, role, specialty…"
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No credentials need review"
          description="All credentials in this view are up to date."
        />
      ) : (
        <DataTable
          data={filtered}
          onRowClick={(p) => setSelected(p)}
          columns={[
            {
              key: "name",
              header: "Professional",
              sortValue: (p) => p.name,
              render: (p) => (
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.role} · {p.specialty}</div>
                </div>
              ),
            },
            {
              key: "licenses",
              header: "Licenses",
              hideOnMobile: true,
              render: (p) => (
                <div className="flex flex-wrap gap-1">
                  {p.licenses.slice(0, 2).map((l) => (
                    <StatusBadge key={l} label={l} color="teal" />
                  ))}
                  {p.licenses.length > 2 && <StatusBadge label={`+${p.licenses.length - 2}`} color="slate" />}
                </div>
              ),
            },
            {
              key: "certifications",
              header: "Certifications",
              hideOnMobile: true,
              render: (p) => (
                <div className="flex flex-wrap gap-1">
                  {p.certifications.slice(0, 2).map((c) => (
                    <StatusBadge key={c} label={c} color="violet" />
                  ))}
                  {p.certifications.length > 2 && <StatusBadge label={`+${p.certifications.length - 2}`} color="slate" />}
                </div>
              ),
            },
            {
              key: "expiry",
              header: "Expiry",
              hideOnMobile: true,
              sortValue: (p) => p.nextCredentialExpiry ? new Date(p.nextCredentialExpiry).getTime() : 0,
              render: (p) => (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Calendar className="size-3" />
                  {p.nextCredentialExpiry ? formatDate(p.nextCredentialExpiry) : "—"}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              sortValue: (p) => p.credentialStatus,
              render: (p) => <StatusBadge label={p.credentialStatus} color={STATUS_COLOR[p.credentialStatus]} />,
            },
            {
              key: "actions",
              header: "Actions",
              render: (p) => (
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => setConfirm({ type: "verify", pro: p })}
                  >
                    <CheckCircle2 className="size-3" /> Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
                    onClick={() => setConfirm({ type: "reject", pro: p })}
                  >
                    <XCircle className="size-3" /> Reject
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <DetailDrawer
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={`Credential Review · ${selected?.name ?? ""}`}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/60">
              <div>
                <div className="text-xs text-muted-foreground">Current Status</div>
                <div className="mt-1">
                  <StatusBadge label={selected.credentialStatus} color={STATUS_COLOR[selected.credentialStatus]} />
                </div>
              </div>
              <FileText className="size-5 text-muted-foreground" />
            </div>

            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Licenses</div>
              {selected.licenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No licenses on file.</p>
              ) : (
                <div className="space-y-2">
                  {selected.licenses.map((l) => (
                    <div key={l} className="flex items-center justify-between p-2.5 rounded-md border border-border/60">
                      <div>
                        <div className="text-sm font-medium">{l}</div>
                        <div className="text-xs text-muted-foreground">Active license</div>
                      </div>
                      <Award className="size-4 text-teal-600" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Certifications</div>
              {selected.certifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No certifications on file.</p>
              ) : (
                <div className="space-y-2">
                  {selected.certifications.map((c) => (
                    <div key={c} className="flex items-center justify-between p-2.5 rounded-md border border-border/60">
                      <div>
                        <div className="text-sm font-medium">{c}</div>
                        <div className="text-xs text-muted-foreground">Board / Body certified</div>
                      </div>
                      <Award className="size-4 text-violet-600" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selected.nextCredentialExpiry && (
              <div className="p-3 rounded-md border border-amber-200 bg-amber-50">
                <div className="text-xs text-amber-800 font-medium">Next Expiry</div>
                <div className="text-sm font-semibold mt-0.5 text-amber-900">
                  {formatDate(selected.nextCredentialExpiry)}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Joined network {relativeTime(selected.createdAt)}
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => { setConfirm({ type: "verify", pro: selected }); }}
              >
                <CheckCircle2 className="size-3.5" /> Verify Credentials
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-rose-600 hover:text-rose-700"
                onClick={() => { setConfirm({ type: "reject", pro: selected }); }}
              >
                <XCircle className="size-3.5" /> Reject
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>

      <ConfirmationDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.type === "verify" ? "Verify Credentials" : "Reject Credentials"}
        description={
          confirm?.type === "verify"
            ? `Confirm that you have reviewed and verified the licenses and certifications for ${confirm?.pro.name}. Pending documents will be marked verified.`
            : `Reject credentials for ${confirm?.pro.name}? Pending documents will be marked rejected.`
        }
        confirmLabel={confirm?.type === "verify" ? "Verify" : "Reject"}
        destructive={confirm?.type === "reject"}
        onConfirm={async () => {
          if (!confirm || submitting) return;
          setSubmitting(true);
          try {
            const result = await workforceService.reviewProfessionalCredentials(
              confirm.pro.id,
              confirm.type === "verify" ? "verify" : "reject",
            );
            await loadProfessionals();
            if (confirm.type === "verify") {
              toast.success(`Credentials verified for ${confirm.pro.name} (${result.updatedCount} document${result.updatedCount === 1 ? "" : "s"}).`);
            } else {
              toast.error(`Credentials rejected for ${confirm.pro.name}.`);
            }
            setSelected(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to update credentials.");
          } finally {
            setSubmitting(false);
            setConfirm(null);
          }
        }}
      />
    </div>
  );
}
