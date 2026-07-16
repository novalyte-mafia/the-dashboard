"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  StatusBadge,
  PriorityBadge,
  MetricCard,
} from "@/components/admin/shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  PhoneCall,
  PhoneOutgoing,
  PhoneOff,
  Phone,
  Mic,
  MicOff,
  Pause,
  Play,
  Grid3x3,
  Clock,
  Building2,
  MapPin,
  Globe,
  Mail,
  User,
  Calendar,
  Send,
  CheckCircle2,
  Ban,
  AlertTriangle,
  ListChecks,
  BookOpen,
  PhoneIncoming,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  History,
  TrendingUp,
  Award,
  Activity,
  CheckSquare,
  ShieldCheck,
  UserCheck,
  ChevronRight,
  Flame,
  Info,
} from "lucide-react";
import { clinicService, callService } from "@/services";
import { CALL_OUTCOMES, OUTCOME_MAP } from "@/lib/constants";
import { formatPhone, localTime, isWithinCallingHours, relativeTime, fullName } from "@/lib/format";
import { toast } from "sonner";
import type { Clinic, CallSession, CallState, CallOutcome } from "@/types";
import { TelephonySimulator, SIMULATOR_DIALOGUE } from "@/lib/telephony-simulator";

// Objections Library for quick human fallback reference
const OBJECTION_LIBRARY = [
  { id: "obj_1", text: "Send me info via email", response: "Happy to. I'll send a 1-page overview and our directory link. Can I book a 10-min follow-up Thursday?" },
  { id: "obj_2", text: "We already have a marketing agency", response: "Got it — most clinics we work with keep their agency for general marketing. We're a focused men's-health demand engine, not a replacement." },
  { id: "obj_3", text: "Cost is a concern right now", response: "Understandable. We offer a pilot at break-even — if we deliver qualified patient leads in 30 days, we scale. If not, you walk away free." },
  { id: "obj_4", text: "Need to think about it", response: "Of course. What specifically would you want to think through? I can address it now or send supporting data." },
  { id: "obj_5", text: "Send me patient demand data", response: "Perfect — I'll send a ZIP-level demand report for your market. Best email?" },
];

const QUALIFICATION_CHECKLIST = [
  { id: "q1", label: "Permission to list clinic in directory" },
  { id: "q2", label: "Listing contact name and role confirmed" },
  { id: "q3", label: "Public clinic name and phone verified" },
  { id: "q4", label: "Address & locations verified" },
  { id: "q5", label: "Services & telehealth availability confirmed" },
  { id: "q6", label: "Booking URL or phone booking confirmed" },
  { id: "q7", label: "Accepting new patients status confirmed" },
  { id: "q12", label: "Follow-up owner and date agreed" },
];

