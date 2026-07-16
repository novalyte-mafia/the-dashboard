"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  MetricCard,
  SectionCard,
  ChartCard,
  LoadingState,
  DataTable,
  StatusBadge,
  ScoreBadge,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Globe2, CheckCircle2, ShieldCheck, TrendingUp, Building2, Award } from "lucide-react";
import { directoryService } from "@/services";
import { DIRECTORY_STAGES, directoryStageLabel } from "@/lib/constants";
import type { DirectoryProfile } from "@/types";

export function DirectoryAnalyticsView() {
  const { refreshKey } = useNav();
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    directoryService.list().then((d) => setProfiles(d.profiles)).finally(() => setLoading(false));
  }, [refreshKey]);

  const total = profiles.length;
  const published = profiles.filter((p) => p.listingStatus === "published").length;
  const verified = profiles.filter((p) => p.verificationStatus === "verified").length;
  const claimed = profiles.filter((p) => p.claimStatus === "verified").length;
  const avgCompleteness = total ? Math.round(profiles.reduce((s, p) => s + p.profileCompleteness, 0) / total) : 0;

  // Listings by status
  const listingsByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of profiles) counts[p.listingStatus] = (counts[p.listingStatus] ?? 0) + 1;
    return DIRECTORY_STAGES.filter((s) => counts[s.id]).map((s) => ({
      label: s.label,
      value: counts[s.id] ?? 0,
      color: "var(--primary)",
    }));
  }, [profiles]);

  // Top clinics by completeness
  const topClinics = useMemo(() => {
    return [...profiles].sort((a, b) => b.profileCompleteness - a.profileCompleteness).slice(0, 10);
  }, [profiles]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Directory Analytics" description="Listing volume, completeness, verification & claims" />
        <LoadingState label="Loading directory analytics…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Directory Analytics" description="Listing volume, completeness, verification & claims" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Listings" value={total} icon={Globe2} tone="teal" />
        <MetricCard label="Published" value={published} icon={CheckCircle2} tone="green" hint={`${total ? Math.round((published / total) * 100) : 0}% live`} />
        <MetricCard label="Verified" value={verified} icon={ShieldCheck} tone="violet" hint={`${total ? Math.round((verified / total) * 100) : 0}% verified`} />
        <MetricCard label="Avg Completeness" value={`${avgCompleteness}%`} icon={TrendingUp} tone="amber" hint={`${claimed} claimed`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Listings by Status" data={listingsByStatus} type="bar" />
        <SectionCard title="Quality Breakdown" description="Completeness distribution">
          <div className="space-y-3">
            <QualityBar label="≥ 90% complete" count={profiles.filter((p) => p.profileCompleteness >= 90).length} total={total} color="green" />
            <QualityBar label="70–89% complete" count={profiles.filter((p) => p.profileCompleteness >= 70 && p.profileCompleteness < 90).length} total={total} color="teal" />
            <QualityBar label="40–69% complete" count={profiles.filter((p) => p.profileCompleteness >= 40 && p.profileCompleteness < 70).length} total={total} color="amber" />
            <QualityBar label="< 40% complete" count={profiles.filter((p) => p.profileCompleteness < 40).length} total={total} color="rose" />
          </div>
          <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Verified Claims</p>
              <p className="text-base font-semibold text-emerald-700 tabular-nums">{claimed}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending Review</p>
              <p className="text-base font-semibold text-amber-700 tabular-nums">
                {profiles.filter((p) => p.listingStatus === "identity_review" || p.listingStatus === "claim_requested").length}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <Card className="p-0">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Award className="size-4" /> Top Clinics by Completeness
          </h3>
          <span className="text-xs text-muted-foreground">{topClinics.length} shown</span>
        </div>
        <DataTable
          data={topClinics}
          columns={[
            {
              key: "clinic",
              header: "Clinic",
              render: (p) => (
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="size-3.5 text-primary" />
                  </div>
                  <span className="font-medium truncate">{p.clinicName}</span>
                </div>
              ),
              sortValue: (p) => p.clinicName,
            },
            {
              key: "status",
              header: "Listing",
              render: (p) => (
                <StatusBadge
                  label={directoryStageLabel(p.listingStatus)}
                  color={
                    p.listingStatus === "published" ? "green" :
                    p.listingStatus === "approved" ? "teal" : "amber"
                  }
                />
              ),
              hideOnMobile: true,
            },
            {
              key: "claim",
              header: "Claim",
              render: (p) => (
                <StatusBadge
                  label={p.claimStatus}
                  color={p.claimStatus === "verified" ? "green" : p.claimStatus === "unclaimed" ? "slate" : "amber"}
                />
              ),
              hideOnMobile: true,
            },
            {
              key: "verification",
              header: "Verification",
              render: (p) => (
                <StatusBadge
                  label={p.verificationStatus}
                  color={p.verificationStatus === "verified" ? "green" : p.verificationStatus === "rejected" ? "rose" : "amber"}
                />
              ),
            },
            {
              key: "completeness",
              header: "Completeness",
              render: (p) => (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        p.profileCompleteness >= 90 ? "bg-emerald-500" :
                        p.profileCompleteness >= 60 ? "bg-amber-500" : "bg-slate-400"
                      }`}
                      style={{ width: `${p.profileCompleteness}%` }}
                    />
                  </div>
                  <ScoreBadge score={p.profileCompleteness} />
                </div>
              ),
              sortValue: (p) => p.profileCompleteness,
            },
          ]}
          pageSize={10}
        />
      </Card>
    </div>
  );
}

function QualityBar({ label, count, total, color }: { label: string; count: number; total: number; color: "green" | "teal" | "amber" | "rose" }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  const colorClass =
    color === "green" ? "bg-emerald-500" :
    color === "teal" ? "bg-teal-500" :
    color === "amber" ? "bg-amber-500" : "bg-rose-500";
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{count} · {pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
