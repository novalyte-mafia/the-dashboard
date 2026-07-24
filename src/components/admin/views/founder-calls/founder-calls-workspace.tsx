"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PhoneCall,
  Building2,
  MapPin,
  Clock,
  Ban,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  History,
  Target,
  Globe,
  User,
  List,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mic,
} from "lucide-react";
import { toast } from "sonner";
import { formatPhone, localTime, relativeTime } from "@/lib/format";
import { CALL_OUTCOMES } from "@/lib/constants";
import {
  FOUNDER_CALL_OBJECTIVE,
  FOUNDER_OBJECTIVE_CHECKLIST,
} from "@/lib/calls/founder-led-script";
import { LogCallDialog } from "@/components/admin/log-call-dialog";
import { ScriptStepper } from "./script-stepper";
import { ClinicIntelligencePanel } from "./clinic-intelligence-panel";
import type { ClinicIntelligenceProfile } from "@/lib/clinic-intelligence/types";
import {
  ALL_MARKETS_SLUG,
  MARKET_STORAGE_KEY,
  type MarketQueueFilter,
  type MarketQueueSort,
  type MarketSprint,
  type MarketSprintMetrics,
} from "@/lib/market-sprints/types";

type QueueClinic = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  zip?: string | null;
  timezone: string | null;
  primaryPhone: string | null;
  website?: string | null;
  pipelineStage: string;
  priority?: string;
  readinessScore?: number;
  callAttempts: number;
  lastContactedAt: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  telehealth?: boolean | null;
  notes?: string | null;
  interested?: boolean;
  doNotCall?: boolean;
  directoryStatus?: string;
  operatingStatus?: string;
  services?: string[];
  decisionMaker?: {
    firstName?: string;
    lastName?: string;
    title?: string;
    email?: string;
    isDecisionMaker?: boolean;
  } | null;
  followUp?: { id: string; dueDate?: string } | null;
  market?: {
    cohortStatus?: string;
    researchStatus?: string;
    duplicateOfClinicId?: string | null;
    duplicateFlags?: string[];
    verificationFlags?: string[];
    matchConfidence?: string;
    priority?: number;
  } | null;
  intelligence?: {
    researchStatus?: string;
    fitStatus?: string;
    fitScore?: number | null;
    priority?: string;
    shortSummary?: string | null;
    primaryCategory?: string | null;
    services?: string[];
    conversationFocus?: string | null;
    researchCompleteness?: number;
    missingInformation?: string[];
    notableFacts?: Array<{ text: string; confidence?: string }>;
    websiteUrl?: string | null;
    bookingUrl?: string | null;
    personalizedOpening?: string | null;
    novalyteFitReason?: string | null;
  } | null;
};

type FounderCall = {
  id: string;
  clinicId: string;
  status: string;
  startedAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  externalNumber: string | null;
  outcome: string | null;
  notes: string | null;
  mode: string | null;
  provider?: string | null;
  recordingAvailable?: boolean;
  transcriptStatus?: string | null;
};

type CenterTab = "brief" | "intel" | "script" | "history" | "activity";

const FILTERS: { id: MarketQueueFilter; label: string }[] = [
  { id: "ready_to_call", label: "Ready to Call" },
  { id: "research_needed", label: "Research Needed" },
  { id: "never_called", label: "Never Called" },
  { id: "follow_up_due", label: "Follow-Up Due" },
  { id: "attempted", label: "Attempted" },
  { id: "interested", label: "Interested" },
  { id: "permission_granted", label: "Permission Granted" },
  { id: "review_pending", label: "Review Pending" },
  { id: "approved", label: "Approved" },
  { id: "dnc", label: "DNC" },
  { id: "invalid", label: "Invalid" },
  { id: "all", label: "All" },
];

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function wasContactedToday(lastContactedAt: string | null | undefined) {
  if (!lastContactedAt) return false;
  const t = new Date(lastContactedAt).getTime();
  return Number.isFinite(t) && t >= startOfLocalDay().getTime();
}

