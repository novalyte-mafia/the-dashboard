"use client";

import { useEffect, useMemo, useState } from "react";
import { callService } from "@/services";
import type { CallSession } from "@/types";
import {
  PageHeader, MetricCard, SectionCard, LoadingState, EmptyState,
  StatusBadge, FilterBar,
} from "@/components/admin/shared/index";
import { Button } from "@/components/ui/button";
import {
  Phone, PhoneCall, Smile, Frown, Meh, MessageSquare, AlertCircle, CheckCircle2, Quote,
} from "lucide-react";
import { formatDateTime, relativeTime } from "@/lib/format";
import { toast } from "sonner";

interface CallAnalysis {
  callId: string;
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number; // -100 to 100
  keyTopics: string[];
  objections: string[];
  nextActions: { action: string; priority: "high" | "medium" | "low" }[];
  transcriptSnippet: string;
  talkRatio: { agent: number; prospect: number };
  duration: number;
  outcome: string;
}

const MOCK_ANALYSES: CallAnalysis[] = [
  {
    callId: "call_1",
    sentiment: "positive",
    sentimentScore: 62,
    keyTopics: ["TRT program pricing", "Pilot scope", "Patient demand data"],
    objections: ["Cost concerns", "Need to discuss with partner"],
    nextActions: [
      { action: "Send pilot proposal with pricing tiers", priority: "high" },
      { action: "Schedule follow-up call with co-founder next week", priority: "high" },
      { action: "Share Miami market demand report", priority: "medium" },
    ],
    transcriptSnippet: "Dr. Yakasai: 'So the way our pilot works is we'd run a 90-day TRT patient acquisition campaign, and you only pay for performance above your current baseline.' Prospect: 'That's actually interesting — I've been looking for something that aligns incentives. But the setup fee feels steep for a clinic our size.'",
    talkRatio: { agent: 42, prospect: 58 },
    duration: 847,
    outcome: "interested",
  },
  {
    callId: "call_2",
    sentiment: "neutral",
    sentimentScore: 8,
    keyTopics: ["Existing vendor relationship", "Telehealth platform", "Onboarding timeline"],
    objections: ["Already has marketing agency", "No bandwidth this quarter"],
    nextActions: [
      { action: "Send differentiated value prop one-pager", priority: "medium" },
      { action: "Re-engage in Q2", priority: "low" },
    ],
    transcriptSnippet: "Dr. Yakasai: 'What would it take for you to consider switching or adding us as a complementary partner?' Prospect: 'Honestly, we just signed a six-month contract with another agency. Maybe revisit in the spring?'",
    talkRatio: { agent: 55, prospect: 45 },
    duration: 612,
    outcome: "call_back_requested",
  },
  {
    callId: "call_3",
    sentiment: "positive",
    sentimentScore: 78,
    keyTopics: ["Directory listing", "Patient leads", "Verification process"],
    objections: [],
    nextActions: [
      { action: "Approve directory listing — docs received", priority: "high" },
      { action: "Route first 3 patient leads this week", priority: "high" },
      { action: "Send onboarding welcome packet", priority: "medium" },
    ],
    transcriptSnippet: "Prospect: 'Yeah, I read through everything you sent and I'm impressed. The patient demand report for Austin was the kicker — we've been wanting to grow TRT but didn't have the demand data.' Dr. Yakasai: 'Perfect. I'll get your listing approved today and we'll start routing leads this week.'",
    talkRatio: { agent: 38, prospect: 62 },
    duration: 924,
    outcome: "meeting_booked",
  },
  {
    callId: "call_4",
    sentiment: "negative",
    sentimentScore: -34,
    keyTopics: ["Pricing", "Contract terms", "Cancellation"],
    objections: ["Too expensive", "Contract too long", "No clarity on results"],
    nextActions: [
      { action: "Send flexible pricing options (month-to-month)", priority: "high" },
      { action: "Share 3 case studies with similar clinics", priority: "medium" },
      { action: "Consider pausing outreach for 30 days", priority: "low" },
    ],
    transcriptSnippet: "Prospect: 'Look, I appreciate the pitch but your pricing is way above what we budgeted. And a 12-month contract with no exit clause? That's a non-starter.' Dr. Yakasai: 'I hear you — let me put together some month-to-month options and send over case studies of clinics your size.'",
    talkRatio: { agent: 48, prospect: 52 },
    duration: 734,
    outcome: "not_interested",
  },
  {
    callId: "call_5",
    sentiment: "neutral",
    sentimentScore: 24,
    keyTopics: ["GLP-1 patient demand", "Telehealth expansion", "Quarterly planning"],
    objections: ["Need CMO sign-off"],
    nextActions: [
      { action: "Schedule joint call with CMO next Thursday", priority: "high" },
      { action: "Send GLP-1 market brief", priority: "medium" },
    ],
    transcriptSnippet: "Prospect: 'The GLP-1 demand data is compelling. I'd want to bring our CMO into the next conversation before committing to anything.' Dr. Yakasai: 'Absolutely. Let me send over the market brief and we'll get something on the calendar with your CMO.'",
    talkRatio: { agent: 44, prospect: 56 },
    duration: 689,
    outcome: "meeting_booked",
  },
];

