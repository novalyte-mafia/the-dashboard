"use client";

import { useEffect, useMemo, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, MetricCard, SectionCard, EmptyState, LoadingState, DataTable,
  StatusBadge, type Column,
} from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, FileUp,
  Download, ArrowRight, Database, Building2,
} from "lucide-react";
import { clinicService } from "@/services";
import type { Clinic } from "@/types";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ImportRecord = {
  id: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  rowCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  status: "completed" | "processing" | "failed" | "partial";
  duration: string;
};

const COLUMN_MAPPING = [
  { csv: "Clinic Name", target: "name", required: true, sample: "Summit Vitality Clinic" },
  { csv: "Phone", target: "primaryPhone", required: true, sample: "(512) 555-0142" },
  { csv: "Email", target: "generalEmail", required: false, sample: "info@summitvitality.com" },
  { csv: "City", target: "city", required: true, sample: "Austin" },
  { csv: "State", target: "state", required: true, sample: "TX" },
  { csv: "ZIP", target: "zip", required: false, sample: "78701" },
  { csv: "Website", target: "website", required: false, sample: "https://summitvitality.com" },
  { csv: "Services", target: "services", required: false, sample: "TRT; GLP-1; Peptide Therapy" },
  { csv: "Owner Name", target: "owner", required: false, sample: "Marcus Cole" },
  { csv: "Source", target: "source", required: false, sample: "directory_import" },
];