function normalizeHistoryCall(raw: Record<string, unknown>): FounderCall {
  const metadata =
    typeof raw.metadata === "string"
      ? (() => {
          try {
            return JSON.parse(raw.metadata) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : ((raw.metadata as Record<string, unknown> | null) ?? {});
  const structured =
    typeof raw.structuredData === "string"
      ? (() => {
          try {
            return JSON.parse(raw.structuredData) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : ((raw.structuredData as Record<string, unknown> | null) ?? {});
  const providerMeta = (raw.providerMetadata as Record<string, unknown> | null) ?? {};
  return {
    id: String(raw.id),
    clinicId: String(raw.clinicId ?? ""),
    status: String(raw.status ?? "ended"),
    startedAt: raw.startedAt ? String(raw.startedAt) : null,
    connectedAt: raw.connectedAt ? String(raw.connectedAt) : null,
    endedAt: raw.endedAt ? String(raw.endedAt) : null,
    durationSec: typeof raw.durationSec === "number" ? raw.durationSec : null,
    externalNumber: (raw.externalNumber as string | null) ?? (metadata.phoneNumber as string | null) ?? null,
    outcome: (raw.outcome as string | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    mode: (providerMeta.mode as string | null) ?? (structured.mode as string | null) ?? null,
    provider: (raw.provider as string | null) ?? null,
    recordingAvailable: Boolean(raw.recordingAvailable ?? raw.recordingUrl),
    transcriptStatus: (raw.transcriptStatus as string | null) ?? null,
  };
}

function matchesFilter(clinic: QueueClinic, filter: MarketQueueFilter): boolean {
  const m = clinic.market;
  const intel = clinic.intelligence;
  const isDup = Boolean(m?.duplicateOfClinicId) || intel?.fitStatus === "duplicate";
  const cohort = m?.cohortStatus ?? clinic.pipelineStage;
  const research = m?.researchStatus;
  const fit = intel?.fitStatus;
  const now = Date.now();
  const excludedFit = ["not_relevant", "duplicate", "invalid"].includes(fit || "");
  const researchedEnough =
    Boolean(intel?.shortSummary) &&
    ["needs_review", "verified", "stale"].includes(intel?.researchStatus || "") &&
    (fit === "strong_fit" || fit === "possible_fit");

  switch (filter) {
    case "ready_to_call":
      return (
        !clinic.doNotCall &&
        !isDup &&
        !excludedFit &&
        researchedEnough &&
        (cohort === "ready_to_call" || clinic.pipelineStage === "ready_to_call") &&
        !["invalid", "closed", "do_not_call"].includes(cohort)
      );
    case "research_needed":
      return (
        !intel ||
        intel.researchStatus === "not_started" ||
        intel.researchStatus === "failed" ||
        intel.researchStatus === "queued" ||
        intel.fitStatus === "research_required" ||
        research === "research_needed" ||
        research === "flagged" ||
        cohort === "research_needed"
      );
    case "never_called":
      return !isDup && !clinic.lastContactedAt && Number(clinic.callAttempts ?? 0) === 0 && !clinic.doNotCall;
    case "follow_up_due":
      return (
        clinic.pipelineStage === "follow_up_required" ||
        cohort === "follow_up_required" ||
        Boolean(clinic.nextActionAt && new Date(clinic.nextActionAt).getTime() <= now)
      );
    case "attempted":
      return cohort === "attempted" || ["attempted", "connected", "decision_maker_reached"].includes(clinic.pipelineStage);
    case "interested":
      return cohort === "interested" || Boolean(clinic.interested);
    case "permission_granted":
      return cohort === "permission_granted";
    case "review_pending":
      return cohort === "profile_review_pending";
    case "approved":
      return cohort === "approved" || cohort === "published" || ["approved", "published"].includes(clinic.directoryStatus ?? "");
    case "dnc":
      return clinic.doNotCall || cohort === "do_not_call";
    case "invalid":
      return cohort === "invalid" || cohort === "closed" || clinic.operatingStatus === "closed";
    case "all":
      return true;
    default:
      return true;
  }
}

export function FounderCallsWorkspace({ initialClinicId = null }: { initialClinicId?: string | null }) {
  const [markets, setMarkets] = useState<MarketSprint[]>([]);
  const [marketSlug, setMarketSlug] = useState<string>(() => {
    if (typeof window === "undefined") return "miami-fl";
    return localStorage.getItem(MARKET_STORAGE_KEY) || "miami-fl";
  });
  const [metrics, setMetrics] = useState<MarketSprintMetrics | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [queue, setQueue] = useState<QueueClinic[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [queueFilter, setQueueFilter] = useState<MarketQueueFilter>("ready_to_call");
  const [queueSort, setQueueSort] = useState<MarketQueueSort>("priority");
  const [selectedClinic, setSelectedClinic] = useState<QueueClinic | null>(null);
  const [clinicDetail, setClinicDetail] = useState<Record<string, unknown> | null>(null);
  const [centerTab, setCenterTab] = useState<CenterTab>("brief");
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [activeCall, setActiveCall] = useState<FounderCall | null>(null);
  const [history, setHistory] = useState<FounderCall[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [notesSaveState, setNotesSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [outcome, setOutcome] = useState("no_answer");
  const [directoryPermission, setDirectoryPermission] = useState<"granted" | "denied" | "pending">("pending");
  const [decisionMakerReached, setDecisionMakerReached] = useState(false);
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [logExternalOpen, setLogExternalOpen] = useState(false);
  const [intelProfile, setIntelProfile] = useState<ClinicIntelligenceProfile | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [researching, setResearching] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);

  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNotesRef = useRef("");

  const quoReady = Boolean(status?.quo?.configured);
  const telnyxReady = Boolean(status?.configured);
  const quoFrom = status?.quo?.fromNumber || "+16283333901";

  const activeMarket = useMemo(
    () => markets.find((m) => m.slug === marketSlug) ?? null,
    [markets, marketSlug],
  );

  const persistSession = useCallback(async (callId: string, patch: Record<string, unknown>) => {
    try {
      await fetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      /* ignore */
    }
  }, []);

  const loadIntelligence = useCallback(async (clinicId: string) => {
    setIntelLoading(true);
    try {
      const res = await fetch(`/api/research/clinic?clinicId=${encodeURIComponent(clinicId)}`);
      const data = await res.json().catch(() => ({}));
      setIntelProfile(data.profile ?? null);
    } catch {
      setIntelProfile(null);
    } finally {
      setIntelLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/telephony/status");
      const data = await res.json();
      setStatus(data.status ?? null);
    } catch {
      setStatus(null);
    }
  }, []);

  const loadMarkets = useCallback(async () => {
    try {
      const res = await fetch("/api/market-sprints");
      const data = await res.json();
      const list: MarketSprint[] = Array.isArray(data.markets) ? data.markets : [];
      setMarkets(list);
      const stored = typeof window !== "undefined" ? localStorage.getItem(MARKET_STORAGE_KEY) : null;
      if (!stored && data.defaultMarket?.slug) {
        setMarketSlug(data.defaultMarket.slug);
        localStorage.setItem(MARKET_STORAGE_KEY, data.defaultMarket.slug);
      }
    } catch {
      setMarkets([]);
    }
  }, []);

  const loadMetrics = useCallback(async (slug: string) => {
    if (!slug || slug === ALL_MARKETS_SLUG) {
      setMetrics(null);
      return;
    }
    try {
      const res = await fetch(`/api/market-sprints/${encodeURIComponent(slug)}`);
      const data = await res.json();
      setMetrics(data.metrics ?? null);
    } catch {
      setMetrics(null);
    }
  }, []);

  const loadQueue = useCallback(async (slug: string) => {
    setQueueLoading(true);
    try {
      const res = await fetch(`/api/call-queue?market=${encodeURIComponent(slug)}&limit=300`);
      const data = await res.json();
      setQueue(Array.isArray(data.queue) ? data.queue : []);
    } catch {
      setQueue([]);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const researchClinic = useCallback(
    async (clinicId: string, force = false) => {
      setResearching(true);
      try {
        const res = await fetch("/api/research/clinic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clinicId, force }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? "Research failed");
          return;
        }
        setIntelProfile(data.profile ?? null);
        toast.success("Clinic intelligence updated");
        void loadQueue(marketSlug);
      } catch {
        toast.error("Network error while researching clinic");
      } finally {
        setResearching(false);
      }
    },
    [loadQueue, marketSlug],
  );

  const runBulkResearch = useCallback(async () => {
    if (marketSlug === ALL_MARKETS_SLUG) {
      toast.message("Select Miami (or another market) before bulk research.");
      return;
    }
    setBulkRunning(true);
    try {
      const res = await fetch("/api/research/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketSlug, limit: 6 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Bulk research failed");
        return;
      }
      toast.success(
        `Researched ${data.succeeded ?? 0}/${data.processed ?? 0} · ${data.remaining ?? 0} remaining`,
      );
      void loadQueue(marketSlug);
      if (selectedClinic) void loadIntelligence(selectedClinic.id);
    } catch {
      toast.error("Bulk research network error");
    } finally {
      setBulkRunning(false);
    }
  }, [marketSlug, loadQueue, selectedClinic, loadIntelligence]);

  const loadHistory = useCallback(async (clinicId?: string) => {
    try {
      const url = clinicId
        ? `/api/calls?clinicId=${encodeURIComponent(clinicId)}&limit=40`
        : "/api/calls?limit=40";
      const res = await fetch(url);
      const data = await res.json();
      const rows = Array.isArray(data.calls) ? data.calls : [];
      setHistory(rows.map((row: Record<string, unknown>) => normalizeHistoryCall(row)));
    } catch {
      setHistory([]);
    }
  }, []);

  const loadClinicDetail = useCallback(async (clinicId: string) => {
    try {
      const res = await fetch(`/api/clinics/${clinicId}`);
      if (!res.ok) {
        setClinicDetail(null);
        return;
      }
      const data = await res.json();
      setClinicDetail(data.clinic ?? data ?? null);
    } catch {
      setClinicDetail(null);
    }
  }, []);

  const selectClinic = useCallback(
    (clinic: QueueClinic) => {
      setSelectedClinic(clinic);
      setCenterTab("brief");
      setMobileQueueOpen(false);
      void loadClinicDetail(clinic.id);
      void loadHistory(clinic.id);
      void loadIntelligence(clinic.id);
    },
    [loadClinicDetail, loadHistory, loadIntelligence],
  );

  useEffect(() => {
    void loadStatus();
    void loadMarkets();
  }, [loadStatus, loadMarkets]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(MARKET_STORAGE_KEY, marketSlug);
    }
    void loadQueue(marketSlug);
    void loadMetrics(marketSlug);
  }, [marketSlug, loadQueue, loadMetrics]);

  useEffect(() => {
    if (!initialClinicId || queue.length === 0) return;
    const match = queue.find((c) => c.id === initialClinicId);
    if (match) selectClinic(match);
  }, [initialClinicId, queue, selectClinic]);

  useEffect(() => {
    if (!selectedClinic && queue.length > 0) {
      const first = queue.find((c) => matchesFilter(c, "ready_to_call")) ?? queue[0];
      if (first) selectClinic(first);
    }
  }, [queue, selectedClinic, selectClinic]);

  // Autosave notes during active Quo session
  useEffect(() => {
    if (!activeCall?.id) return;
    if (notes === lastSavedNotesRef.current) return;
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      setNotesSaveState("saving");
      void persistSession(activeCall.id, { notes })
        .then(() => {
          lastSavedNotesRef.current = notes;
          setNotesSaveState("saved");
        })
        .catch(() => setNotesSaveState("error"));
    }, 800);
    return () => {
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    };
  }, [notes, activeCall?.id, persistSession]);

  const filteredQueue = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = queue.filter((c) => matchesFilter(c, queueFilter));
    if (q) {
      rows = rows.filter((c) =>
        [c.name, c.city, c.state, c.primaryPhone, c.website].filter(Boolean).join(" ").toLowerCase().includes(q),
      );
    }
    rows = [...rows].sort((a, b) => {
      switch (queueSort) {
        case "last_attempt":
          return (new Date(b.lastContactedAt || 0).getTime() || 0) - (new Date(a.lastContactedAt || 0).getTime() || 0);
        case "follow_up":
          return (new Date(a.nextActionAt || "9999").getTime() || 0) - (new Date(b.nextActionAt || "9999").getTime() || 0);
        case "research":
          return String(a.market?.researchStatus || "").localeCompare(String(b.market?.researchStatus || ""));
        case "decision_maker":
          return Number(Boolean(b.decisionMaker)) - Number(Boolean(a.decisionMaker));
        case "category":
          return String(a.pipelineStage).localeCompare(String(b.pipelineStage));
        case "local_time":
          return String(a.timezone).localeCompare(String(b.timezone));
        case "priority":
        default:
          return Number(b.readinessScore ?? b.market?.priority ?? 0) - Number(a.readinessScore ?? a.market?.priority ?? 0);
      }
    });
    return rows;
  }, [queue, queueFilter, queueSort, search]);

  const openQuoDialer = useCallback((telHref: string, deepLink: string) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = deepLink;
      document.body.appendChild(iframe);
      window.setTimeout(() => iframe.remove(), 1500);
    } catch {
      /* ignore */
    }
    const a = document.createElement("a");
    a.href = telHref;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const startQuoCall = useCallback(
    async (clinic: QueueClinic) => {
      if (initiating) return;
      const destination = (clinic.primaryPhone || "").trim();
      if (!destination) {
        toast.error("This clinic has no phone number.");
        return;
      }
      if (!quoReady) {
        toast.error(status?.quo?.configErrors?.join(", ") || "Quo is not configured.");
        return;
      }
      setInitiating(true);
      selectClinic(clinic);
      toast.info("Opening Quo dialer…");
      try {
        const res = await fetch("/api/integrations/quo/dial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clinicId: clinic.id,
            phoneNumber: destination,
            idempotencyKey: `quo-${clinic.id}-${Date.now()}`,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.callSessionId || !data.dial?.telHref) {
          toast.error(data.error ?? "Could not start Quo dial.");
          return;
        }
        const now = new Date().toISOString();
        setActiveCall({
          id: String(data.callSessionId),
          clinicId: clinic.id,
          status: "connected",
          startedAt: now,
          connectedAt: now,
          endedAt: null,
          durationSec: null,
          externalNumber: data.externalNumber ?? destination,
          outcome: null,
          notes: null,
          mode: "quo_click_to_call",
          provider: "quo",
        });
        openQuoDialer(String(data.dial.telHref), String(data.dial.deepLink));
        toast.success(`Quo opened — call from ${formatPhone(String(data.fromNumber || quoFrom))}. Save outcome when done.`);
        setQueue((prev) =>
          prev.map((c) =>
            c.id === clinic.id
              ? {
                  ...c,
                  lastContactedAt: now,
                  callAttempts: Math.max(1, Number(c.callAttempts ?? 0) + (c.lastContactedAt ? 0 : 1)),
                  pipelineStage: c.pipelineStage === "ready_to_call" ? "attempted" : c.pipelineStage,
                }
              : c,
          ),
        );
        setCenterTab("script");
        void loadQueue(marketSlug);
        void loadMetrics(marketSlug);
      } catch {
        toast.error("Network error while starting Quo dial.");
      } finally {
        setInitiating(false);
      }
    },
    [initiating, quoReady, status, selectClinic, openQuoDialer, quoFrom, loadQueue, loadMetrics, marketSlug],
  );

  const syncQuoHistory = useCallback(
    async (clinic: QueueClinic) => {
      try {
        const res = await fetch("/api/integrations/quo/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clinicId: clinic.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? "Quo sync failed.");
          return;
        }
        toast.success(`Quo sync: ${data.imported ?? 0} imported, ${data.enriched ?? 0} enriched.`);
        void loadHistory(clinic.id);
      } catch {
        toast.error("Network error while syncing Quo.");
      }
    },
    [loadHistory],
  );

  const saveOutcome = useCallback(async () => {
    if (!activeCall || !selectedClinic || saving) return;
    setSaving(true);
    try {
      if (contactFirstName.trim() && contactLastName.trim()) {
        await fetch(`/api/clinics/${selectedClinic.id}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: contactFirstName.trim(),
            lastName: contactLastName.trim(),
            email: contactEmail.trim() || undefined,
            isDecisionMaker: decisionMakerReached,
            isPrimary: true,
            notes: `Captured during founder-led call ${activeCall.id}`,
          }),
        }).catch(() => undefined);
      }

      const res = await fetch(`/api/clinics/${selectedClinic.id}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callSessionId: activeCall.id,
          provider: activeCall.provider || "quo",
          outcome,
          answered: ["permission_granted", "connected", "interested", "meeting_booked", "not_interested", "gatekeeper"].includes(outcome),
          decisionMakerReached,
          notes,
          followUpRequired: followUpRequired || outcome === "call_back_requested",
          nextAction: nextAction || undefined,
          nextActionAt: nextActionAt || undefined,
          durationSec: activeCall.durationSec ?? 0,
          callEnvironment: "live",
          doNotCall: outcome === "do_not_call",
          directoryPermissionStatus: directoryPermission,
          structuredData: {
            provider: "quo",
            mode: "quo_click_to_call",
            directoryPermissionStatus: directoryPermission,
            checklist,
            marketSlug,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save outcome.");
        return;
      }
      await persistSession(activeCall.id, { status: "saved", notes, endedAt: new Date().toISOString() });
      toast.success(outcome === "do_not_call" ? "Marked Do Not Call." : "Call outcome saved.");
      setActiveCall(null);
      void loadQueue(marketSlug);
      void loadMetrics(marketSlug);
      void loadHistory(selectedClinic.id);
    } catch {
      toast.error("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }, [
    activeCall,
    selectedClinic,
    saving,
    contactFirstName,
    contactLastName,
    contactEmail,
    decisionMakerReached,
    outcome,
    notes,
    followUpRequired,
    nextAction,
    nextActionAt,
    directoryPermission,
    checklist,
    marketSlug,
    persistSession,
    loadQueue,
    loadMetrics,
    loadHistory,
  ]);

  const markDnc = useCallback(
    async (clinic: QueueClinic) => {
      const res = await fetch(`/api/clinics/${clinic.id}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStage: "do_not_call", reason: "Marked from Market Sprint workspace" }),
      });
      if (res.ok) {
        toast.success("Marked Do Not Call.");
        void loadQueue(marketSlug);
      } else toast.error("Could not update stage.");
    },
    [loadQueue, marketSlug],
  );

  const nextUncalled = useCallback(() => {
    const next = filteredQueue.find(
      (c) => matchesFilter(c, "ready_to_call") && !wasContactedToday(c.lastContactedAt) && c.id !== selectedClinic?.id,
    );
    if (next) selectClinic(next);
    else toast.message("No more uncalled Ready-to-Call clinics in this filter.");
  }, [filteredQueue, selectedClinic?.id, selectClinic]);

  const calledTodayCount = queue.filter((c) => wasContactedToday(c.lastContactedAt)).length;

  const queuePanel = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0 pb-2">
        <span className="font-bold text-sm flex items-center gap-1.5">
          <Building2 className="size-4" />
          {activeMarket ? `${activeMarket.name} Queue` : "Clinic Queue"}
        </span>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void loadQueue(marketSlug)}>
          <RefreshCw className="size-3.5" />
        </Button>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-2 shrink-0">
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={queueFilter === f.id ? "default" : "outline"}
            className={`h-7 text-[10px] whitespace-nowrap shrink-0 ${
              queueFilter === f.id ? "bg-emerald-700 hover:bg-emerald-800" : ""
            }`}
            onClick={() => setQueueFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <div className="flex gap-2 pb-2 shrink-0">
        <div className="relative flex-1">
          <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select value={queueSort} onValueChange={(v) => setQueueSort(v as MarketQueueSort)}>
          <SelectTrigger className="h-8 w-[110px] text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="last_attempt">Last attempt</SelectItem>
            <SelectItem value="follow_up">Follow-up</SelectItem>
            <SelectItem value="research">Research</SelectItem>
            <SelectItem value="decision_maker">Decision-maker</SelectItem>
            <SelectItem value="local_time">Local time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-1">
        {queueLoading && <p className="text-xs text-muted-foreground p-2">Loading queue…</p>}
        {!queueLoading && filteredQueue.length === 0 && (
          <p className="text-xs text-muted-foreground p-2">No clinics match this filter.</p>
        )}
        {filteredQueue.map((clinic) => {
          const selected = selectedClinic?.id === clinic.id;
          const calledToday = wasContactedToday(clinic.lastContactedAt);
          const intel = clinic.intelligence;
          const needsResearch =
            !intel ||
            intel.researchStatus === "not_started" ||
            intel.researchStatus === "failed" ||
            intel.fitStatus === "research_required";
          return (
            <button
              key={clinic.id}
              type="button"
              onClick={() => selectClinic(clinic)}
              className={`w-full text-left border rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                selected
                  ? "border-emerald-400 bg-emerald-50"
                  : calledToday
                    ? "border-amber-200 bg-amber-50/40 hover:bg-amber-50"
                    : "hover:bg-accent/40"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold truncate">{clinic.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {clinic.callAttempts}×
                </span>
              </div>
              <div className="text-muted-foreground mt-0.5 truncate">
                {(intel?.primaryCategory || "Uncategorized") +
                  " · " +
                  ([clinic.city, clinic.state].filter(Boolean).join(", ") || "—")}
              </div>
              {intel?.shortSummary ? (
                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{intel.shortSummary}</p>
              ) : (
                <p className="text-[10px] text-amber-800 mt-0.5">Research required — identity/services unknown</p>
              )}
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <Badge variant="outline" className="text-[9px] h-4 px-1 capitalize">
                  {(intel?.fitStatus || "research required").replace(/_/g, " ")}
                </Badge>
                <Badge variant="outline" className="text-[9px] h-4 px-1 capitalize">
                  {(intel?.priority || "medium") + " priority"}
                </Badge>
                <Badge variant="outline" className="text-[9px] h-4 px-1">
                  Research {intel?.researchCompleteness ?? 0}%
                </Badge>
                <span className="text-[10px] text-muted-foreground">{localTime(clinic.timezone)}</span>
                {clinic.decisionMaker ? <span className="size-1.5 rounded-full bg-emerald-500" title="DM on file" /> : (
                  <span className="text-[9px] text-muted-foreground">DM missing</span>
                )}
                {clinic.nextActionAt ? <span className="size-1.5 rounded-full bg-sky-500" title="Follow-up" /> : null}
              </div>
              {needsResearch && selected && (
                <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] w-full"
                    disabled={researching || !clinic.website}
                    onClick={() => void researchClinic(clinic.id)}
                  >
                    Research Clinic
                  </Button>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <Button variant="outline" size="sm" className="mt-2 h-8 text-xs shrink-0" onClick={nextUncalled}>
        Next uncalled clinic
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-7.5rem)] min-h-[560px]">
      {/* Command bar */}
      <Card className="p-2.5 shrink-0 border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 to-background">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className="bg-emerald-700 text-white font-bold">Market Sprint</Badge>
          <Select
            value={marketSlug}
            onValueChange={(v) => {
              setMarketSlug(v);
              setSelectedClinic(null);
            }}
          >
            <SelectTrigger className="h-8 w-[200px] text-xs font-semibold">
              <SelectValue placeholder="Active market" />
            </SelectTrigger>
            <SelectContent>
              {markets.map((m) => (
                <SelectItem key={m.slug} value={m.slug}>
                  {m.name}, {m.stateAbbreviation}
                </SelectItem>
              ))}
              <SelectItem value={ALL_MARKETS_SLUG}>All Markets</SelectItem>
            </SelectContent>
          </Select>
          {activeMarket && (
            <Badge variant="outline" className="capitalize">
              {activeMarket.status.replace(/_/g, " ")}
            </Badge>
          )}
          {metrics && (
            <span className="text-muted-foreground">
              <strong className="text-foreground">{metrics.contacted}</strong> of {metrics.qualified} contacted ·{" "}
              <strong className="text-foreground">{metrics.interested}</strong> interested ·{" "}
              <strong className="text-foreground">{metrics.approved + metrics.published}</strong> approved ·{" "}
              <strong className="text-foreground">{metrics.readyToCall}</strong> ready ·{" "}
              {metrics.followUpsDue} follow-ups · {metrics.coveragePct}% coverage ·{" "}
              <span className="capitalize">{metrics.readinessStage.replace(/_/g, " ")}</span>
            </span>
          )}
          {!metrics && marketSlug === ALL_MARKETS_SLUG && (
            <span className="text-amber-800">National view — select a market for focused outreach.</span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {quoReady ? (
              <Badge variant="outline" className="font-mono text-[10px] border-emerald-300 text-emerald-900">
                Quo {formatPhone(quoFrom)}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-rose-700 border-rose-300">
                Quo offline
              </Badge>
            )}
            <span className="text-muted-foreground">{calledTodayCount} called today</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={bulkRunning || marketSlug === ALL_MARKETS_SLUG}
              onClick={() => void runBulkResearch()}
            >
              <RefreshCw className={`size-3 mr-1 ${bulkRunning ? "animate-spin" : ""}`} />
              {bulkRunning ? "Researching…" : "Research Miami Queue"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void loadStatus()}>
              <RefreshCw className="size-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 lg:hidden"
              onClick={() => setMobileQueueOpen((v) => !v)}
            >
              <List className="size-3.5 mr-1" /> Queue
            </Button>
          </span>
        </div>
      </Card>

      <LogCallDialog
        open={logExternalOpen}
        onOpenChange={setLogExternalOpen}
        presetClinicId={selectedClinic?.id}
        presetPhone={selectedClinic?.primaryPhone}
        onLogged={(clinicId) => {
          void loadHistory(clinicId);
          void loadQueue(marketSlug);
        }}
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px] gap-3">
        {/* Left queue — desktop */}
        <Card className="hidden lg:flex flex-col p-2.5 min-h-0 overflow-hidden">{queuePanel}</Card>

        {/* Mobile queue drawer */}
        {mobileQueueOpen && (
          <Card className="lg:hidden p-2.5 max-h-[40vh] overflow-hidden">{queuePanel}</Card>
        )}

        {/* Center */}
        <Card className="p-3 min-h-0 overflow-y-auto space-y-3">
          {!selectedClinic ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Select a clinic from the queue.</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold text-base truncate">{selectedClinic.name}</h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {[selectedClinic.city, selectedClinic.state].filter(Boolean).join(", ") || "—"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      Local {localTime(selectedClinic.timezone)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <PhoneCall className="size-3" />
                      {formatPhone(selectedClinic.primaryPhone)}
                    </span>
                    {selectedClinic.website && (
                      <a
                        href={
                          selectedClinic.website.startsWith("http")
                            ? selectedClinic.website
                            : `https://${selectedClinic.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                      >
                        <Globe className="size-3" /> Website
                      </a>
                    )}
                    {selectedClinic.decisionMaker && (
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3" />
                        {[selectedClinic.decisionMaker.firstName, selectedClinic.decisionMaker.lastName]
                          .filter(Boolean)
                          .join(" ")}
                        {selectedClinic.decisionMaker.title ? ` · ${selectedClinic.decisionMaker.title}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(intelProfile?.primaryCategory || selectedClinic.intelligence?.primaryCategory) && (
                      <Badge variant="outline" className="text-[10px]">
                        {intelProfile?.primaryCategory || selectedClinic.intelligence?.primaryCategory}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {(intelProfile?.fitStatus || selectedClinic.intelligence?.fitStatus || "research required").replace(
                        /_/g,
                        " ",
                      )}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedClinic.callAttempts} attempt{selectedClinic.callAttempts === 1 ? "" : "s"}
                    </Badge>
                    {wasContactedToday(selectedClinic.lastContactedAt) && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-900 border-amber-300">Called today</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 w-full sm:w-auto">
                  <Button
                    className="bg-emerald-700 hover:bg-emerald-800 text-white w-full sm:w-auto"
                    disabled={initiating || !selectedClinic.primaryPhone || !quoReady}
                    onClick={() => void startQuoCall(selectedClinic)}
                  >
                    <PhoneCall className="size-4 mr-1.5" />
                    {wasContactedToday(selectedClinic.lastContactedAt) ? "Call again with Quo" : "Call with Quo"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center sm:text-right">
                    From {formatPhone(quoFrom)}
                  </p>
                </div>
              </div>

              {activeCall && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <PhoneCall className="size-3.5" /> Quo call in progress
                  </p>
                  <p>
                    Finish the conversation in Quo for <strong>{formatPhone(activeCall.externalNumber)}</strong>, then
                    save the outcome in the right panel.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => {
                      setActiveCall((prev) =>
                        prev ? { ...prev, status: "ended", endedAt: new Date().toISOString() } : prev,
                      );
                      setCenterTab("brief");
                    }}
                  >
                    Mark call ended — ready to save
                  </Button>
                </div>
              )}

              <div className="flex gap-1 border-b overflow-x-auto">
                {(
                  [
                    ["brief", "Call Brief"],
                    ["intel", "Intelligence"],
                    ["script", "Script"],
                    ["history", "History"],
                    ["activity", "Activity"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px whitespace-nowrap ${
                      centerTab === id
                        ? "border-emerald-600 text-emerald-900"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setCenterTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {centerTab === "brief" && (
                <div className="space-y-3">
                  <ClinicIntelligencePanel
                    clinicId={selectedClinic.id}
                    clinicName={selectedClinic.name}
                    website={selectedClinic.website}
                    profile={intelProfile}
                    loading={intelLoading}
                    researching={researching}
                    onResearch={(force) => void researchClinic(selectedClinic.id, force)}
                    onRefresh={() => void loadIntelligence(selectedClinic.id)}
                    onPatched={(p) => {
                      setIntelProfile(p);
                      void loadQueue(marketSlug);
                    }}
                  />
                  <div className="rounded-lg border bg-card p-3 space-y-1.5 text-xs">
                    <p className="font-bold uppercase text-[10px] text-muted-foreground tracking-wide flex items-center gap-1">
                      <Target className="size-3" /> Call objective
                    </p>
                    <p>{FOUNDER_CALL_OBJECTIVE}</p>
                    <p className="text-muted-foreground">
                      {selectedClinic.lastContactedAt
                        ? `Prior outreach: ${relativeTime(new Date(selectedClinic.lastContactedAt))} · ${selectedClinic.callAttempts} attempts`
                        : "Never contacted — first outreach call."}
                    </p>
                  </div>
                  <ScriptStepper
                    clinicName={selectedClinic.name}
                    primaryCity={selectedClinic.city}
                    personalizedOpening={
                      intelProfile?.personalizedOpening || intelProfile?.talkTrack?.frontDesk || null
                    }
                    decisionMakerOpening={intelProfile?.talkTrack?.decisionMaker || null}
                  />
                </div>
              )}

              {centerTab === "intel" && (
                <ClinicIntelligencePanel
                  clinicId={selectedClinic.id}
                  clinicName={selectedClinic.name}
                  website={selectedClinic.website}
                  profile={intelProfile}
                  loading={intelLoading}
                  researching={researching}
                  onResearch={(force) => void researchClinic(selectedClinic.id, force)}
                  onRefresh={() => void loadIntelligence(selectedClinic.id)}
                  onPatched={(p) => {
                    setIntelProfile(p);
                    void loadQueue(marketSlug);
                  }}
                />
              )}

              {centerTab === "script" && (
                <ScriptStepper
                  clinicName={selectedClinic.name}
                  primaryCity={selectedClinic.city}
                  personalizedOpening={
                    intelProfile?.personalizedOpening || intelProfile?.talkTrack?.frontDesk || null
                  }
                  decisionMakerOpening={intelProfile?.talkTrack?.decisionMaker || null}
                />
              )}

              {centerTab === "history" && (
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                  {history.length === 0 && <p className="text-xs text-muted-foreground">No prior calls logged.</p>}
                  {history.map((h) => (
                    <div key={h.id} className="border rounded-md px-2.5 py-2 text-[11px] space-y-0.5">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">
                          {h.startedAt ? new Date(h.startedAt).toLocaleString() : "—"}
                        </span>
                        <Badge variant="outline" className="text-[9px] capitalize">
                          {h.provider || "unknown"}
                        </Badge>
                      </div>
                      <p>
                        Outcome: {(h.outcome || "—").replace(/_/g, " ")}
                        {h.durationSec != null ? ` · ${h.durationSec}s` : ""}
                      </p>
                      {h.notes && <p className="text-muted-foreground line-clamp-2">{h.notes}</p>}
                      <p className="text-muted-foreground">
                        {h.recordingAvailable ? "Recording available" : "No recording"}
                        {h.transcriptStatus ? ` · transcript ${h.transcriptStatus}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {centerTab === "activity" && (
                <div className="text-xs space-y-2">
                  <p>
                    <span className="text-muted-foreground">Next action:</span> {selectedClinic.nextAction || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Due:</span>{" "}
                    {selectedClinic.nextActionAt
                      ? new Date(selectedClinic.nextActionAt).toLocaleString()
                      : "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Follow-up task:</span>{" "}
                    {selectedClinic.followUp?.dueDate
                      ? new Date(selectedClinic.followUp.dueDate).toLocaleDateString()
                      : "None"}
                  </p>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Right panel */}
        <Card className="p-3 min-h-0 overflow-y-auto space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Live notes</p>
              <span className="text-[10px] text-muted-foreground">
                {notesSaveState === "saving"
                  ? "Saving…"
                  : notesSaveState === "saved"
                    ? "Autosaved"
                    : notesSaveState === "error"
                      ? "Save failed"
                      : activeCall
                        ? "Autosave on"
                        : "Ready"}
              </span>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Permission, contact, services, next step…"
              className="text-xs min-h-28"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase text-muted-foreground">Details to verify</p>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {FOUNDER_OBJECTIVE_CHECKLIST.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={Boolean(checklist[item.id])}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <p className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="size-3.5" /> Call outcome
            </p>
            <Select
              value={outcome}
              onValueChange={(v) => {
                setOutcome(v);
                if (v === "permission_granted") setDirectoryPermission("granted");
                if (v === "permission_denied") setDirectoryPermission("denied");
                if (v === "do_not_call") setFollowUpRequired(false);
                if (["busy", "clinic_closed", "call_back_requested", "information_requested"].includes(v)) {
                  setFollowUpRequired(true);
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CALL_OUTCOMES.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={directoryPermission} onValueChange={(v) => setDirectoryPermission(v as never)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Directory permission" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Permission pending</SelectItem>
                <SelectItem value="granted">Permission granted</SelectItem>
                <SelectItem value="denied">Permission denied</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 text-[11px]">
              <input
                id="dm"
                type="checkbox"
                checked={decisionMakerReached}
                onChange={(e) => setDecisionMakerReached(e.target.checked)}
              />
              <label htmlFor="dm">Decision-maker reached</label>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <input
                id="fu"
                type="checkbox"
                checked={followUpRequired}
                onChange={(e) => setFollowUpRequired(e.target.checked)}
              />
              <label htmlFor="fu">Follow-up required</label>
            </div>

            <Input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="Next action"
              className="h-8 text-xs"
            />
            <Input
              type="datetime-local"
              value={nextActionAt}
              onChange={(e) => setNextActionAt(e.target.value)}
              className="h-8 text-xs"
            />

            <div className="grid grid-cols-2 gap-1.5">
              <Input
                value={contactFirstName}
                onChange={(e) => setContactFirstName(e.target.value)}
                placeholder="Reviewer first"
                className="h-8 text-xs"
              />
              <Input
                value={contactLastName}
                onChange={(e) => setContactLastName(e.target.value)}
                placeholder="Last"
                className="h-8 text-xs"
              />
            </div>
            <Input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Reviewer email"
              className="h-8 text-xs"
            />

            <Button
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white"
              disabled={!activeCall || saving}
              onClick={() => void saveOutcome()}
            >
              {saving ? "Saving…" : activeCall ? "Save outcome" : "Start a Quo call to save"}
            </Button>
          </div>

          <div className="border-t pt-2 space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs justify-between"
              onClick={() => setMoreOpen((v) => !v)}
            >
              More calling options
              {moreOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </Button>
            {moreOpen && (
              <div className="space-y-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => setLogExternalOpen(true)}
                >
                  <PhoneCall className="size-3.5 mr-1" /> Log external call
                </Button>
                {selectedClinic && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={() => void syncQuoHistory(selectedClinic)}
                  >
                    <History className="size-3.5 mr-1" /> Sync Quo history
                  </Button>
                )}
                {selectedClinic?.website && (
                  <Button variant="outline" size="sm" className="w-full h-8 text-xs" asChild>
                    <a
                      href={
                        selectedClinic.website.startsWith("http")
                          ? selectedClinic.website
                          : `https://${selectedClinic.website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Globe className="size-3.5 mr-1" /> Open clinic website
                    </a>
                  </Button>
                )}
                {selectedClinic && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs text-rose-700"
                    onClick={() => void markDnc(selectedClinic)}
                  >
                    <Ban className="size-3.5 mr-1" /> Mark DNC
                  </Button>
                )}
                {telnyxReady && (
                  <p className="text-[10px] text-muted-foreground px-1 flex items-start gap-1">
                    <Mic className="size-3 mt-0.5 shrink-0" />
                    Browser softphone (Telnyx) remains available as backup only — Quo is the primary founder workflow.
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
