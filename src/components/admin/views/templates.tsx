"use client";

import { useEffect, useState } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader, SectionCard, LoadingState, EmptyState, StatusBadge,
} from "@/components/admin/shared";
import { FileText, ClipboardList } from "lucide-react";
import { toast } from "sonner";

type PageTemplate = {
  id: string;
  slug: string;
  name: string;
  page_type: string;
  description: string | null;
  versions: { id: string; version: number; required_modules: string[] }[];
};

type AssessmentTemplate = {
  id: string;
  slug: string;
  name: string;
  category: string;
  assessment_engine_slug: string;
  mode: string;
  latestVersion: { id: string; version: number; status: string } | null;
};

export function TemplatesView() {
  const { refreshKey } = useNav();
  const [pageTemplates, setPageTemplates] = useState<PageTemplate[]>([]);
  const [assessments, setAssessments] = useState<AssessmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/campaigns/templates").then((r) => r.json()),
      fetch("/api/campaigns/assessments").then((r) => (r.ok ? r.json() : { assessments: [] })),
    ])
      .then(([tData, aData]) => {
        setPageTemplates(tData.templates ?? []);
        setAssessments(aData.assessments ?? []);
      })
      .catch(() => toast.error("Unable to load templates."))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return <LoadingState label="Loading templates…" />;

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Landing page layouts and embedded assessment templates"
      />

      <SectionCard title="Page templates" className="mb-5">
        {pageTemplates.length === 0 ? (
          <EmptyState icon={FileText} title="No page templates" description="Seed templates via migration." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {pageTemplates.map((t) => (
              <div key={t.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.slug} · {t.page_type.replace(/_/g, " ")}</p>
                  </div>
                  <StatusBadge label={`v${t.versions[0]?.version ?? 1}`} color="teal" />
                </div>
                {t.description && <p className="text-sm text-muted-foreground mt-2">{t.description}</p>}
                {t.versions[0]?.required_modules?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Required: {t.versions[0].required_modules.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Assessment templates">
        {assessments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No assessment templates"
            description="Assessment templates appear when cs_assessment_templates is migrated."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {assessments.map((a) => (
              <div key={a.id} className="rounded-lg border p-4">
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.category} · {a.mode}
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{a.assessment_engine_slug}</p>
                {a.latestVersion && (
                  <p className="text-xs mt-2">
                    Published version {a.latestVersion.version}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
