"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, SectionCard, EmptyState, StatusBadge } from "@/components/admin/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Database, Search, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

type KnowledgeEntry = {
  id: string;
  category: string;
  title: string;
  content: string;
  tags?: string[];
  keywords?: string[];
  approval_status?: string;
  external_approved?: boolean;
  confidence?: number;
  source_section?: string;
};

type RetrievalResult = {
  chunks: Array<{ id: string; title: string; content: string; category: string; source: string; section: string; score: number }>;
  categories: string[];
  latencyMs: number;
};

export function CallCopilotKnowledgeView() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [testQuery, setTestQuery] = useState("Is the directory listing free?");
  const [testResult, setTestResult] = useState<RetrievalResult | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/copilot/knowledge");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      toast.error("Failed to load knowledge entries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const runSearch = async () => {
    if (!search.trim()) {
      void loadEntries();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/copilot/knowledge?q=${encodeURIComponent(search.trim())}`);
      const data = await res.json();
      setEntries((data.chunks ?? []).map((c: any) => ({
        id: c.id,
        category: c.category,
        title: c.title,
        content: c.content,
        source_section: c.section,
      })));
    } finally {
      setLoading(false);
    }
  };

  const seedDatabase = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/copilot/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Seed failed");
      toast.success(`Seeded ${data.inserted} approved knowledge entries.`);
      void loadEntries();
    } catch (error: any) {
      toast.error(error?.message ?? "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const testRetrieval = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/copilot/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_retrieval", query: testQuery }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      toast.error("Retrieval test failed.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Call Copilot Knowledge"
        description="Approved Novalyte AI business knowledge used by the live call copilot. Update talk tracks here — no code changes required."
        action={
          <Button onClick={() => void seedDatabase()} disabled={seeding} className="gap-2">
            <Upload className="size-4" /> {seeding ? "Seeding…" : "Seed approved bundle"}
          </Button>
        }
      />

      <SectionCard title="Search knowledge">
        <div className="flex gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by question, topic, or keyword…" />
          <Button onClick={() => void runSearch()}>Search</Button>
        </div>
      </SectionCard>

      <SectionCard title="Test retrieval">
        <div className="space-y-3">
          <Textarea value={testQuery} onChange={(e) => setTestQuery(e.target.value)} rows={2} placeholder="Simulate a clinic question…" />
          <Button onClick={() => void testRetrieval()} disabled={testing}>
            {testing ? "Testing…" : "Preview retrieved knowledge"}
          </Button>
          {testResult && (
            <div className="text-xs space-y-2 border rounded-lg p-3 bg-muted/20">
              <p className="text-muted-foreground">Latency: {testResult.latencyMs}ms · Categories: {testResult.categories.join(", ")}</p>
              {testResult.chunks.map((chunk) => (
                <div key={chunk.id} className="border rounded p-2 bg-background">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{chunk.title}</span>
                    <Badge variant="outline" className="text-[10px]">score {chunk.score.toFixed(1)}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{chunk.content}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{chunk.source}{chunk.section ? ` · ${chunk.section}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Knowledge entries">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <EmptyState title="No entries yet" description="Seed the approved bundle or add entries via Supabase." />
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto nv-scroll">
            {entries.map((entry) => (
              <div key={entry.id} className="border rounded-lg p-3 bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{entry.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <StatusBadge label={entry.category.replace(/_/g, " ")} />
                      {entry.approval_status && <Badge variant="outline" className="text-[10px]">{entry.approval_status}</Badge>}
                      {entry.external_approved && <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200">external OK</Badge>}
                    </div>
                  </div>
                  {entry.confidence != null && (
                    <span className="text-[10px] font-mono text-muted-foreground">{Math.round(entry.confidence * 100)}%</span>
                  )}
                </div>
                <p className="text-xs mt-2 text-muted-foreground leading-relaxed">{entry.content}</p>
                {entry.source_section && <p className="text-[10px] mt-1 text-muted-foreground">Section: {entry.source_section}</p>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