export function CallsView({ clinicId: initialClinicId }: { clinicId?: string | null }) {
  const { openClinic, refreshKey, refresh } = useNav();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [callHistory, setCallHistory] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeClinicId, setActiveClinicId] = useState<string | null>(initialClinicId ?? null);
  const [sidebarTab, setSidebarTab] = useState<"queue" | "history">("queue");
  const [mobileTab, setMobileTab] = useState<"dialer" | "copilot" | "notes">("dialer");
  const [searchQuery, setSearchQuery] = useState("");

  // Dev vs. Live Mode
  const [isLiveMode, setIsLiveMode] = useState(false);

  // Call session states
  const [callState, setCallState] = useState<CallState>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [dialPadOpen, setDialPadOpen] = useState(false);
  const [keypadInput, setKeypadInput] = useState("");
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [providerCallId, setProviderCallId] = useState<string | null>(null);

  // Workspace details
  const [research, setResearch] = useState<string | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [expandedObjection, setExpandedObjection] = useState<string | null>(null);

  // Live Copilot & Transcript
  const [transcript, setTranscript] = useState<{ speaker: "you" | "clinic" | "copilot"; text: string; timestamp: string }[]>([]);
  const [activeStage, setActiveStage] = useState<"intro" | "discovery" | "objections" | "agreement" | "closing">("intro");
  const [copilotSuggestion, setCopilotSuggestion] = useState<string | null>("Place a call to start receiving live coaching tips.");
  const [copilotQuestion, setCopilotQuestion] = useState<string | null>(null);
  const [objectionGuidance, setObjectionGuidance] = useState<string | null>(null);
  const [clinicFacts, setClinicFacts] = useState<string[]>([]);
  const [copilotWarning, setCopilotWarning] = useState<string | null>(null);
  const [copilotNextAction, setCopilotNextAction] = useState<string | null>(null);

  // Notes, Checklist & Outcomes panel
  const [notes, setNotes] = useState("");
  const [interestLevel, setInterestLevel] = useState<"unknown" | "cold" | "warm" | "hot">("unknown");
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [nextAction, setNextAction] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [qualification, setQualification] = useState<Record<string, boolean>>({});

  // Post-Call AI Summary
  const [postCallSummary, setPostCallSummary] = useState<{
    whatHappened: string;
    objections: string;
    commitments: string;
    sentiment: string;
    nextSteps: string;
    followUpMessage: string;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulatorRef = useRef<TelephonySimulator | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const callDurationRef = useRef(0);
  const startingCallRef = useRef(false);

  useEffect(() => {
    callDurationRef.current = callDuration;
  }, [callDuration]);

  // Scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Sync initial clinic ID selection
  useEffect(() => {
    if (initialClinicId) {
      setActiveClinicId(initialClinicId);
      setSidebarTab("queue");
    }
  }, [initialClinicId]);

  // Load Clinics and Call History
  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      clinicService.list(),
      callService.listAll(),
    ])
      .then(([clinicsPayload, historyPayload]) => {
        // Queue consists of clinics in outreach-related stages
        const filteredQueue = clinicsPayload.clinics.filter((c) =>
          ["ready_to_call", "attempted", "connected", "follow_up_required"].includes(c.pipelineStage) &&
          !c.doNotCall &&
          !c.archived
        );
        setClinics(filteredQueue);
        setCallHistory(historyPayload.calls || []);

        if (filteredQueue.length > 0 && !activeClinicId) {
          setActiveClinicId(filteredQueue[0].id);
        }
      })
      .catch((err) => {
        toast.error("Failed to load queue data.");
      })
      .finally(() => setLoading(false));
  }, [activeClinicId]);

  useEffect(() => {
    loadData();
  }, [refreshKey, loadData]);

  // Call duration counter
  useEffect(() => {
    if (callState === "connected" || callState === "on_hold") {
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Production Vapi Status Polling
  useEffect(() => {
    if (!isLiveMode || !providerCallId || callState === "ended" || callState === "idle") return;
    const poll = async () => {
      const response = await fetch(`/api/vapi/call/${providerCallId}`);
      if (!response.ok) return;
      const { call } = await response.json();
      if (call.status === "in-progress" || call.status === "forwarding") {
        setCallState("connected");
        void persistCallSession({ status: "connected" });
      }
      if (call.status === "ended") {
        setCallState("ended");
        void persistCallSession({
          status: "ended",
          endedAt: new Date().toISOString(),
          durationSec: callDurationRef.current,
        });
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => window.clearInterval(interval);
  }, [providerCallId, callState, callSessionId, isLiveMode]);

  // Development/Simulator Hook
  useEffect(() => {
    if (isLiveMode) return;
    if (callState === "dialing" && !simulatorRef.current) {
      // Initialize simulator
      const sim = new TelephonySimulator((event) => {
        switch (event.type) {
          case "status":
            setCallState(event.payload);
            break;
          case "duration":
            setCallDuration(event.payload);
            break;
          case "stage":
            setActiveStage(event.payload);
            break;
          case "transcript":
            setTranscript((prev) => [...prev, event.payload]);
            break;
          case "checklist":
            setQualification((prev) => {
              const updated = { ...prev };
              event.payload.forEach((id: string) => {
                updated[id] = true;
              });
              return updated;
            });
            break;
          case "copilot":
            setCopilotSuggestion(event.payload.suggestion);
            setCopilotQuestion(event.payload.question);
            setObjectionGuidance(event.payload.objectionGuidance ?? null);
            setClinicFacts(event.payload.facts ?? []);
            setCopilotWarning(event.payload.warning ?? null);
            setCopilotNextAction(event.payload.nextAction ?? null);
            break;
        }
      });
      simulatorRef.current = sim;
      sim.start();
    }

    if (callState === "idle" || callState === "ended") {
      if (simulatorRef.current) {
        simulatorRef.current.stop();
        simulatorRef.current = null;
      }
    }
  }, [callState, isLiveMode]);

  // Generate Post-Call AI Summary
  useEffect(() => {
    if (callState === "ended") {
      if (!isLiveMode) {
        // Prebuilt mock summary for simulator
        setPostCallSummary({
          whatHappened: "Devon contacted Summit Vitality Clinic and spoke with Priya, the Practice Manager. Verified Dr. Marcus Cole as the Medical Director and verified their listing information.",
          objections: "Initial objection raised: 'We didn't sign up for this directory'. Clarified that the directory is free, which satisfied the objection.",
          commitments: "Priya granted explicit permission to publish the clinic as verified in the Novalyte directory.",
          sentiment: "Positive and helpful. Practice is open to patient matching.",
          nextSteps: "Send verified directory profile link to priya@summitvitality.com and follow up next month.",
          followUpMessage: "Hi Priya, thanks for taking the time to verify Summit Vitality Clinic today! Here is your listing verification link: directory.novalyte.io/summit-vitality. We will follow up next month. Best, Devon from Novalyte.",
        });
        setOutcome("interested");
        setInterestLevel("warm");
        setNextAction("Send verification link & follow up next month");
        setFollowUpDate(new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);
      } else {
        // Live Mode: query GLM helper or backend summary
        setPostCallSummary({
          whatHappened: "Call completed. Summary will be generated after saving the final log record.",
          objections: "None recorded.",
          commitments: "Review transcript details.",
          sentiment: "Neutral",
          nextSteps: "Save log to trigger backend processing.",
          followUpMessage: "Draft follow-up email has not been generated yet.",
        });
      }
    }
  }, [callState, isLiveMode]);

  const activeClinic = useMemo(() => clinics.find((c) => c.id === activeClinicId) ?? null, [clinics, activeClinicId]);

  // Helpers
  async function persistCallSession(data: Record<string, unknown>) {
    if (!callSessionId) return;
    await fetch(`/api/calls/${callSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => undefined);
  }

  function selectClinic(id: string) {
    if (callState !== "idle" && callState !== "ended") {
      toast.error("Please end the current call before switching clinics.");
      return;
    }
    setActiveClinicId(id);
    resetCallState();
  }

  function resetCallState() {
    setCallState("idle");
    setCallDuration(0);
    setNotes("");
    setOutcome("");
    setInterestLevel("unknown");
    setNextAction("");
    setFollowUpDate("");
    setQualification({});
    setMuted(false);
    setOnHold(false);
    setKeypadInput("");
    setCallSessionId(null);
    setProviderCallId(null);
    setResearch(null);
    setTranscript([]);
    setPostCallSummary(null);
    setActiveStage("intro");
    setCopilotSuggestion("Place a call to start receiving live coaching tips.");
    setCopilotQuestion(null);
    setObjectionGuidance(null);
    setClinicFacts([]);
    setCopilotWarning(null);
    setCopilotNextAction(null);
  }

  // Dialer functionality
  async function startCall() {
    if (startingCallRef.current || callState !== "idle") return;
    if (!activeClinic?.primaryPhone) {
      toast.error("Selected clinic has no phone number.");
      return;
    }

    resetCallState();
    startingCallRef.current = true;
    setCallState("configuring");

    if (isLiveMode) {
      // Production live outbound API call
      try {
        const response = await fetch("/api/vapi/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clinicId: activeClinic.id }),
        });
        const payload = await response.json().catch(() => ({}));
        if (payload.callSessionId) setCallSessionId(payload.callSessionId);
        if (!response.ok) {
          setCallState(payload.callSessionId ? "failed" : "idle");
          toast.error(payload.error || "Vapi outbound call failed to start.");
          return;
        }
        setProviderCallId(payload.callId ?? null);
        setCallState("dialing");
        toast.success(`Outgoing call triggered successfully.`);
      } catch (err) {
        setCallState("failed");
        toast.error("Telephony API not reachable.");
      } finally {
        startingCallRef.current = false;
      }
    } else {
      // Simulator mode call initiation
      try {
        // Create an attempt in database to verify Supabase connectivity in dev mode
        const response = await fetch("/api/vapi/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clinicId: activeClinic.id }),
        });
        const payload = await response.json().catch(() => ({}));
        if (payload.callSessionId) {
          setCallSessionId(payload.callSessionId);
          // Set status to dialing to signify simulated call
          await fetch(`/api/calls/${payload.callSessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "dialing" }),
          }).catch(() => undefined);
        }
      } catch (e) {
        // Silent fallback to local memory session ID if server APIs are offline
        setCallSessionId(`sim_${Math.random().toString(36).substring(2, 9)}`);
      }
      setCallState("dialing");
      startingCallRef.current = false;
    }
  }

  function endCall() {
    setCallState("ended");
    if (simulatorRef.current) {
      simulatorRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    void persistCallSession({
      status: "ended",
      endedAt: new Date().toISOString(),
      durationSec: callDuration,
    });
    toast.info(`Call ended · ${formatDuration(callDuration)}`);
  }

  function toggleMute() {
    setMuted((m) => !m);
    toast.info(muted ? "Microphone active" : "Microphone muted");
  }

  function toggleHold() {
    if (callState === "connected") {
      if (simulatorRef.current) simulatorRef.current.pause();
      setCallState("on_hold");
      setOnHold(true);
      toast.info("Call placed on hold");
    } else if (callState === "on_hold") {
      if (simulatorRef.current) simulatorRef.current.resume();
      setCallState("connected");
      setOnHold(false);
      toast.info("Call resumed");
    }
  }

  function handleKeypadPress(key: string) {
    setKeypadInput((v) => v + key);
    toast.info(`DTMF Tone: ${key}`);
  }

  async function fetchClinicResearch() {
    if (!activeClinic) return;
    setResearchLoading(true);
    try {
      const response = await fetch("/api/research/clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: activeClinic.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Research API failed.");
      setResearch(payload.research?.markdown || "No website data returned.");
      toast.success("Research profile updated.");
    } catch (err) {
      // In dev mode fallback, display realistic research summary
      const mockResearch = `
# Research Summary: ${activeClinic.name}
*   **Website Status:** Online
*   **Key Doctor:** Dr. Marcus Cole (Specialist in TRT and Peptide therapy)
*   **Primary Locations:** Austin, TX (Main office), Houston (Satellite)
*   **Telehealth Status:** Yes, supported for residents of Texas
*   **Patient Intake:** Accepting new patients. Online booking links found at "/book"
*   **Pricing Insights:** Standard consultation starts at $150, accepts Aetna and BCBS.
      `;
      setResearch(mockResearch);
      toast.info("Mock research profile generated in simulator mode.");
    } finally {
      setResearchLoading(false);
    }
  }

  async function saveCallLog() {
    if (!outcome) {
      toast.error("Please select a call outcome before saving.");
      return;
    }
    if (!activeClinic) return;

    const outcomeConfig = CALL_OUTCOMES.find((item) => item.id === outcome);
    const bodyPayload = {
      outcome,
      answered: outcomeConfig?.connected ?? false,
      decisionMakerReached: qualification.q1 ?? false,
      interestLevel,
      notes: notes || `Call log: ${outcomeConfig?.label || outcome}`,
      nextAction: nextAction || undefined,
      nextActionAt: followUpDate ? new Date(followUpDate).toISOString() : undefined,
      followUpRequired: Boolean(nextAction),
      durationSec: callDuration,
      callSessionId: callSessionId ?? undefined,
      structuredData: {
        onboardingChecklist: qualification,
        transcript: transcript,
        postCallSummary: postCallSummary,
      },
    };

    try {
      const response = await fetch(`/api/clinics/${activeClinic.id}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save call session.");
      }
      toast.success("Call logged and clinic pipeline updated successfully.");
      resetCallState();
      loadData();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the call log.");
    }
  }

  // Analytics helper metrics
  const analyticsMetrics = useMemo(() => {
    const total = callHistory.length;
    if (total === 0) return { count: 0, answerRate: 0, convRate: 0, permRate: 0, avgDuration: "0:00" };

    const answered = callHistory.filter((c) => c.answered).length;
    const answeredPercentage = Math.round((answered / total) * 100);

    const conversations = callHistory.filter((c) => c.decisionMakerReached).length;
    const conversationPercentage = Math.round((conversations / total) * 100);

    const permissionGranted = callHistory.filter((c) => c.outcome === "interested" || c.outcome === "meeting_booked" || c.outcome === "information_requested").length;
    const permissionPercentage = Math.round((permissionGranted / Math.max(conversations, 1)) * 100);

    const totalDuration = callHistory.reduce((acc, c) => acc + c.durationSec, 0);
    const avgDuration = Math.round(totalDuration / total);

    return {
      count: total,
      answerRate: answeredPercentage,
      convRate: conversationPercentage,
      permRate: permissionPercentage,
      avgDuration: formatDuration(avgDuration),
    };
  }, [callHistory]);

  const filteredQueue = useMemo(() => {
    return clinics.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.city || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.state || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [clinics, searchQuery]);

  return (
    <div className="space-y-4">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Calls Command Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Voice Copilot workspace for live clinic calling and automated database logging
          </p>
        </div>

        {/* Development Mode Badge Switch */}
        <div className="flex items-center gap-3 bg-card border rounded-lg px-3 py-1.5 shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Mode:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (callState !== "idle" && callState !== "ended") {
                  toast.error("Please end the active call before switching modes.");
                  return;
                }
                setIsLiveMode(false);
                toast.success("Switched to Simulated Development Mode.");
              }}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                !isLiveMode
                  ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              Simulated Dev Mode
            </button>
            <button
              onClick={() => {
                if (callState !== "idle" && callState !== "ended") {
                  toast.error("Please end the active call before switching modes.");
                  return;
                }
                setIsLiveMode(true);
                toast.success("Switched to Live Production Mode.");
              }}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                isLiveMode
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              Live Vapi Mode
            </button>
          </div>
        </div>
      </div>

      {/* PERFORMANCE ANALYTICS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Total Calls" value={analyticsMetrics.count} icon={PhoneCall} tone="default" hint="All attempts logged" />
        <MetricCard label="Answer Rate" value={`${analyticsMetrics.answerRate}%`} icon={TrendingUp} tone="teal" hint="Calls connected" />
        <MetricCard label="Conversations" value={`${analyticsMetrics.convRate}%`} icon={Activity} tone="violet" hint="Decision maker reached" />
        <MetricCard label="Listing Permission" value={`${analyticsMetrics.permRate}%`} icon={Award} tone="green" hint="Of conversations" />
        <MetricCard label="Avg Duration" value={analyticsMetrics.avgDuration} icon={Clock} tone="amber" hint="Average call time" />
      </div>

      {/* MOBILE SCREEN NAVIGATION TABS */}
      <div className="flex lg:hidden border-b pb-1 gap-1">
        <Button
          variant={mobileTab === "dialer" ? "default" : "ghost"}
          size="sm"
          className="flex-1 text-xs"
          onClick={() => setMobileTab("dialer")}
        >
          Dialer / Profile
        </Button>
        <Button
          variant={mobileTab === "copilot" ? "default" : "ghost"}
          size="sm"
          className="flex-1 text-xs gap-1.5"
          onClick={() => setMobileTab("copilot")}
        >
          <Sparkles className="size-3 text-amber-500 fill-amber-500" /> AI Copilot
        </Button>
        <Button
          variant={mobileTab === "notes" ? "default" : "ghost"}
          size="sm"
          className="flex-1 text-xs"
          onClick={() => setMobileTab("notes")}
        >
          Log / Outcome
        </Button>
      </div>

      {/* MAIN LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT COLUMN: Queue & History List (Desktop only, or visible when not calling on mobile) */}
        <Card className="lg:col-span-3 p-0 flex flex-col h-[65vh] lg:h-[calc(100vh-270px)] overflow-hidden shrink-0">
          <div className="border-b px-3 py-2 flex items-center justify-between bg-muted/20 shrink-0">
            <div className="flex items-center gap-1">
              <Button
                variant={sidebarTab === "queue" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 text-xs font-semibold px-3"
                onClick={() => setSidebarTab("queue")}
              >
                Queue ({clinics.length})
              </Button>
              <Button
                variant={sidebarTab === "history" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 text-xs font-semibold px-3"
                onClick={() => setSidebarTab("history")}
              >
                History
              </Button>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              {isLiveMode ? "LIVE" : "SIM"}
            </Badge>
          </div>

          {/* Search box for queue */}
          {sidebarTab === "queue" && (
            <div className="px-3 py-2 border-b shrink-0 bg-background flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                placeholder="Search queue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
              />
            </div>
          )}

          {/* List content */}
          <div className="flex-1 overflow-y-auto nv-scroll divide-y">
            {sidebarTab === "queue" ? (
              filteredQueue.length === 0 ? (
                <EmptyState icon={PhoneCall} title="No clinics" description="Search returned no matching clinics." />
              ) : (
                filteredQueue.map((clinic) => {
                  const withinHours = isWithinCallingHours(clinic.timezone);
                  const isSelected = clinic.id === activeClinicId;
                  return (
                    <button
                      key={clinic.id}
                      onClick={() => selectClinic(clinic.id)}
                      className={`w-full text-left p-3 flex flex-col gap-1 transition-colors hover:bg-accent/40 ${
                        isSelected ? "bg-primary/5 border-l-4 border-primary" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm truncate">{clinic.name}</span>
                        <PriorityBadge priority={clinic.priority} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                        <span className="truncate">{[clinic.city, clinic.state].filter(Boolean).join(", ")}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-mono">{localTime(clinic.timezone)}</span>
                          <span className={`size-1.5 rounded-full ${withinHours ? "bg-emerald-500 animate-pulse" : "bg-rose-400"}`} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 border-t pt-1 border-dotted border-muted">
                        <span>Phone: {formatPhone(clinic.primaryPhone)}</span>
                        <span>Attempts: {clinic.callAttempts}</span>
                      </div>
                    </button>
                  );
                })
              )
            ) : (
              callHistory.length === 0 ? (
                <EmptyState icon={History} title="No history" description="No calls have been logged yet." />
              ) : (
                callHistory.map((session) => (
                  <div key={session.id} className="p-3 text-xs flex flex-col gap-1.5 hover:bg-muted/10">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium truncate">{session.clinicName}</span>
                      <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full ${
                        session.outcome === "interested" || session.outcome === "meeting_booked"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : session.outcome === "not_interested" || session.outcome === "do_not_call"
                            ? "bg-rose-100 text-rose-800 border-rose-200"
                            : "bg-slate-100 text-slate-800 border-slate-200"
                      }`}>
                        {OUTCOME_MAP[session.outcome]?.label || session.outcome}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                      <span>Duration: {formatDuration(session.durationSec)}</span>
                      <span>{relativeTime(session.startedAt)}</span>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </Card>

        {/* CENTER COLUMN: Dialer console, Live transcript, and Talk tracks */}
        <div className={`lg:col-span-6 flex flex-col gap-4 ${mobileTab !== "dialer" ? "hidden lg:flex" : ""}`}>
          
          {/* ACTIVE CLINIC INFORMATION PROFILE */}
          {activeClinic ? (
            <Card className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <button
                        onClick={() => openClinic(activeClinic.id)}
                        className="font-bold text-base hover:text-primary transition-colors text-left block truncate"
                      >
                        {activeClinic.name}
                      </button>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="size-3" />
                        {activeClinic.address}, {activeClinic.city}, {activeClinic.state} {activeClinic.zip}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge priority={activeClinic.priority} />
                  <Badge variant="outline" className="font-mono text-xs">
                    Score: {activeClinic.readinessScore}
                  </Badge>
                </div>
              </div>

              {/* CONTACT DETAILS & LOCAL TIME */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-y py-2.5 text-xs">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Primary Phone</p>
                  <p className="font-semibold text-foreground mt-0.5">{formatPhone(activeClinic.primaryPhone) || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Email Address</p>
                  <p className="truncate text-foreground mt-0.5" title={activeClinic.generalEmail ?? ""}>
                    {activeClinic.generalEmail ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Website</p>
                  {activeClinic.website ? (
                    <a
                      href={activeClinic.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 mt-0.5 truncate"
                    >
                      <Globe className="size-3" /> {activeClinic.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <p className="text-foreground mt-0.5">—</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Local Time</p>
                  <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                    <Clock className="size-3 text-muted-foreground" />
                    <span>{localTime(activeClinic.timezone)}</span>
                    <span className={`size-1.5 rounded-full ${isWithinCallingHours(activeClinic.timezone) ? "bg-emerald-500" : "bg-rose-500"}`} />
                  </p>
                </div>
              </div>

              {/* DECISION MAKER CONTACTS */}
              {activeClinic.contacts.length > 0 && (
                <div className="bg-muted/30 border rounded-lg p-2 text-xs">
                  <span className="font-semibold text-muted-foreground">Key Contacts & Decision Makers:</span>
                  <div className="space-y-1.5 mt-1.5">
                    {activeClinic.contacts.map((c) => (
                      <div key={c.id} className="flex items-center justify-between border-b last:border-0 pb-1.5 last:pb-0 border-dashed">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="size-3.5 text-muted-foreground" />
                          <span className="font-medium truncate">{fullName(c.firstName, c.lastName)}</span>
                          <span className="text-muted-foreground">({c.title || "Staff"})</span>
                          {c.isDecisionMaker && (
                            <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-[9px] px-1 py-0 h-4">
                              Decision-Maker
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2">
                          <span>{formatPhone(c.directPhone || c.mobilePhone)}</span>
                          <span>Method: {c.preferredContactMethod}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RESEARCH DETAILS */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchClinicResearch}
                  disabled={researchLoading}
                  className="flex-1 text-xs gap-1.5"
                >
                  <Sparkles className="size-3.5 text-indigo-500" />
                  {researchLoading ? "Researching..." : "Retrieve AI Research Profile"}
                </Button>
              </div>

              {research && (
                <div className="bg-indigo-50/30 border border-indigo-100 rounded-lg p-3 text-xs overflow-y-auto max-h-40 font-mono nv-scroll whitespace-pre-line text-indigo-950">
                  {research}
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-8 text-center flex flex-col items-center justify-center">
              <Building2 className="size-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Select a clinic from the queue to start.</p>
            </Card>
          )}

          {/* DOCK DIALER CONSOLE CONTROLLER */}
          {activeClinic && (
            <Card className="bg-slate-900 border-slate-950 text-white p-4 shadow-xl flex flex-col gap-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-radial-gradient from-slate-800 to-slate-900 opacity-50 z-0 pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
                
                {/* Caller identity status indicator */}
                <div className="flex items-center gap-3">
                  <div className={`size-12 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    callState === "connected"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 animate-pulse"
                      : callState === "dialing" || callState === "ringing"
                        ? "border-amber-500 bg-amber-500/10 text-amber-400"
                        : callState === "on_hold"
                          ? "border-amber-400 bg-amber-400/10 text-amber-400"
                          : "border-slate-700 bg-slate-800 text-slate-400"
                  }`}>
                    <PhoneOutgoing className="size-6" />
                  </div>
                  <div className="text-center md:text-left">
                    <div className="flex items-center gap-1.5 justify-center md:justify-start">
                      <span className="text-sm font-semibold tracking-wide">
                        {callState === "idle" ? "READY TO DIAL" : callState.replace(/_/g, " ").toUpperCase()}
                      </span>
                      <span className={`size-2 rounded-full ${
                        callState === "connected" ? "bg-emerald-500" : callState === "idle" ? "bg-slate-500" : "bg-amber-500"
                      }`} />
                    </div>
                    <p className="text-xs text-slate-400 tracking-wider font-mono mt-0.5">
                      {formatPhone(activeClinic.primaryPhone)}
                    </p>
                  </div>
                </div>

                {/* Call Timer counter */}
                {(callState === "connected" || callState === "on_hold" || callState === "ended") && (
                  <div className="font-mono text-3xl font-bold tracking-widest text-slate-100 bg-slate-800/80 px-4 py-1.5 rounded-lg border border-slate-700 shadow-inner">
                    {formatDuration(callDuration)}
                  </div>
                )}

                {/* Dial controller actions */}
                <div className="flex items-center gap-2">
                  {callState === "idle" ? (
                    <Button
                      onClick={startCall}
                      disabled={startingCallRef.current}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 h-11 rounded-lg flex items-center gap-2 shadow-lg"
                    >
                      <Phone className="size-4" /> Start Call
                    </Button>
                  ) : (
                    <Button
                      onClick={endCall}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm px-6 h-11 rounded-lg flex items-center gap-2 shadow-lg"
                    >
                      <PhoneOff className="size-4" /> Hang Up
                    </Button>
                  )}
                </div>
              </div>

              {/* Call active controls layout */}
              {callState !== "idle" && callState !== "failed" && callState !== "provider_unavailable" && (
                <div className="relative z-10 grid grid-cols-6 gap-2 border-t border-slate-800 pt-3 text-slate-300">
                  <button
                    onClick={toggleMute}
                    disabled={callState === "ended"}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-800 transition-colors ${
                      muted ? "text-rose-400 bg-rose-500/10" : ""
                    }`}
                  >
                    {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                    <span className="text-[10px] font-semibold mt-1">Mute</span>
                  </button>

                  <button
                    onClick={toggleHold}
                    disabled={callState === "ended" || callState === "dialing" || callState === "ringing"}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-800 transition-colors ${
                      onHold ? "text-amber-400 bg-amber-500/10" : ""
                    }`}
                  >
                    {onHold ? <Play className="size-5" /> : <Pause className="size-5" />}
                    <span className="text-[10px] font-semibold mt-1">{onHold ? "Resume" : "Hold"}</span>
                  </button>

                  <button
                    onClick={() => setDialPadOpen(!dialPadOpen)}
                    disabled={callState === "ended"}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-800 transition-colors ${
                      dialPadOpen ? "text-primary bg-primary/10" : ""
                    }`}
                  >
                    <Grid3x3 className="size-5" />
                    <span className="text-[10px] font-semibold mt-1">Keypad</span>
                  </button>

                  <button
                    onClick={() => {
                      setSpeakerEnabled(!speakerEnabled);
                      toast.info(speakerEnabled ? "Speaker disabled" : "Speaker active");
                    }}
                    disabled={callState === "ended"}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-800 transition-colors ${
                      speakerEnabled ? "text-emerald-400 bg-emerald-500/10" : ""
                    }`}
                  >
                    {speakerEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
                    <span className="text-[10px] font-semibold mt-1">Speaker</span>
                  </button>

                  <button
                    onClick={() => {
                      toast.warning("Transfer function not configured on active gateway.");
                    }}
                    disabled={callState === "ended" || callState === "dialing" || callState === "ringing"}
                    className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <UserCheck className="size-5" />
                    <span className="text-[10px] font-semibold mt-1">Transfer</span>
                  </button>

                  <div className="flex flex-col items-center justify-center p-2 text-slate-500">
                    <Clock className="size-5" />
                    <span className="text-[9px] font-semibold mt-1 uppercase font-mono">
                      {isLiveMode ? "LIVE" : "SIM"}
                    </span>
                  </div>
                </div>
              )}

              {/* Collapsible Dialer Keypad Pad */}
              {dialPadOpen && callState !== "ended" && (
                <div className="relative z-10 grid grid-cols-3 gap-2 max-w-[180px] mx-auto bg-slate-800 border border-slate-700 rounded-lg p-2.5 mt-2 animate-in fade-in-20 duration-150">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((key) => (
                    <button
                      key={key}
                      onClick={() => handleKeypadPress(key)}
                      className="size-10 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-sm font-semibold active:bg-slate-500 transition-colors border border-slate-600"
                    >
                      {key}
                    </button>
                  ))}
                  {keypadInput && (
                    <div className="col-span-3 text-center text-xs font-mono text-slate-400 truncate pt-1">
                      Input: {keypadInput}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* ACTIVE REAL-TIME TRANSCRIPT PANEL */}
          {callState !== "idle" && (
            <Card className="flex-1 flex flex-col p-0 min-h-[300px] max-h-[380px] overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between shrink-0">
                <span className="text-sm font-bold flex items-center gap-1.5">
                  <Activity className="size-4 text-primary animate-pulse" /> Live Call Transcript
                </span>
                <Badge variant="secondary" className="font-mono text-[10px] font-semibold">
                  {transcript.length} turns
                </Badge>
              </div>

              {/* Scrolling transcript bubble workspace */}
              <div className="flex-1 overflow-y-auto nv-scroll p-4 bg-muted/5 space-y-3">
                {transcript.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-xs p-6">
                    <Clock className="size-6 mb-1 text-slate-300 animate-pulse" />
                    Waiting for call to connect...
                  </div>
                ) : (
                  transcript.map((line, idx) => {
                    const isYou = line.speaker === "you";
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col max-w-[85%] ${isYou ? "ml-auto items-end" : "mr-auto items-start"}`}
                      >
                        <span className="text-[10px] text-muted-foreground font-semibold px-1 py-0.5">
                          {isYou ? "You (Operator)" : "Clinic Receptionist (Priya)"}
                        </span>
                        <div className={`p-2.5 rounded-lg text-sm mt-0.5 ${
                          isYou
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-card border text-foreground rounded-tl-none shadow-sm"
                        }`}>
                          {line.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={transcriptEndRef} />
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: AI Voice Copilot Panel, Qualification checklist, and Outcomes */}
        <div className={`lg:col-span-3 flex flex-col gap-4 ${mobileTab !== "copilot" ? "hidden lg:flex" : ""}`}>
          
          {/* DYNAMIC TALK TRACK STAGE PROGRESS */}
          {activeClinic && callState !== "idle" && (
            <Card className="p-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Live Talk Track Stage
              </span>
              <div className="flex items-center gap-1 mt-2">
                {[
                  { id: "intro", label: "Intro" },
                  { id: "objections", label: "Objections" },
                  { id: "discovery", label: "Discovery" },
                  { id: "agreement", label: "Agreement" },
                  { id: "closing", label: "Closing" },
                ].map((s, idx) => {
                  const isActive = activeStage === s.id;
                  return (
                    <div key={s.id} className="flex-1 flex items-center gap-1">
                      {idx > 0 && <ChevronRight className="size-3 text-muted-foreground/30" />}
                      <div
                        className={`flex-1 text-center py-1 rounded text-[10px] font-semibold uppercase ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-muted text-muted-foreground/70"
                        }`}
                        title={s.label}
                      >
                        {s.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* AI VOICE COPILOT CARD */}
          {activeClinic && (
            <Card className="p-4 bg-gradient-to-br from-indigo-50/40 via-purple-50/10 to-indigo-50/10 border-indigo-100 flex flex-col gap-3.5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                <Sparkles className="size-16 text-indigo-700" />
              </div>

              <div className="flex items-center gap-2 border-b pb-2 shrink-0">
                <div className="size-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0 shadow-sm border border-indigo-200">
                  <Sparkles className="size-4 text-indigo-700 fill-indigo-700/20" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">AI Voice Copilot</h3>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Active Assistance Coach</span>
                </div>
              </div>

              {/* Warnings Panel */}
              {copilotWarning && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-2.5 text-xs flex items-start gap-2 animate-bounce">
                  <AlertTriangle className="size-4 shrink-0 text-rose-500 mt-0.5" />
                  <div>
                    <span className="font-bold">Missed Checklist Warning:</span>
                    <p className="mt-0.5">{copilotWarning}</p>
                  </div>
                </div>
              )}

              {/* Suggestions workspace */}
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-indigo-600" /> Suggested Talk Sentence
                  </p>
                  <div className="bg-card border border-indigo-100/60 p-2.5 rounded-lg text-slate-700 italic font-medium mt-1 relative group">
                    "{copilotSuggestion}"
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (copilotSuggestion) {
                          navigator.clipboard.writeText(copilotSuggestion);
                          toast.success("Suggested response copied to clipboard!");
                        }
                      }}
                      className="absolute right-1 bottom-1 size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy suggestion"
                    >
                      <Send className="size-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                {copilotQuestion && (
                  <div>
                    <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wide">
                      Recommended Follow-Up Question
                    </p>
                    <p className="text-slate-700 bg-purple-50/30 border border-purple-100/60 p-2.5 rounded-lg font-medium mt-1">
                      {copilotQuestion}
                    </p>
                  </div>
                )}

                {objectionGuidance && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-lg">
                    <span className="font-bold text-[10px] text-amber-800 uppercase tracking-wide flex items-center gap-1">
                      <Flame className="size-3 text-amber-600 fill-amber-600/30" /> Objection guidance
                    </span>
                    <p className="mt-1 font-medium leading-relaxed">{objectionGuidance}</p>
                  </div>
                )}

                {clinicFacts.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
                      Quick Clinic Facts
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600 mt-1.5 font-medium">
                      {clinicFacts.map((fact, idx) => (
                        <li key={idx}>{fact}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {copilotNextAction && (
                  <div className="border-t pt-3 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-muted-foreground">Next Action:</span>
                    <span className="text-indigo-600 font-bold uppercase tracking-wide">{copilotNextAction}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* HUMAN COUCH OBJECTION CHEAT SHEET */}
          {activeClinic && callState === "connected" && (
            <Card className="p-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <BookOpen className="size-3.5" /> Objection Cheat Sheet
              </h4>
              <div className="space-y-1 mt-2 max-h-[140px] overflow-y-auto nv-scroll text-xs">
                {OBJECTION_LIBRARY.map((obj) => (
                  <div key={obj.id} className="border-b last:border-0 pb-1.5 last:pb-0 pt-1.5 first:pt-0">
                    <button
                      onClick={() => setExpandedObjection(expandedObjection === obj.id ? null : obj.id)}
                      className="w-full text-left font-semibold text-slate-700 hover:text-primary flex items-center justify-between"
                    >
                      <span>{obj.text}</span>
                      <ChevronRight className={`size-3 transition-transform ${expandedObjection === obj.id ? "rotate-90" : ""}`} />
                    </button>
                    {expandedObjection === obj.id && (
                      <p className="text-[11px] bg-slate-50 border p-2 rounded text-slate-600 mt-1 italic">
                        {obj.response}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* RIGHTMOST PANEL: Outcome, notes, and checklist */}
        <div className={`lg:col-span-3 flex flex-col gap-4 ${mobileTab !== "notes" ? "hidden lg:flex" : ""}`}>
          
          {/* QUALIFICATION CHECKLIST */}
          {activeClinic && (
            <Card className="p-4 flex flex-col gap-2.5">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 shrink-0">
                <CheckSquare className="size-4 text-muted-foreground" /> Qualification Checklist
              </h3>
              <div className="space-y-1.5 overflow-y-auto max-h-[190px] nv-scroll text-xs">
                {QUALIFICATION_CHECKLIST.map((q) => {
                  const isChecked = qualification[q.id] ?? false;
                  return (
                    <label
                      key={q.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer ${
                        isChecked
                          ? "bg-teal-50/50 border-teal-200 text-teal-800 font-medium"
                          : "hover:bg-muted bg-card text-muted-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          setQualification((prev) => ({
                            ...prev,
                            [q.id]: e.target.checked,
                          }));
                        }}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 size-4 shrink-0"
                      />
                      <span className="truncate leading-none">{q.label}</span>
                    </label>
                  );
                })}
              </div>
            </Card>
          )}

          {/* POST-CALL SUMMARY CARD (shown when call finishes) */}
          {postCallSummary && (
            <Card className="p-4 border-indigo-100 bg-indigo-50/20 flex flex-col gap-3 animate-in fade-in-20 duration-200">
              <div className="flex items-center gap-1.5 border-b pb-2">
                <Sparkles className="size-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wide">Post-Call AI Summary</h4>
              </div>
              <div className="space-y-2 text-xs text-slate-700 overflow-y-auto max-h-[220px] nv-scroll pr-1">
                <div>
                  <span className="font-bold text-indigo-900">What Happened:</span>
                  <p className="mt-0.5 leading-relaxed">{postCallSummary.whatHappened}</p>
                </div>
                <div>
                  <span className="font-bold text-indigo-900">Objections Handled:</span>
                  <p className="mt-0.5 leading-relaxed">{postCallSummary.objections}</p>
                </div>
                <div>
                  <span className="font-bold text-indigo-900">Commitments:</span>
                  <p className="mt-0.5 leading-relaxed">{postCallSummary.commitments}</p>
                </div>
                <div>
                  <span className="font-bold text-indigo-900">Clinic Sentiment:</span>
                  <p className="mt-0.5 leading-relaxed">{postCallSummary.sentiment}</p>
                </div>
                <div>
                  <span className="font-bold text-indigo-900">Draft Follow-Up Message:</span>
                  <div className="bg-card border p-2 rounded text-[11px] font-mono whitespace-pre-line mt-1 relative group text-slate-600 select-all">
                    {postCallSummary.followUpMessage}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* OUTCOME & SAVE LOG SESSION PANEL */}
          {activeClinic && (
            <Card className="p-4 flex flex-col gap-3.5 shrink-0">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 shrink-0">
                <Info className="size-4" /> Notes & Outcome Panel
              </h3>

              {/* Call Outcomes grid buttons */}
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
                  Select Call Outcome *
                </span>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                  {[
                    { id: "no_answer", label: "No Answer" },
                    { id: "voicemail", label: "Voicemail" },
                    { id: "call_back_requested", label: "Call Back Later" },
                    { id: "wrong_number", label: "Wrong Number" },
                    { id: "not_interested", label: "Not Interested" },
                    { id: "connected", label: "Connected" },
                    { id: "interested", label: "Interested" },
                    { id: "meeting_booked", label: "Permission Granted" },
                  ].map((item) => {
                    const isSelected = outcome === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setOutcome(item.id as CallOutcome)}
                        className={`text-[11px] py-1.5 px-2 rounded-lg border font-semibold text-center truncate transition-colors ${
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                            : "bg-card hover:bg-muted text-foreground border-slate-200"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interest Level */}
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
                  Interest Level
                </span>
                <div className="flex gap-1.5 mt-1">
                  {(["cold", "warm", "hot"] as const).map((lvl) => {
                    const isSelected = interestLevel === lvl;
                    return (
                      <button
                        key={lvl}
                        onClick={() => setInterestLevel(lvl)}
                        className={`flex-1 text-[11px] py-1 px-1.5 border capitalize rounded font-semibold transition-colors ${
                          isSelected
                            ? lvl === "cold"
                              ? "bg-blue-100 text-blue-800 border-blue-200"
                              : lvl === "warm"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-rose-100 text-rose-800 border-rose-200"
                            : "bg-card hover:bg-muted text-muted-foreground border-slate-200"
                        }`}
                      >
                        {lvl}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action and date */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide block">
                    Next Follow-up Action
                  </label>
                  <Input
                    placeholder="e.g., Send brochure via email"
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide block">
                    Follow-up Due Date
                  </label>
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Custom log notes */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide block">
                  Operator Call Notes
                </label>
                <Textarea
                  placeholder="Record summary notes of objections, key conversation facts, decision maker name..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[75px] text-xs resize-none"
                />
              </div>

              {/* Save log Button */}
              <Button
                onClick={saveCallLog}
                disabled={callState !== "idle" && callState !== "ended"}
                className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shrink-0"
              >
                Save Outcome & Sync Log
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Helpers

function formatDuration(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function ContactItem({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  return (
    <div>
      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">{label}</span>
      <span className={`font-semibold flex items-center gap-1 mt-0.5 leading-none truncate ${
        tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-foreground"
      }`}>
        <Icon className="size-3.5 shrink-0 opacity-60" /> {value}
      </span>
    </div>
  );
}

function CallStateIndicator({ state, duration }: { state: CallState; duration: number }) {
  const getBadgeColors = () => {
    switch (state) {
      case "connected":
        return "bg-emerald-50 text-emerald-800 border-emerald-200 animate-pulse";
      case "dialing":
      case "ringing":
      case "configuring":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "ended":
        return "bg-slate-100 text-slate-800 border-slate-200";
      case "on_hold":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-slate-50 text-slate-500 border-slate-200";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-3 text-center">
      <Badge className={`text-xs uppercase font-mono px-3 py-1 border ${getBadgeColors()}`}>
        {state.replace(/_/g, " ")}
      </Badge>
      {state !== "idle" && (
        <span className="text-3xl font-mono font-bold text-foreground mt-3 tracking-widest leading-none">
          {formatDuration(duration)}
        </span>
      )}
    </div>
  );
}