export function ImportCenterView() {
  const { navigate, refreshKey } = useNav();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "review">("upload");
  const [importHistory] = useState<ImportRecord[]>([
    {
      id: "imp_1",
      fileName: "texas_clinics_q3.csv",
      uploadedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      uploadedBy: "Jamil Yakasai",
      rowCount: 124,
      importedCount: 118,
      skippedCount: 4,
      errorCount: 2,
      status: "completed",
      duration: "8s",
    },
    {
      id: "imp_2",
      fileName: "florida_mens_health.csv",
      uploadedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      uploadedBy: "Devon Marsh",
      rowCount: 86,
      importedCount: 82,
      skippedCount: 3,
      errorCount: 1,
      status: "completed",
      duration: "6s",
    },
    {
      id: "imp_3",
      fileName: "national_directory_export.csv",
      uploadedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      uploadedBy: "Amani Okafor",
      rowCount: 412,
      importedCount: 398,
      skippedCount: 12,
      errorCount: 2,
      status: "partial",
      duration: "23s",
    },
    {
      id: "imp_4",
      fileName: "california_clinics.csv",
      uploadedAt: new Date(Date.now() - 21 * 86400000).toISOString(),
      uploadedBy: "Jamil Yakasai",
      rowCount: 67,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 67,
      status: "failed",
      duration: "4s",
    },
  ]);

  useEffect(() => {
    setLoading(true);
    clinicService
      .list()
      .then((d) => setClinics(d.clinics))
      .catch(() => toast.error("Failed to load clinics"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const totalImports = importHistory.length;
  const totalImported = importHistory.reduce((s, r) => s + r.importedCount, 0);
  const totalErrors = importHistory.reduce((s, r) => s + r.errorCount, 0);
  const successRate = importHistory.length > 0
    ? Math.round((importHistory.filter((r) => r.status === "completed").length / importHistory.length) * 100)
    : 0;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStep("mapping");
    toast.success(`Loaded ${file.name} — review column mapping below`);
  }

  function startImport() {
    const promise = fetch("/api/clinics/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: false })
    }).then(async (r) => {
      const res = await r.json();
      if (!r.ok || !res.success) throw new Error(res.error || "Import failed");
      setStep("upload");
      setFileName(null);
      return res;
    });

    toast.promise(promise, {
      loading: `Importing ${fileName || "CSV file"}...`,
      success: (data) => `Import completed! ${data.imported} clinics imported, ${data.duplicates} duplicates skipped.`,
      error: (err) => `Failed: ${err.message}`
    });
  }

  function downloadTemplate() {
    toast.success("Template download started — clinics_import_template.csv");
  }

  const statusColor: Record<string, string> = {
    completed: "green",
    processing: "amber",
    failed: "rose",
    partial: "amber",
  };

  const historyColumns: Column<ImportRecord>[] = useMemo(() => [
    {
      key: "file",
      header: "File",
      render: (r) => (
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-muted-foreground" />
          <span className="font-mono text-sm">{r.fileName}</span>
        </div>
      ),
      sortValue: (r) => r.fileName,
    },
    {
      key: "uploaded",
      header: "Uploaded",
      render: (r) => (
        <div>
          <p className="text-sm">{formatDate(r.uploadedAt)}</p>
          <p className="text-xs text-muted-foreground">{r.uploadedBy}</p>
        </div>
      ),
      sortValue: (r) => r.uploadedAt,
      hideOnMobile: true,
    },
    {
      key: "rows",
      header: "Rows",
      render: (r) => <span className="tabular-nums">{r.rowCount}</span>,
      sortValue: (r) => r.rowCount,
    },
    {
      key: "imported",
      header: "Imported",
      render: (r) => <span className="tabular-nums text-emerald-600 font-medium">{r.importedCount}</span>,
      sortValue: (r) => r.importedCount,
    },
    {
      key: "skipped",
      header: "Skipped",
      render: (r) => <span className="tabular-nums text-amber-600">{r.skippedCount}</span>,
      sortValue: (r) => r.skippedCount,
      hideOnMobile: true,
    },
    {
      key: "errors",
      header: "Errors",
      render: (r) => <span className={cn("tabular-nums", r.errorCount > 0 ? "text-rose-600 font-medium" : "text-muted-foreground")}>{r.errorCount}</span>,
      sortValue: (r) => r.errorCount,
      hideOnMobile: true,
    },
    {
      key: "duration",
      header: "Duration",
      render: (r) => <span className="text-sm text-muted-foreground tabular-nums">{r.duration}</span>,
      sortValue: (r) => r.duration,
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge label={r.status} color={statusColor[r.status] ?? "slate"} />,
      sortValue: (r) => r.status,
    },
  ], []);

  if (loading) return <LoadingState label="Loading import center…" />;

  return (
    <div>
      <PageHeader
        title="Import Center"
        description="Bulk-import clinic records from CSV files"
        action={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="size-4" /> Download template
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Imports" value={totalImports} icon={FileUp} tone="teal" />
        <MetricCard label="Clinics Imported" value={totalImported} icon={Database} tone="green" hint={`${clinics.length} total in DB`} onClick={() => navigate("clinics")} />
        <MetricCard label="Import Errors" value={totalErrors} icon={AlertTriangle} tone="rose" />
        <MetricCard label="Success Rate" value={`${successRate}%`} icon={CheckCircle2} tone="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Upload area */}
        <SectionCard
          title="Upload CSV"
          description="Drop a CSV file or browse to begin"
          className="lg:col-span-1"
          bodyClassName="p-4"
        >
          <label
            htmlFor="csv-upload"
            className={cn(
              "block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              fileName ? "border-primary/50 bg-primary/5" : "border-border hover:bg-accent/40"
            )}
          >
            <input
              id="csv-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <Upload className={cn("size-8 mx-auto mb-2", fileName ? "text-primary" : "text-muted-foreground")} />
            {fileName ? (
              <div>
                <p className="text-sm font-medium truncate">{fileName}</p>
                <p className="text-xs text-muted-foreground mt-1">Click to replace</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">Click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">CSV, XLS, XLSX up to 10MB</p>
              </div>
            )}
          </label>
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <p>Required columns:</p>
            <p className="font-mono">Clinic Name, Phone, City, State</p>
          </div>
        </SectionCard>

        {/* Column mapping preview */}
        <SectionCard
          title="Column Mapping"
          description={fileName ? `Preview for ${fileName}` : "Upload a file to preview mapping"}
          className="lg:col-span-2"
          bodyClassName="p-0"
          action={fileName ? (
            <Button size="sm" onClick={startImport}>
              <ArrowRight className="size-3.5" /> Start import
            </Button>
          ) : undefined}
        >
          {!fileName ? (
            <EmptyState icon={FileSpreadsheet} title="No file uploaded" description="Upload a CSV to preview the column mapping." />
          ) : (
            <div className="overflow-x-auto nv-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="font-medium text-muted-foreground px-3 py-2.5">CSV Column</th>
                    <th className="font-medium text-muted-foreground px-3 py-2.5">Maps To</th>
                    <th className="font-medium text-muted-foreground px-3 py-2.5">Sample Value</th>
                    <th className="font-medium text-muted-foreground px-3 py-2.5 text-center">Required</th>
                    <th className="font-medium text-muted-foreground px-3 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {COLUMN_MAPPING.map((m, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-accent/30">
                      <td className="px-3 py-2 font-mono text-xs">{m.csv}</td>
                      <td className="px-3 py-2">
                        <select
                          defaultValue={m.target}
                          className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value={m.target}>{m.target}</option>
                          <option value="">— Skip —</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{m.sample}</td>
                      <td className="px-3 py-2 text-center">
                        {m.required ? (
                          <span className="text-rose-500 text-xs font-medium">Yes</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <CheckCircle2 className="size-4 text-emerald-500 inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Import History"
        description={`${importHistory.length} past import${importHistory.length === 1 ? "" : "s"}`}
        bodyClassName="p-0"
        action={<Button variant="ghost" size="sm" onClick={() => navigate("clinics")}>View clinics <ArrowRight className="size-3.5" /></Button>}
      >
        <DataTable
          columns={historyColumns}
          data={importHistory}
          pageSize={10}
        />
      </SectionCard>
    </div>
  );
}