const SENTIMENT_META = {
  positive: { label: "Positive", color: "green", icon: Smile },
  neutral: { label: "Neutral", color: "amber", icon: Meh },
  negative: { label: "Negative", color: "rose", icon: Frown },
};

export function CallIntelligenceView() {
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<Record<string, string>>({});

  useEffect(() => {
    callService.listAll()
      .then((d) => setCalls(d.calls))
      .finally(() => setLoading(false));
  }, []);

  const analysesWithCalls = useMemo(() => {
    return MOCK_ANALYSES.map((a) => {
      const call = calls.find((c) => c.id === a.callId);
      return { ...a, call };
    }).filter((a) => a.call);
  }, [calls]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return analysesWithCalls.filter((a) => {
      if (q && !`${a.call!.clinicName} ${a.keyTopics.join(" ")} ${a.objections.join(" ")}`.toLowerCase().includes(q)) return false;
      if (sentimentFilter.sentiment && a.sentiment !== sentimentFilter.sentiment) return false;
      return true;
    });
  }, [analysesWithCalls, search, sentimentFilter]);

  if (loading) return <LoadingState label="Loading call intelligence…" />;

  const totalCalls = analysesWithCalls.length;
  const positive = analysesWithCalls.filter((a) => a.sentiment === "positive").length;
  const negative = analysesWithCalls.filter((a) => a.sentiment === "negative").length;
  const avgSentiment = totalCalls > 0 ? Math.round(analysesWithCalls.reduce((s, a) => s + a.sentimentScore, 0) / totalCalls) : 0;

  const formatDuration = (sec: number) => `${Math.floor(sec / 60)}m ${sec % 60}s`;

  return (
    <div>
      <PageHeader
        title="Call Intelligence"
        description="AI-analyzed call transcripts with sentiment, topics, and next actions"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Calls Analyzed" value={totalCalls} icon={PhoneCall} tone="teal" />
        <MetricCard label="Positive" value={positive} icon={Smile} tone="green" hint={`${totalCalls > 0 ? Math.round((positive / totalCalls) * 100) : 0}% of total`} />
        <MetricCard label="Negative" value={negative} icon={Frown} tone="rose" hint={`${totalCalls > 0 ? Math.round((negative / totalCalls) * 100) : 0}% of total`} />
        <MetricCard label="Avg Sentiment" value={avgSentiment > 0 ? `+${avgSentiment}` : avgSentiment} icon={MessageSquare} tone={avgSentiment > 20 ? "green" : avgSentiment < -10 ? "rose" : "amber"} hint="-100 to +100 scale" />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={[
          { key: "sentiment", label: "Sentiment", options: [
            { value: "positive", label: "Positive" },
            { value: "neutral", label: "Neutral" },
            { value: "negative", label: "Negative" },
          ] },
        ]}
        activeFilters={sentimentFilter}
        onFilterChange={(k, v) => setSentimentFilter((f) => ({ ...f, [k]: v }))}
        onClear={() => { setSearch(""); setSentimentFilter({}); }}
        searchPlaceholder="Search by clinic, topic, objection…"
      />

      {filtered.length === 0 ? (
        <EmptyState icon={Phone} title="No analyzed calls" description="Connect your call system to enable AI transcripts." />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const meta = SENTIMENT_META[a.sentiment];
            const SentimentIcon = meta.icon;
            return (
              <SectionCard key={a.callId} bodyClassName="p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`size-10 rounded-lg flex items-center justify-center ${
                        a.sentiment === "positive" ? "bg-emerald-50 text-emerald-600"
                        : a.sentiment === "negative" ? "bg-rose-50 text-rose-600"
                        : "bg-amber-50 text-amber-600"
                      }`}>
                        <SentimentIcon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{a.call!.clinicName}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(a.call!.startedAt)} · {formatDuration(a.duration)} · agent {a.call!.adminName ?? "—"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge label={meta.label} color={meta.color} />
                      <StatusBadge label={`Score ${a.sentimentScore > 0 ? "+" : ""}${a.sentimentScore}`} color="slate" className="tabular-nums" />
                      <StatusBadge label={a.outcome.replace(/_/g, " ")} color="teal" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Key Topics</div>
                      <div className="flex flex-wrap gap-1">
                        {a.keyTopics.map((t) => (
                          <StatusBadge key={t} label={t} color="teal" className="!text-[10px]" />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Objections</div>
                      {a.objections.length === 0 ? (
                        <span className="text-xs text-emerald-600 inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> None detected
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {a.objections.map((o) => (
                            <StatusBadge key={o} label={o} color="rose" className="!text-[10px]" />
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Talk Ratio</div>
                      <div className="flex items-center gap-1 h-5 rounded-md overflow-hidden">
                        <div className="bg-teal-500 text-white text-[10px] font-medium flex items-center justify-center" style={{ width: `${a.talkRatio.agent}%` }}>
                          {a.talkRatio.agent}%
                        </div>
                        <div className="bg-violet-500 text-white text-[10px] font-medium flex items-center justify-center" style={{ width: `${a.talkRatio.prospect}%` }}>
                          {a.talkRatio.prospect}%
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                        <span>Agent</span>
                        <span>Prospect</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-md bg-muted/40 border-l-2 border-teal-500">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide inline-flex items-center gap-1 mb-1">
                      <Quote className="size-3" /> Transcript Snippet
                    </div>
                    <p className="text-sm leading-relaxed italic">{a.transcriptSnippet}</p>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">AI-Recommended Next Actions</div>
                    <div className="space-y-1.5">
                      {a.nextActions.map((na, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className={`size-1.5 rounded-full ${
                            na.priority === "high" ? "bg-rose-500"
                            : na.priority === "medium" ? "bg-amber-500"
                            : "bg-slate-400"
                          }`} />
                          <span>{na.action}</span>
                          <StatusBadge label={na.priority} color={na.priority === "high" ? "rose" : na.priority === "medium" ? "amber" : "slate"} className="ml-auto !text-[10px]" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => toast.info("Opening full transcript…")}>
                      <MessageSquare className="size-3.5" /> Full Transcript
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toast.success("Next actions converted to follow-up tasks.")}>
                      <CheckCircle2 className="size-3.5" /> Create Tasks
                    </Button>
                    {a.sentiment === "negative" && (
                      <Button variant="outline" size="sm" className="ml-auto text-rose-600" onClick={() => toast.info("Flagged for manager review.")}>
                        <AlertCircle className="size-3.5" /> Flag for Review
                      </Button>
                    )}
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
