"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  DataTable,
  StatusBadge,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, UserPlus, Building2 } from "lucide-react";
import { clinicService } from "@/services";
import { toast } from "sonner";
import type { Clinic } from "@/types";

interface Provider {
  id: string;
  name: string;
  specialty: string;
  clinicName: string;
  license: string;
  status: "active" | "inactive" | "pending";
  yearsExperience: number;
}

const MOCK_PROVIDERS: Omit<Provider, "clinicName">[] = [
  { id: "prv_1", name: "Dr. Marcus Cole", specialty: "Men's Health / TRT", license: "TX MD-11245", status: "active", yearsExperience: 12 },
  { id: "prv_2", name: "Dr. David Lin", specialty: "Hormone Optimization", license: "CA MD-77821", status: "active", yearsExperience: 9 },
  { id: "prv_3", name: "Rachel Owens, NP", specialty: "Hormone & Wellness", license: "WA APRN-44512", status: "active", yearsExperience: 7 },
  { id: "prv_4", name: "Dr. Andre Brooks", specialty: "Performance Medicine", license: "OH MD-99281", status: "active", yearsExperience: 14 },
  { id: "prv_5", name: "Vanessa Reyes, NP", specialty: "Operations / Weight Loss", license: "TX APRN-55603", status: "active", yearsExperience: 6 },
  { id: "prv_6", name: "Elena Castro, MD", specialty: "Longevity Medicine", license: "FL MD-33014", status: "active", yearsExperience: 11 },
  { id: "prv_7", name: "Tom Becker, PA-C", specialty: "Men's Health", license: "CO PA-22019", status: "active", yearsExperience: 5 },
  { id: "prv_8", name: "Dr. Henry Walsh", specialty: "Hormone Optimization", license: "OK MD-77882", status: "active", yearsExperience: 16 },
  { id: "prv_9", name: "Dr. Sarah Mitchell", specialty: "TRT & Hormones", license: "TX MD-66210", status: "pending", yearsExperience: 8 },
  { id: "prv_10", name: "Dr. James Okonkwo", specialty: "Men's Health", license: "FL MD-67890", status: "pending", yearsExperience: 12 },
  { id: "prv_11", name: "Lisa Chen, PA-C", specialty: "Weight Loss & GLP-1", license: "CO PA-54321", status: "active", yearsExperience: 6 },
  { id: "prv_12", name: "Dr. Anthony Reed", specialty: "Sexual Wellness & ED", license: "GA MD-33333", status: "active", yearsExperience: 18 },
  { id: "prv_13", name: "Dr. Marcus Bell", specialty: "Peptide & Longevity", license: "AZ MD-11111", status: "inactive", yearsExperience: 15 },
  { id: "prv_14", name: "Rachel Torres, NP", specialty: "IV Therapy", license: "TX APRN-99999", status: "pending", yearsExperience: 4 },
];

export function ProvidersView() {
  const { openClinic, refreshKey } = useNav();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    clinicService.list().then((d) => setClinics(d.clinics)).finally(() => setLoading(false));
  }, [refreshKey]);

  const rows: Provider[] = useMemo(() => {
    return MOCK_PROVIDERS.map((p, i) => {
      const clinic = clinics[i % Math.max(1, clinics.length)];
      return { ...p, clinicName: clinic?.name ?? "Unassigned" };
    });
  }, [clinics]);

  return (
    <div>
      <PageHeader
        title="Healthcare Providers"
        description={`${rows.length} providers across ${new Set(rows.map((r) => r.clinicName)).size} clinics`}
        action={
          <Button onClick={() => toast.info("Add provider form — coming soon.")}>
            <UserPlus className="size-4" />
            <span className="hidden sm:inline">Add Provider</span>
          </Button>
        }
      />

      <Card className="p-0">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Stethoscope className="size-4" /> Provider Directory
          </h3>
        </div>
        {loading ? (
          <LoadingState label="Loading providers…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Stethoscope} title="No providers" />
        ) : (
          <DataTable
            data={rows}
            columns={[
              {
                key: "name",
                header: "Provider",
                render: (p) => (
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className="font-medium">{p.name}</span>
                  </div>
                ),
                sortValue: (p) => p.name,
              },
              {
                key: "specialty",
                header: "Specialty",
                render: (p) => <span className="text-muted-foreground">{p.specialty}</span>,
                hideOnMobile: true,
              },
              {
                key: "clinic",
                header: "Clinic",
                render: (p) => (
                  <button
                    onClick={() => {
                      const clinic = clinics.find((c) => c.name === p.clinicName);
                      if (clinic) openClinic(clinic.id);
                    }}
                    className="hover:text-primary flex items-center gap-1 text-left"
                  >
                    <Building2 className="size-3 text-muted-foreground" />
                    <span className="truncate max-w-[180px]">{p.clinicName}</span>
                  </button>
                ),
                sortValue: (p) => p.clinicName,
              },
              {
                key: "license",
                header: "License #",
                render: (p) => <span className="text-xs font-mono text-muted-foreground">{p.license}</span>,
                hideOnMobile: true,
              },
              {
                key: "experience",
                header: "Years",
                render: (p) => <span className="tabular-nums">{p.yearsExperience}</span>,
                sortValue: (p) => p.yearsExperience,
                hideOnMobile: true,
              },
              {
                key: "status",
                header: "Status",
                render: (p) => (
                  <StatusBadge
                    label={p.status}
                    color={p.status === "active" ? "green" : p.status === "pending" ? "amber" : "slate"}
                  />
                ),
              },
            ]}
            pageSize={15}
          />
        )}
      </Card>
    </div>
  );
}
