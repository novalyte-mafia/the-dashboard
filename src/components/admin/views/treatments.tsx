"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  LoadingState,
  MetricCard,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Stethoscope, Building2, Activity, Sparkles } from "lucide-react";
import { clinicService } from "@/services";
import { SERVICE_CATALOG } from "@/lib/constants";
import type { Clinic } from "@/types";

export function TreatmentsView() {
  const { refreshKey } = useNav();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    clinicService.list().then((d) => setClinics(d.clinics)).finally(() => setLoading(false));
  }, [refreshKey]);

  // Count clinics offering each treatment
  const treatments = useMemo(() => {
    return SERVICE_CATALOG.map((s) => {
      const count = clinics.filter((c) => c.services.includes(s.slug)).length;
      return { ...s, clinicCount: count };
    }).sort((a, b) => b.clinicCount - a.clinicCount);
  }, [clinics]);

  const totalOfferings = treatments.reduce((s, t) => s + t.clinicCount, 0);
  const topTreatment = treatments[0];

  if (loading) {
    return (
      <div>
        <PageHeader title="Treatments" description="Catalog of men's-health treatments offered by Novalyte clinics" />
        <LoadingState label="Loading treatments…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Treatments" description="Catalog of men's-health treatments offered by Novalyte clinics" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Treatments" value={treatments.length} icon={Stethoscope} tone="teal" />
        <MetricCard label="Clinic Offerings" value={totalOfferings} icon={Activity} tone="default" hint="Sum across clinics" />
        <MetricCard label="Most Offered" value={topTreatment?.name ?? "—"} icon={Sparkles} tone="amber" hint={`${topTreatment?.clinicCount ?? 0} clinics`} />
        <MetricCard label="Total Clinics" value={clinics.length} icon={Building2} tone="default" hint="Active in pipeline" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {treatments.map((t) => {
          const pct = clinics.length ? Math.round((t.clinicCount / clinics.length) * 100) : 0;
          const tone = t.category === "core" ? "teal" : "slate";
          return (
            <Card key={t.slug} className="p-4 gap-0 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{t.category} · {t.slug}</p>
                </div>
                <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${
                  tone === "teal" ? "bg-teal-50 text-teal-700" : "bg-muted text-muted-foreground"
                }`}>
                  <Stethoscope className="size-4" />
                </div>
              </div>

              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Clinics offering</span>
                  <span className="font-semibold tabular-nums">{t.clinicCount} · {pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${tone === "teal" ? "bg-teal-500" : "bg-slate-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
