"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Vapi from "@vapi-ai/web";
import { useNav } from "@/components/admin/admin-app";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  StatusBadge,
  PriorityBadge,
  MetricCard,
  DataSourceBadge,
} from "@/components/admin/shared";
import { appConfig } from "@/config/app-config";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Check,
  RotateCcw,
  Sparkle,
  SlidersHorizontal,
} from "lucide-react";
import { clinicService, callService } from "@/services";
import { CALL_OUTCOMES, OUTCOME_MAP } from "@/lib/constants";
import { formatPhone, localTime, isWithinCallingHours, relativeTime, fullName } from "@/lib/format";
import { toast } from "sonner";
import type { Clinic, CallSession, CallState, CallOutcome } from "@/types";
import { TelephonySimulator } from "@/lib/telephony-simulator";
import {
  DEFAULT_CONSENT_SCRIPT,
  inferConsentRequirement,
  type ConsentStatus,
} from "@/lib/calls/recording-consent";
import { suggestFromTranscriptContext, extractClinicFacts, intentToCallStage } from "@/lib/calls/transcript-context";
import { emergencyFallbackCard, openingLine } from "@/lib/calls/response-library";

// ---------------------------------------------------------------------------
// PRACTICE PERSONAS
// ---------------------------------------------------------------------------
interface PersonaConfig {
  id: string;
  name: string;
  role: string;
  voiceName: string;
  accent: string;
  trait: string;
  description: string;
}

const PRACTICE_PERSONAS: PersonaConfig[] = [
  { id: "receptionist", name: "Martha Shah", role: "Receptionist", voiceName: "Google US English", accent: "US Standard", trait: "Helpful but busy", description: "Wants to know why you are calling and check if this is a sales call before routing." },
  { id: "front_desk", name: "Tara Mills", role: "Front Desk Coordinator", voiceName: "Microsoft Zira", accent: "US West Coast", trait: "Gatekeeper", description: "Skeptical, guards the doctor's calendar, requests emails instead of calls." },
  { id: "office_manager", name: "Amani Okafor", role: "Office Manager", voiceName: "Google UK English Female", accent: "UK Received Pronunciation", trait: "Detail-oriented", description: "Asks details about directory costs, listing options, and scheduling links." },
  { id: "physician", name: "Dr. Marcus Cole", role: "Medical Director / Physician", voiceName: "Google US English Male", accent: "US Mid-Atlantic", trait: "Low patience", description: "Demands immediate explanation of value, clinical reputation, and patient volume." },
  { id: "clinic_owner", name: "David Lin", role: "Clinic Owner", voiceName: "Microsoft David", accent: "US Western", trait: "Analytical", description: "Inquires about patient qualification, lead scoring, and ROI of directory." },
  { id: "confused_employee", name: "Tyler Miller", role: "General Coordinator", voiceName: "Google US English Male", accent: "US Southern", trait: "Uninformed", description: "Friendly but doesn't know the decision-maker, easily distracted." }
];

// ---------------------------------------------------------------------------
// PRACTICE SCENARIOS
// ---------------------------------------------------------------------------
interface ScenarioConfig {
  id: string;
  name: string;
  objective: string;
  initialPrompt: string;
  dialogueTree: {
    stage: string;
    triggerKeywords: string[];
    clinicSpeech: string;
    copilotSuggestion: string;
    copilotQuestion: string;
    facts?: string[];
    warning?: string;
    objectionGuidance?: string;
  }[];
}

function manualFieldGuideResponse(transcriptOrReply: string, previous: string[] = []) {
  return suggestFromTranscriptContext({
    transcript: transcriptOrReply,
    latestClinicUtterance: transcriptOrReply.split("\n").filter(Boolean).at(-1),
    previousSuggestions: previous,
  }).suggestion;
}

// ---------------------------------------------------------------------------
// INLINE COACH TRANSCRIPT HELPERS
// Private coaching cues shown in the live transcript after clinic turns.
// Never spoken aloud — Jamil reads and delivers them.
// ---------------------------------------------------------------------------
type TranscriptLine = {
  speaker: string;
  text: string;
  timestamp: string;
  kind?: "utterance" | "coach";
};

const COACH_DRAFTING_TEXT = "Understanding the clinic’s response…";
const COACH_LISTENING_TEXT = "Listening for the clinic’s complete response…";

function isCoachLine(line: TranscriptLine | undefined): boolean {
  return Boolean(line && (line.kind === "coach" || line.speaker === "Coach"));
}

function lastUtterance(lines: TranscriptLine[]): TranscriptLine | undefined {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!isCoachLine(lines[i])) return lines[i];
  }
  return undefined;
}

/** Keep exactly one inline coach card (active suggestion) at the end of the transcript. */
function upsertInlineCoachSuggestion(lines: TranscriptLine[], text: string): TranscriptLine[] {
  if (!text.trim()) return lines;
  const coachLine: TranscriptLine = {
    speaker: "Coach",
    text,
    timestamp: new Date().toISOString(),
    kind: "coach",
  };
  const nonCoachLines = lines.filter((l) => !isCoachLine(l));
  return [...nonCoachLines, coachLine];
}

function utteranceTranscript(lines: TranscriptLine[]): TranscriptLine[] {
  return lines.filter((line) => !isCoachLine(line));
}

const PRACTICE_SCENARIOS: ScenarioConfig[] = [
  {
    id: "scenario_friendly",
    name: "Friendly Clinic Listing",
    objective: "Verify contact name, confirm services (TRT & Telehealth), and secure permission to list profile.",
    initialPrompt: "Hello, Summit Vitality, Martha speaking. How can I help you?",
    dialogueTree: [
      {
        stage: "intro",
        triggerKeywords: ["jamil", "novalyte", "directory", "hello", "hi"],
        clinicSpeech: "Oh, hi Jamil. Yes, this is Summit Vitality. I am the Practice Manager. What listing is this?",
        copilotSuggestion: "It's the Novalyte Men's Health Directory. We help local patients find TRT providers. May I confirm Dr. Cole is still the Medical Director?",
        copilotQuestion: "Confirm if Dr. Marcus Cole is still the Medical Director.",
        facts: ["Clinic Name: Summit Vitality Clinic", "Martha: Practice Manager"]
      },
      {
        stage: "directory",
        triggerKeywords: ["cole", "director", "yes", "confirm"],
        clinicSpeech: "Yes, Dr. Cole is our Medical Director. We do hormone optimization here. What info do you need?",
        copilotSuggestion: "Excellent. I have your main office at 1201 Congress Ave, Austin. Is that correct, and do you offer TRT and Peptide therapy?",
        copilotQuestion: "Verify location address and TRT/Peptide services.",
        facts: ["Medical Director: Dr. Marcus Cole"]
      },
      {
        stage: "qualification",
        triggerKeywords: ["address", "congress", "trt", "peptide"],
        clinicSpeech: "Yes, that's our address. And yes, we provide TRT, Peptide therapy, and Telehealth visits for Texas residents.",
        copilotSuggestion: "Perfect. We want to list you as verified for free. Do we have your permission to include your profile and booking link?",
        copilotQuestion: "Request explicit directory and booking URL listing permission.",
        warning: "Ensure you obtain explicit permission to publish the listing."
      },
      {
        stage: "agreement",
        triggerKeywords: ["permission", "list", "booking", "url", "verification"],
        clinicSpeech: "Sure, listing us sounds great as long as it's free. Our booking link is summitvitality.com/book.",
        copilotSuggestion: "Great, summitvitality.com/book. What is the best email to send your verified directory badge to?",
        copilotQuestion: "Ask for her direct email to send the verification link.",
        facts: ["Permission to list: GRANTED", "Booking URL: summitvitality.com/book"]
      },
      {
        stage: "closing",
        triggerKeywords: ["email", "martha@", "thank", "bye"],
        clinicSpeech: "You can send it to martha@summitvitality.com. Talk to you soon, Jamil. Bye!",
        copilotSuggestion: "Thank her, confirm email is martha@summitvitality.com, and click 'Hang Up'.",
        copilotQuestion: "Conclude call.",
        facts: ["Email: martha@summitvitality.com"]
      }
    ]
  },
  {
    id: "scenario_sales",
    name: "Is This a Sales Call?",
    objective: "Address sales objections, explain free directory value, and secure listing permission.",
    initialPrompt: "Summit Vitality Clinic. Is this a sales call? We don't purchase marketing.",
    dialogueTree: [
      {
        stage: "objections",
        triggerKeywords: ["sales", "marketing", "no", "not a sales", "free"],
        clinicSpeech: "Okay, because we get a dozen sales calls daily. If it's free, what's the catch? Why are you listing us?",
        copilotSuggestion: "No catch at all. It's the Novalyte Men's Health Directory. We list qualified providers for free to serve patients. Can I verify Dr. Cole's role?",
        copilotQuestion: "Reassure them that listings are free and ask about Dr. Cole.",
        facts: ["Objection: Sales catch", "No cost confirmed"]
      },
      {
        stage: "directory",
        triggerKeywords: ["cole", "director", "confirm", "verified"],
        clinicSpeech: "Dr. Marcus Cole is our director, yes. And we offer hormone care. But how do you make money if this is free?",
        copilotSuggestion: "Basic listings are 100% free forever. We only charge if clinics opt in to receive premium guaranteed leads. May I confirm your office address?",
        copilotQuestion: "Explain the business model clearly and verify address."
      },
      {
        stage: "qualification",
        triggerKeywords: ["address", "congress", "location", "trt"],
        clinicSpeech: "Our address is 1201 Congress Ave, Austin. And yes, we offer TRT. I guess it's fine to list us if there's no bill.",
        copilotSuggestion: "Perfect, thank you! May we also feature your booking link, summitvitality.com/book, in your verified listing?",
        copilotQuestion: "Secure permission to publish the booking link.",
        facts: ["Permission to list: GRANTED"]
      },
      {
        stage: "closing",
        triggerKeywords: ["book", "summitvitality", "link", "email"],
        clinicSpeech: "Yes, you can list it. Send the verified badge link to martha@summitvitality.com so we can check it.",
        copilotSuggestion: "Confirm the email martha@summitvitality.com and wrap up the call.",
        copilotQuestion: "Conclude call.",
        facts: ["Email: martha@summitvitality.com", "Booking link: summitvitality.com/book"]
      }
    ]
  }
];

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

  // Operating Modes
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(true);

  // Audio setup test state
  const [audioTestingOpen, setAudioTestingOpen] = useState(false);
  const [micsList, setMicsList] = useState<MediaDeviceInfo[]>([]);
  const [speakersList, setSpeakersList] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");
  const [micTestLevel, setMicTestLevel] = useState<number>(0);
  const [isRecordingSample, setIsRecordingSample] = useState(false);
  const [sampleDuration, setSampleDuration] = useState(0);
  const [recordingBlobUrl, setRecordingBlobUrl] = useState<string | null>(null);
  const [micTestPassed, setMicTestPassed] = useState(false);
  const [speakerTestPassed, setSpeakerTestPassed] = useState(false);
  const [testAudioPlaying, setTestAudioPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const testStreamRef = useRef<MediaStream | null>(null);
  const speakerTestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [research, setResearch] = useState<string | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);

  // High-Quality Voice & Audio Feedback Mode
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [isHeadphonesMode, setIsHeadphonesMode] = useState<boolean>(false);
  const isListeningRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        // Filter for English speaking options
        const englishVoices = voices.filter(v => v.lang.startsWith("en"));
        setAvailableVoices(englishVoices);
        
        if (englishVoices.length > 0 && !selectedVoiceName) {
          // Fallback selection of common natural sounding system models
          const preferred = englishVoices.find(v => v.name.includes("Siri") || v.name.includes("Samantha") || v.name.includes("Google US English") || v.name.includes("Enhanced")) || englishVoices[0];
          setSelectedVoiceName(preferred?.name || "");
        }
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, [selectedVoiceName]);

  // Practice Configuration State
  const [practicePersona, setPracticePersona] = useState<string>("receptionist");
  const [practiceScenario, setPracticeScenario] = useState<string>("scenario_friendly");
  const [practiceDifficulty, setPracticeDifficulty] = useState<"beginner" | "intermediate" | "advanced">("beginner");

  // Call states
  const [callState, setCallState] = useState<CallState>("idle");
  const callStateRef = useRef<CallState>("idle");
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [dialPadOpen, setDialPadOpen] = useState(false);
  const [keypadInput, setKeypadInput] = useState("");
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [providerCallId, setProviderCallId] = useState<string | null>(null);

  // Live Copilot & Transcript
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [activeStage, setActiveStage] = useState<string>("intro");
  const [copilotSuggestion, setCopilotSuggestion] = useState<string | null>(openingLine().primary);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotSource, setCopilotSource] = useState<"opening" | "deterministic" | "ai" | "field_guide">("opening");
  const [copilotQuestion, setCopilotQuestion] = useState<string | null>(null);
  const [copilotShorter, setCopilotShorter] = useState<string | null>(openingLine().shorter);
  const [copilotDoNotSay, setCopilotDoNotSay] = useState<string[]>(openingLine().doNotSay);
  const [copilotFreezeRecovery, setCopilotFreezeRecovery] = useState<string>(openingLine().freezeRecovery);
  const emergencyCard = emergencyFallbackCard();
  const [objectionGuidance, setObjectionGuidance] = useState<string | null>(null);
  const [clinicFacts, setClinicFacts] = useState<string[]>([]);
  const [copilotWarning, setCopilotWarning] = useState<string | null>(null);
  const [copilotNextAction, setCopilotNextAction] = useState<string | null>(null);
  const [copilotStructuredReason, setCopilotStructuredReason] = useState<string | null>(null);
  const [copilotKnowledgeSources, setCopilotKnowledgeSources] = useState<Array<{ title: string; source: string; section: string }>>([]);
  const [copilotGroundingStatus, setCopilotGroundingStatus] = useState<string | null>(null);
  const lastRetrievedKnowledgeRef = useRef<unknown>(null);

  // Live voice metrics
  const [speakingPace, setSpeakingPace] = useState<string>("Good (130 WPM)");
  const [interruptionWarning, setInterruptionWarning] = useState<boolean>(false);
  const [speakingListeningRatio, setSpeakingListeningRatio] = useState<string>("50:50");
  const [callQualityScore, setCallQualityScore] = useState<number>(0);
  const [aiCoachingFeedback, setAiCoachingFeedback] = useState<string | null>(null);

  // Notes, Checklist & Outcomes
  const [notes, setNotes] = useState("");
  const [interestLevel, setInterestLevel] = useState<"unknown" | "cold" | "warm" | "hot">("unknown");
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [nextAction, setNextAction] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [qualification, setQualification] = useState<Record<string, boolean>>({});
  const [expandedObjection, setExpandedObjection] = useState<string | null>(null);

  // Post-Call AI Summary
  const [postCallSummary, setPostCallSummary] = useState<{
    whatHappened: string;
    objections: string;
    commitments: string;
    sentiment: string;
    nextSteps: string;
    followUpMessage: string;
  } | null>(null);

  // Practice Interactive Engines
  const [isClinicSpeaking, setIsClinicSpeaking] = useState(false);
  const [practiceResponse, setPracticeResponse] = useState("");
  const [speechRecognitionUnavailable, setSpeechRecognitionUnavailable] = useState(false);
  const [practiceInterruptionCount, setPracticeInterruptionCount] = useState(0);
  const [scenarioStepIndex, setScenarioStepIndex] = useState(-1);
  const vapiPracticeRef = useRef<Vapi | null>(null);
  const practiceConnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const telnyxClientRef = useRef<any>(null);
  const telnyxCallRef = useRef<any>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulatorRef = useRef<TelephonySimulator | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const lastTranscriptLenRef = useRef(0);
  const TRANSCRIPT_BOTTOM_THRESHOLD_PX = 120;
  const callDurationRef = useRef(0);
  const startingCallRef = useRef(false);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const speakerEnabledRef = useRef(true);
  const practiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastMicAudioAtRef = useRef(0);
  const micSilenceWarnedRef = useRef(false);
  const ttsFallbackWarnedRef = useRef(false);
  const isClinicSpeakingRef = useRef(false);
  const userSpeechDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userSpeechAccumRef = useRef("");

  useEffect(() => {
    callDurationRef.current = callDuration;
  }, [callDuration]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    speakerEnabledRef.current = speakerEnabled;
  }, [speakerEnabled]);

  useEffect(() => {
    isClinicSpeakingRef.current = isClinicSpeaking;
  }, [isClinicSpeaking]);

  useEffect(() => () => {
    if (speakerTestTimeoutRef.current) clearTimeout(speakerTestTimeoutRef.current);
    if (practiceConnectTimeoutRef.current) clearTimeout(practiceConnectTimeoutRef.current);
    if (userSpeechDebounceRef.current) clearTimeout(userSpeechDebounceRef.current);
  }, []);

  // Controlled transcript auto-follow:
  // - Only follow when user is already near the bottom.
  // - If user scrolls up, stop auto-follow and show "New messages" button.
  const handleTranscriptScroll = useCallback(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom <= TRANSCRIPT_BOTTOM_THRESHOLD_PX;
    atBottomRef.current = atBottom;
    if (atBottom) {
      setShowNewMessages(false);
      setNewMessagesCount(0);
    }
  }, []);

  const jumpToTranscriptBottom = useCallback(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    atBottomRef.current = true;
    setShowNewMessages(false);
    setNewMessagesCount(0);
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    const el = transcriptScrollRef.current;
    const prevLen = lastTranscriptLenRef.current;
    const newLen = transcript.length;

    // Track new messages only when content actually grows.
    if (newLen > prevLen) {
      if (el && atBottomRef.current) {
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        });
      } else {
        const delta = newLen - prevLen;
        setNewMessagesCount((c) => c + delta);
        setShowNewMessages(true);
      }
    }

    lastTranscriptLenRef.current = newLen;
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
        const clinicsList = clinicsPayload?.clinics || [];
        const filteredQueue = clinicsList.filter((c) =>
          ["ready_to_call", "attempted", "connected", "follow_up_required"].includes(c.pipelineStage) &&
          !c.doNotCall &&
          !c.archived
        );
        setClinics(filteredQueue);
        setCallHistory(historyPayload?.calls || []);

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

  // Live / Vapi Outbound Status Polling
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

  // Live Mode: Telephony Simulator (Silent operator guide)
  useEffect(() => {
    if (isLiveMode || isPracticeMode) return;
    if (callState === "dialing" && !simulatorRef.current) {
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
            setTranscript((prev) => [...prev, event.payload as TranscriptLine]);
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
            if (event.payload.suggestion) {
              setTranscript((prev) => upsertInlineCoachSuggestion(prev, event.payload.suggestion));
            }
            if (event.payload.speakingPace) setSpeakingPace(event.payload.speakingPace);
            if (event.payload.interruptionWarning !== undefined) setInterruptionWarning(event.payload.interruptionWarning);
            break;
          case "metrics":
            setSpeakingListeningRatio(event.payload.speakingListeningRatio);
            setCallQualityScore(event.payload.callQualityScore);
            setAiCoachingFeedback(event.payload.aiCoachingFeedback);
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
  }, [callState, isLiveMode, isPracticeMode]);

  // Post-Call AI Summary mapping
  useEffect(() => {
    if (callState === "ended") {
      if (isPracticeMode) {
        // Generate dynamic Practice Scorecard
        const calculatedScore = Math.max(30, 100 - (practiceInterruptionCount * 8) - (qualification.q1 ? 0 : 25));
        setCallQualityScore(calculatedScore);
        setSpeakingListeningRatio("53:47");
        setAiCoachingFeedback(
          calculatedScore >= 80
            ? "Excellent directory verification technique. Great confidence addressing the free listing structure. Keep your pacing slow and let the clinic speak."
            : "Focus on obtaining directory listing permission explicitly. Keep calm when sales objections are raised, and allow the clinic receptionist to finish talking."
        );
        setPostCallSummary({
          whatHappened: `Practice simulation complete. Rehearsed the clinic scenario "${PRACTICE_SCENARIOS.find(s => s.id === practiceScenario)?.name}" with selected persona "${PRACTICE_PERSONAS.find(p => p.id === practicePersona)?.name}".`,
          objections: qualification.q1 ? "Successfully handled sign-up/free directory objections." : "Objections raised but permission target was missed.",
          commitments: qualification.q1 ? "Clinic receptionist granted listing verification permission." : "No commitments secured.",
          sentiment: qualification.q1 ? "Friendly, helpful" : "Skeptical, busy",
          nextSteps: "Confirm details in real directory outreach.",
          followUpMessage: "Review practice dialogue turns for compliance tips.",
        });
      } else if (!isLiveMode) {
        setPostCallSummary({
          whatHappened: "Jamil contacted Summit Vitality Clinic and spoke with Martha, the Practice Manager. Verified Dr. Marcus Cole as the Medical Director and verified their listing details.",
          objections: "Initial objection raised: 'We didn't sign up for this directory'. Clarified that the directory is free, which resolved the objection.",
          commitments: "Martha granted Jamil explicit permission to publish the clinic as verified in the Novalyte directory.",
          sentiment: "Positive and receptive.",
          nextSteps: "Email verified link to martha@summitvitality.com and follow up next month.",
          followUpMessage: "Hi Martha, thanks for verifying Summit Vitality Clinic today! Here is your listing link: directory.novalyte.io/summit-vitality. We will check in next month. Best, Jamil.",
        });
        setOutcome("interested");
        setInterestLevel("warm");
        setNextAction("Email verified listing link & follow up next month");
        setFollowUpDate(new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);
      } else {
        setPostCallSummary({
          whatHappened: "Call completed. Summary details will process and populate upon saving log records.",
          objections: "None recorded.",
          commitments: "Review transcript details.",
          sentiment: "Neutral",
          nextSteps: "Save log to trigger backend database logging.",
          followUpMessage: "Draft follow-up email has not been generated yet.",
        });
      }
    }
  }, [callState, isLiveMode, isPracticeMode, practiceScenario, practicePersona, practiceInterruptionCount, qualification]);

  const activeClinic = useMemo(() => clinics.find((c) => c.id === activeClinicId) ?? null, [clinics, activeClinicId]);

  // Audio setup test controllers
  const startAudioTesting = async () => {
    setAudioTestingOpen(true);
    setMicTestPassed(false);
    setSpeakerTestPassed(false);
    setRecordingBlobUrl(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStreamRef.current = stream;
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === "audioinput");
      const speakers = devices.filter((d) => d.kind === "audiooutput");
      
      setMicsList(mics);
      setSpeakersList(speakers);
      
      if (mics.length > 0) setSelectedMic(mics[0].deviceId);
      if (speakers.length > 0) setSelectedSpeaker(speakers[0].deviceId);

      // Start decibel analyzer
      startMicVisualizer(stream);
    } catch (err) {
      toast.error("Microphone access denied or not connected.");
    }
  };

  const stopAudioTesting = () => {
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((track) => track.stop());
      testStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioTestingOpen(false);
  };

  const startMicVisualizer = (stream: MediaStream) => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    audioContextRef.current = ctx;
    const analyser = ctx.createAnalyser();
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkLevel = () => {
      if (!testStreamRef.current || !testStreamRef.current.active) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / bufferLength;
      setMicTestLevel(Math.min(100, Math.round((avg / 128) * 100)));
      requestAnimationFrame(checkLevel);
    };
    checkLevel();
  };

  const recordMicSample = () => {
    if (!testStreamRef.current) return;
    setIsRecordingSample(true);
    setSampleDuration(0);
    const mediaRecorder = new MediaRecorder(testStreamRef.current);
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      setRecordingBlobUrl(url);
      setIsRecordingSample(false);
      setMicTestPassed(true);
      toast.success("Microphone recording test completed successfully!");
    };

    mediaRecorder.start();

    let seconds = 0;
    const interval = setInterval(() => {
      seconds++;
      setSampleDuration(seconds);
      if (seconds >= 3) {
        clearInterval(interval);
        mediaRecorder.stop();
      }
    }, 1000);
  };

  const fallbackVoiceTest = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Speech Synthesis is not supported in this browser.");
      setTestAudioPlaying(false);
      return;
    }
    window.speechSynthesis.cancel();
    if (speakerTestTimeoutRef.current) clearTimeout(speakerTestTimeoutRef.current);
    
    const utterance = new SpeechSynthesisUtterance("Hello Jamil. This is a test of the AI clinic voice. Can you hear me clearly?");
    const voices = window.speechSynthesis.getVoices();
    const personaObj = PRACTICE_PERSONAS.find(p => p.id === practicePersona);
    const voice = voices.find(v => v.name.includes(personaObj?.voiceName || "English")) || voices.find(v => v.lang.startsWith("en")) || voices[0];
    if (voice) utterance.voice = voice;
    utterance.volume = 1.0;
    utterance.rate = 1.0;

    let completed = false;
    const completeTest = () => {
      if (completed) return;
      completed = true;
      if (speakerTestTimeoutRef.current) clearTimeout(speakerTestTimeoutRef.current);
      speakerTestTimeoutRef.current = null;
      setTestAudioPlaying(false);
      setSpeakerTestPassed(true);
      toast.success("Voice output check completed.");
    };

    utterance.onend = completeTest;
    utterance.onerror = () => {
      if (completed) return;
      completed = true;
      if (speakerTestTimeoutRef.current) clearTimeout(speakerTestTimeoutRef.current);
      speakerTestTimeoutRef.current = null;
      setTestAudioPlaying(false);
      toast.error("Voice output check failed.");
    };

    speakerTestTimeoutRef.current = setTimeout(completeTest, 5000);
    window.speechSynthesis.speak(utterance);
  };

  const playVoiceTest = async () => {
    setTestAudioPlaying(true);
    try {
      const response = await fetch("/api/copilot/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello Jamil. This is a test of the natural AI clinic voice. Can you hear me clearly?" }),
      });
      if (!response.ok) throw new Error("Aura TTS API request failed.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.onended = () => {
        setTestAudioPlaying(false);
        setSpeakerTestPassed(true);
        toast.success("Voice output check completed.");
      };

      audio.onerror = () => {
        setTestAudioPlaying(false);
        toast.error("Audio playback error during test.");
      };

      await audio.play();
    } catch (e) {
      console.warn("TTS test check failed, falling back to browser synthesis:", e);
      fallbackVoiceTest();
    }
  };

  // ---------------------------------------------------------------------------
  // PROVIDER-GRADE PRACTICE CALL ENGINE
  // ---------------------------------------------------------------------------
  const startScriptedPracticeFallback = async (reason: string) => {
    toast.warning(`Fallback voice mode (Vapi unavailable): ${reason}`, {
      description: "The realistic AI clinic could not stay connected, so a scripted practice clinic is running instead.",
      duration: 10000,
    });
    setCallState("connected");
    setSpeechRecognitionUnavailable(false);
    const scenario = PRACTICE_SCENARIOS.find((s) => s.id === practiceScenario) || PRACTICE_SCENARIOS[0];
    const opening = scenario.initialPrompt || scenario.dialogueTree[0]?.clinicSpeech;
    setScenarioStepIndex(-1);
    const openingSuggestion = scenario.dialogueTree[0]?.copilotSuggestion ?? "Introduce yourself and explain the free directory verification.";
    setCopilotSuggestion(openingSuggestion);
    setCopilotSource("ai");
    if (opening) {
      setTranscript([
        { speaker: "Clinic", text: opening, timestamp: new Date().toISOString() },
        { speaker: "Coach", text: openingSuggestion, timestamp: new Date().toISOString(), kind: "coach" },
      ]);
      void speakPracticeText(opening);
    }
    void startSpeechRecognition();
  };

  // Must run synchronously inside the click gesture so later programmatic
  // playback (Deepgram TTS turns, which start long after the click) is not
  // blocked by the browser autoplay policy — that block is what previously
  // forced the robotic window.speechSynthesis voice.
  const unlockPracticeAudio = () => {
    if (typeof window === "undefined") return;
    let audio = practiceAudioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.setAttribute("playsinline", "true");
      practiceAudioRef.current = audio;
    }
    // 1-sample silent WAV keeps the element "user-activated" for future play() calls.
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
    void audio.play().catch(() => { /* unlock is best-effort */ });
  };

  const applyPracticeAudioDevices = async (vapi: Vapi) => {
    try {
      if (selectedMic) await vapi.setInputDevicesAsync({ audioDeviceId: selectedMic });
      if (selectedSpeaker) vapi.setOutputDeviceAsync({ outputDeviceId: selectedSpeaker });
    } catch (error) {
      console.warn("Could not apply selected audio devices to the practice call:", error);
    }
  };

  const startPracticeCall = async () => {
    resetCallState();
    unlockPracticeAudio();
    ttsFallbackWarnedRef.current = false;
    micSilenceWarnedRef.current = false;
    lastMicAudioAtRef.current = 0;
    setCallState("configuring");
    setPracticeResponse("");
    setSpeechRecognitionUnavailable(false);
    setScenarioStepIndex(-1);
    setPracticeInterruptionCount(0);
    setCopilotSuggestion(PRACTICE_SCENARIOS.find((scenario) => scenario.id === practiceScenario)?.dialogueTree[0]?.copilotSuggestion ?? "Introduce yourself and explain the free directory verification.");
    setCopilotSource("ai");
    await createCallSession("practice");

    const tokenResponse = await fetch("/api/vapi/practice-token", { method: "POST" });
    const tokenData = await tokenResponse.json().catch(() => ({})) as { token?: string; error?: string };
    if (!tokenResponse.ok || !tokenData.token) {
      await startScriptedPracticeFallback(tokenData.error ?? "AI clinic voice provider unavailable.");
      return;
    }

    const vapi = new Vapi(tokenData.token, `${window.location.origin}/api/vapi/practice-proxy`);
    vapiPracticeRef.current = vapi;

    vapi.on("call-start", () => {
      if (practiceConnectTimeoutRef.current) clearTimeout(practiceConnectTimeoutRef.current);
      practiceConnectTimeoutRef.current = null;
      setCallState("connected");
      setMicTestPassed(true);
      setSpeakerTestPassed(true);
      setAssistantSpeakerEnabled(speakerEnabledRef.current);
      void applyPracticeAudioDevices(vapi);
      void persistCallSession({ status: "connected" });
      toast.success("Simulation connected — the AI clinic is on the line. Talk normally.");
      // Vapi kills web calls whose mic never delivers audio
      // ("assistant-did-not-receive-customer-audio"), so warn the founder early.
      lastMicAudioAtRef.current = 0;
      micSilenceWarnedRef.current = false;
      setTimeout(() => {
        if (vapiPracticeRef.current !== vapi || micSilenceWarnedRef.current) return;
        if (lastMicAudioAtRef.current === 0) {
          micSilenceWarnedRef.current = true;
          toast.error("The clinic can't hear you — no microphone audio is reaching the call.", {
            description: "Check the browser/macOS microphone permission and the selected input device, or the AI will hang up.",
            duration: 12000,
          });
        }
      }, 10000);
      // Speech-activity timeout: if Vapi connects but the AI clinic
      // never speaks (no transcript arrives), fall back to the scripted
      // practice mode so the user isn't stuck on "Waiting…" forever.
      setTimeout(() => {
        if (vapiPracticeRef.current !== vapi) return;
        const hasTranscript = transcriptRef.current.some((l) => !isCoachLine(l));
        if (!hasTranscript) {
          void vapi.stop();
          vapiPracticeRef.current = null;
          void startScriptedPracticeFallback("AI clinic didn't respond — switching to scripted mode.");
        }
      }, 8000);
    });
    vapi.on("local-volume-level", (volume) => {
      if (volume > 0.01) lastMicAudioAtRef.current = Date.now();
      setMicTestLevel(Math.min(100, Math.round(volume * 100)));
    });
    vapi.on("speech-start", () => setIsClinicSpeaking(true));
    vapi.on("speech-end", () => setIsClinicSpeaking(false));
    vapi.on("message", (message) => {
      if (message?.type !== "transcript" || message?.transcriptType !== "final" || !message.transcript) return;
      const speaker = message.role === "assistant" ? "Clinic" : "Jamil";
      const spokenText = message.transcript.trim();
      if (!spokenText) return;

      setTranscript((previous) => {
        const prevNonCoach = previous.filter((l) => !isCoachLine(l));
        const prior = prevNonCoach.at(-1);

        if (prior?.speaker === speaker && prior?.text === spokenText) return previous;

        const nowMs = Date.now();
        const priorTimeMs = prior ? Date.parse(prior.timestamp) : NaN;
        const shouldMerge =
          prior &&
          prior.speaker === speaker &&
          Number.isFinite(priorTimeMs) &&
          nowMs - priorTimeMs <= 2800;

        const nextLine: TranscriptLine = { speaker, text: spokenText, timestamp: new Date().toISOString() };
        const nextNonCoach = [...prevNonCoach];
        if (shouldMerge && prior) {
          nextNonCoach[nextNonCoach.length - 1] = {
            ...prior,
            text: `${prior.text} ${spokenText}`.replace(/\s+/g, " ").trim(),
            timestamp: nextLine.timestamp,
          };
        } else {
          nextNonCoach.push(nextLine);
        }

        if (speaker === "Clinic") {
          const lastText = nextNonCoach.at(-1)?.text ?? "";
          const isDigitFragment = /^[\d\s.,-]{1,16}$/.test(lastText.trim());
          const looksComplete =
            !isDigitFragment &&
            (/[?!.]\s*$/.test(lastText) ||
              lastText.length >= 20 ||
              /\b(free|fee|fees|cost|price|charge|yes|accept|patients|services|number|directory|listing|calling)\b/i.test(lastText));

          const nextWithCoach = upsertInlineCoachSuggestion(nextNonCoach, COACH_LISTENING_TEXT);
          if (looksComplete || isDigitFragment) queueCopilotRequest(nextWithCoach);
          return nextWithCoach;
        }

        // Jamil spoke — also trigger a copilot update so coaching
        // adjusts to what the operator actually said.
        queueCopilotRequest(nextNonCoach);
        return nextNonCoach;
      });
    });
    vapi.on("call-end", () => {
      if (practiceConnectTimeoutRef.current) clearTimeout(practiceConnectTimeoutRef.current);
      practiceConnectTimeoutRef.current = null;
      setIsClinicSpeaking(false);
      setMicTestLevel(0);
      if (callStateRef.current !== "ended") setCallState("ended");
      vapiPracticeRef.current = null;
    });
    vapi.on("error", async (error) => {
      if (practiceConnectTimeoutRef.current) clearTimeout(practiceConnectTimeoutRef.current);
      practiceConnectTimeoutRef.current = null;
      vapiPracticeRef.current = null;
      try { await vapi.stop(); } catch { /* ignore */ }
      const detail = (error as { errorMsg?: string; message?: string } | undefined);
      const reason = detail?.errorMsg || detail?.message || "AI clinic audio failed.";
      const micNeverHeard = lastMicAudioAtRef.current === 0 && callStateRef.current === "connected";
      await startScriptedPracticeFallback(
        micNeverHeard ? `${reason} No microphone audio reached the call — check mic permissions.` : reason,
      );
    });

    let practiceConnectionTimedOut = false;
    practiceConnectTimeoutRef.current = setTimeout(() => {
      if (callStateRef.current !== "configuring") return;
      practiceConnectionTimedOut = true;
      void vapi.stop();
      vapiPracticeRef.current = null;
      void startScriptedPracticeFallback("Simulation connect timed out.");
    }, 10000);

    try {
      const persona = PRACTICE_PERSONAS.find((p) => p.id === practicePersona);
      const call = await vapi.start("practice", {
        variableValues: {
          clinicName: activeClinic?.name ?? "the clinic",
          clinicCity: activeClinic?.city ?? "",
          clinicState: activeClinic?.state ?? "",
          personaName: persona?.name ?? "Martha",
          personaRole: persona?.role ?? "Receptionist",
          personaTrait: persona?.trait ?? "Helpful but busy",
          difficulty: practiceDifficulty,
        },
      } as Parameters<typeof vapi.start>[1]);
      setProviderCallId(call?.id ?? null);
    } catch {
      if (practiceConnectTimeoutRef.current) clearTimeout(practiceConnectTimeoutRef.current);
      practiceConnectTimeoutRef.current = null;
      vapiPracticeRef.current = null;
      if (!practiceConnectionTimedOut) {
        await startScriptedPracticeFallback("Could not start the AI clinic voice.");
      }
    }
  };

  const fallbackSpeechSynthesis = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsClinicSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === selectedVoiceName) || voices.find(v => v.lang.startsWith("en")) || voices[0];
    
    if (voice) utterance.voice = voice;
    utterance.volume = speakerEnabled ? 1.0 : 0.0;
    
    // Adjust speed by difficulty
    utterance.rate = practiceDifficulty === "beginner" ? 0.85 : practiceDifficulty === "advanced" ? 1.15 : 1.00;

    // Speaker Mode Auto-Pause to prevent feedback echo loops
    if (!isHeadphonesMode && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      isListeningRef.current = false;
      try { mediaRecorderRef.current.pause(); } catch (e) {}
    }

    utterance.onend = () => {
      setIsClinicSpeaking(false);
      if (!isHeadphonesMode && mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
        isListeningRef.current = true;
        try { mediaRecorderRef.current.resume(); } catch (e) {}
      }
    };
    utterance.onerror = () => {
      setIsClinicSpeaking(false);
      if (!isHeadphonesMode && mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
        isListeningRef.current = true;
        try { mediaRecorderRef.current.resume(); } catch (e) {}
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const speakPracticeText = async (text: string) => {
    if (!text) return;
    if (!speakerEnabledRef.current) {
      setIsClinicSpeaking(false);
      return;
    }
    setIsClinicSpeaking(true);

    // Speaker Mode Auto-Pause to prevent feedback echo loops
    if (!isHeadphonesMode && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      isListeningRef.current = false;
      try { mediaRecorderRef.current.pause(); } catch (e) {}
    }

    try {
      const response = await fetch("/api/copilot/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("Deepgram Aura TTS request failed.");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      // Reuse the element unlocked during the click gesture; a fresh Audio()
      // created seconds after the click gets blocked by the autoplay policy.
      const audio = practiceAudioRef.current ?? new Audio();
      practiceAudioRef.current = audio;
      audio.src = url;
      audio.volume = speakerEnabledRef.current ? 1 : 0;
      if (selectedSpeaker && typeof (audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId === "function") {
        try {
          await (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(selectedSpeaker);
        } catch {
          // keep default output
        }
      }

      audio.onended = () => {
        setIsClinicSpeaking(false);
        URL.revokeObjectURL(url);
        if (!isHeadphonesMode && mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
          isListeningRef.current = true;
          try { mediaRecorderRef.current.resume(); } catch (e) {}
        }
      };

      audio.onerror = () => {
        setIsClinicSpeaking(false);
        URL.revokeObjectURL(url);
        if (!isHeadphonesMode && mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
          isListeningRef.current = true;
          try { mediaRecorderRef.current.resume(); } catch (e) {}
        }
      };

      try {
        await audio.play();
      } catch (playError) {
        // Autoplay block: don't degrade to the robotic voice — ask for one tap
        // and replay the same natural-voice audio.
        console.warn("Practice TTS playback blocked, waiting for a user tap:", playError);
        toast.warning("Tap anywhere once to enable the clinic voice.", { duration: 8000 });
        window.addEventListener("pointerdown", () => {
          void audio.play().catch(() => fallbackSpeechSynthesis(text));
        }, { once: true });
      }
    } catch (err) {
      console.warn("Deepgram TTS failed, falling back to browser synthesis:", err);
      if (!ttsFallbackWarnedRef.current) {
        ttsFallbackWarnedRef.current = true;
        toast.warning("Natural clinic voice (Deepgram TTS) is unavailable — using the basic browser voice.", {
          description: err instanceof Error ? err.message : undefined,
          duration: 10000,
        });
      }
      fallbackSpeechSynthesis(text);
    }
  };

  const startSpeechRecognition = async () => {
    try {
      // 1. Get user media stream if not already active. Use an `ideal`
      // constraint so a stale saved device id degrades to the default mic
      // instead of throwing OverconstrainedError and killing recognition.
      let stream = micStreamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMic ? { deviceId: { ideal: selectedMic } } : true,
        });
        micStreamRef.current = stream;
      }

      // 2. Fetch temporary token from our API route
      const tokenRes = await fetch("/api/copilot/deepgram");
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenData.token) {
        throw new Error(tokenData.error || "Failed to fetch temporary Deepgram token.");
      }

      // 3. Initialize Deepgram WebSocket
      const queryParams = new URLSearchParams({
        model: "nova-2",
        smart_format: "true",
        filler_words: "true",
        endpointing: "300",
      });
      const wsUrl = `wss://api.deepgram.com/v1/listen?${queryParams.toString()}`;
      
      console.log("Connecting to Deepgram WebSocket...");
      const ws = new WebSocket(wsUrl, ["token", tokenData.token]);
      deepgramSocketRef.current = ws;

      ws.onopen = () => {
        console.log("Deepgram WebSocket connection established.");
        setSpeechRecognitionUnavailable(false);
        toast.info("Deepgram voice transcription link active.");
        
        // 4. Initialize MediaRecorder to stream raw audio in 250ms chunks
        let mimeType = "audio/webm";
        if (typeof MediaRecorder !== "undefined") {
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "audio/ogg";
          }
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ""; // Browser default fallback
          }

          const options = mimeType ? { mimeType } : undefined;
          const recorder = new MediaRecorder(stream!, options);
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              ws.send(event.data);
            }
          };

          recorder.start(250);
        }
      };

      ws.onmessage = (event) => {
        // Speaker Mode feedback loop prevention (ref, not state: this closure
        // is created once and would otherwise always see the initial value):
        if (isClinicSpeakingRef.current && !isHeadphonesMode) {
          return;
        }

        try {
          const data = JSON.parse(event.data);
          const transcriptText = data.channel?.alternatives?.[0]?.transcript;
          if (transcriptText && data.is_final) {
            const spokenText = transcriptText.trim();
            if (spokenText) {
              if (isPracticeMode) {
                handleUserSpeechInput(spokenText);
              } else {
                // Single-channel Deepgram captures the operator's mic —
                // tag as Jamil (not Clinic) so the copilot sees context.
                const nextLine: TranscriptLine = { speaker: "Jamil", text: spokenText, timestamp: new Date().toISOString() };
                setTranscript((previous) => {
                  const next = [...previous, nextLine];
                  queueCopilotRequest(next);
                  return next;
                });
              }
            }
          }
        } catch (e) {
          console.error("Error parsing Deepgram message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("Deepgram WebSocket error:", e);
      };

      ws.onclose = (event) => {
        console.log("Deepgram WebSocket closed:", event);
      };

    } catch (err: any) {
      console.error("Deepgram Speech initialization error:", err);
      isListeningRef.current = false;
      setSpeechRecognitionUnavailable(true);
      toast.warning("Deepgram connection failed. Please ensure mic permissions are enabled.");
    }
  };

  const startDeepgramStereoTranscription = async (call: any, micStream: MediaStream) => {
    try {
      // 1. Fetch Deepgram Token
      const dgTokenRes = await fetch("/api/copilot/deepgram");
      const dgTokenData = await dgTokenRes.json().catch(() => ({}));
      if (!dgTokenRes.ok || !dgTokenData.token) {
        throw new Error(dgTokenData.error || "Failed to fetch Deepgram token.");
      }

      // 2. Get remote clinic stream from Telnyx Call
      let remoteStream = call.remoteStream;
      if (!remoteStream) {
        const pc = call.peerConnection || call._peerConnection?.pc;
        if (pc && typeof pc.getReceivers === "function") {
          const audioTracks = pc.getReceivers()
            .map((r: any) => r.track)
            .filter((t: any) => t && t.kind === "audio");
          remoteStream = new MediaStream(audioTracks);
        }
      }

      await attachRemoteAudio(remoteStream);

      // 3. Web Audio stereo merger setup
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === "suspended") await audioCtx.resume();

      const micSource = audioCtx.createMediaStreamSource(micStream);
      const merger = audioCtx.createChannelMerger(2);
      micSource.connect(merger, 0, 0); // You (founder) mic → Left channel (0)

      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
        remoteSource.connect(merger, 0, 1); // Clinic → Right channel (1)
      } else {
        toast.warning("Clinic audio stream not available yet — transcription may be one-sided.");
      }

      const dest = audioCtx.createMediaStreamDestination();
      merger.connect(dest);
      const stereoStream = dest.stream;

      // Archival recording (mandatory for official live calls) — parallel to Deepgram stream
      if (isLiveMode) startArchivalRecording(stereoStream);

      // 4. Connect Deepgram WebSocket with multichannel=true
      const queryParams = new URLSearchParams({
        model: "nova-2",
        smart_format: "true",
        filler_words: "true",
        channels: "2",
        multichannel: "true",
        endpointing: "300",
      });
      const wsUrl = `wss://api.deepgram.com/v1/listen?${queryParams.toString()}`;

      console.log("Connecting to Deepgram WebSocket (Stereo mode)...");
      const ws = new WebSocket(wsUrl, ["token", dgTokenData.token]);
      deepgramSocketRef.current = ws;

      ws.onopen = () => {
        console.log("Deepgram WebSocket stereo connection active.");
        setSpeechRecognitionUnavailable(false);

        let mimeType = "audio/webm";
        if (typeof MediaRecorder !== "undefined") {
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "audio/ogg";
          }
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "";
          }

          const options = mimeType ? { mimeType } : undefined;
          const recorder = new MediaRecorder(stereoStream, options);
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              ws.send(event.data);
            }
          };

          recorder.start(250);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const channelData = data.channel;
          const transcriptText = channelData?.alternatives?.[0]?.transcript;
          if (!transcriptText || !data.is_final) return;

          const spokenText = transcriptText.trim();
          if (!spokenText) return;

          // Deepgram multichannel: channel_index is usually [0] or [1]
          const rawIndex = data.channel_index;
          const channelIndex = Array.isArray(rawIndex) ? Number(rawIndex[0] ?? 0) : Number(rawIndex ?? 0);
          const speaker = channelIndex === 0 ? "Jamil" : "Clinic";
          const nextLine: TranscriptLine = { speaker, text: spokenText, timestamp: new Date().toISOString() };

          setTranscript((prev) => {
            // Transcript may already contain a coach card; for utterance merging we only work with non-coach lines.
            const prevNonCoach = prev.filter((l) => !isCoachLine(l));
            const prior = prevNonCoach.at(-1);

            // De-dup identical consecutive fragments.
            if (prior?.speaker === speaker && prior?.text === spokenText) return prev;

            const nowMs = Date.now();
            const priorTimeMs = prior ? Date.parse(prior.timestamp) : NaN;
            const shouldMerge =
              prior &&
              prior.speaker === speaker &&
              Number.isFinite(priorTimeMs) &&
              nowMs - priorTimeMs <= 2800;

            const nextNonCoach = [...prevNonCoach];
            if (shouldMerge && prior) {
              const mergedText = `${prior.text} ${spokenText}`.replace(/\s+/g, " ").trim();
              nextNonCoach[nextNonCoach.length - 1] = {
                ...prior,
                text: mergedText,
                timestamp: nextLine.timestamp,
              };
            } else {
              nextNonCoach.push(nextLine);
            }

            // Only clinic turns should drive copilot suggestions.
            if (speaker === "Clinic") {
              const lastText = nextNonCoach.at(-1)?.text ?? "";
              const isDigitFragment = /^[\d\s.,-]{1,16}$/.test(lastText.trim());
              const looksComplete =
                !isDigitFragment &&
                (/[?!.]\s*$/.test(lastText) ||
                  lastText.length >= 20 ||
                  /\b(free|fee|fees|cost|price|charge|yes|accept|patients|services|number)\b/i.test(lastText));

              // Keep one active suggestion card at the end; update it after the clinic finishes (debounced).
              const nextWithCoach = upsertInlineCoachSuggestion(nextNonCoach, COACH_LISTENING_TEXT);
              if (looksComplete || isDigitFragment) queueCopilotRequest(nextWithCoach);
              return nextWithCoach;
            }

            return nextNonCoach;
          });
        } catch (e) {
          console.error("Error parsing Deepgram stereo transcript:", e);
        }
      };

      ws.onerror = (e) => console.error("Deepgram WebSocket error:", e);
      ws.onclose = () => console.log("Deepgram WebSocket closed.");

    } catch (err: any) {
      console.error("Deepgram stereo transcription setup failed:", err);
      toast.warning("Deepgram transcription failed. You can still talk — type clinic replies if needed.");
      setSpeechRecognitionUnavailable(true);
    }
  };

  const handleUserSpeechInput = (text: string) => {
    if (!text) return;

    // Barge-in: Mute the clinic immediately if Jamil interrupts
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsClinicSpeaking(false);
      setPracticeInterruptionCount((c) => c + 1);
      setInterruptionWarning(true);
      toast.warning("Interruption warning: Let the clinic speak.");
      setTimeout(() => setInterruptionWarning(false), 3000);
    }

    // Also stop Deepgram TTS playback if playing
    if (practiceAudioRef.current && !practiceAudioRef.current.paused) {
      try { practiceAudioRef.current.pause(); } catch { /* ignore */ }
      setIsClinicSpeaking(false);
    }

    // Accumulate speech fragments so the user can finish their full
    // thought before the scripted clinic responds.  Deepgram sends
    // is_final fragments every ~300ms of silence; merging them here
    // prevents each fragment from advancing the dialogue tree.
    userSpeechAccumRef.current = userSpeechAccumRef.current
      ? `${userSpeechAccumRef.current} ${text}`.replace(/\s+/g, " ").trim()
      : text;

    // Push the fragment to the transcript immediately for visual feedback,
    // but merge with the previous Jamil line if one exists.
    setTranscript((prev) => {
      const last = prev.at(-1);
      if (last && last.speaker === "Jamil" && !isCoachLine(last)) {
        const merged = [...prev];
        merged[merged.length - 1] = {
          ...last,
          text: `${last.text} ${text}`.replace(/\s+/g, " ").trim(),
          timestamp: new Date().toISOString(),
        };
        return merged;
      }
      return [...prev, { speaker: "Jamil", text, timestamp: new Date().toISOString() }];
    });

    // Debounce: wait 2 seconds after the last fragment before
    // advancing the scenario so the user can finish speaking.
    if (userSpeechDebounceRef.current) clearTimeout(userSpeechDebounceRef.current);
    userSpeechDebounceRef.current = setTimeout(() => {
      const fullText = userSpeechAccumRef.current;
      userSpeechAccumRef.current = "";
      if (!fullText) return;

      // Trigger next dialogue turn from the scenario Dialogue Tree
      const scenario = PRACTICE_SCENARIOS.find((s) => s.id === practiceScenario) || PRACTICE_SCENARIOS[0];
      const nextStepIdx = scenarioStepIndex + 1;

      if (nextStepIdx < scenario.dialogueTree.length) {
        const nextTurnObj = scenario.dialogueTree[nextStepIdx];
        setScenarioStepIndex(nextStepIdx);

        // Simulate a thinking delay before clinic responds
        setTimeout(() => {
          setTranscript((prev) => {
            const clinicLine: TranscriptLine = { speaker: "Clinic", text: nextTurnObj.clinicSpeech, timestamp: new Date().toISOString() };
            const next = [...prev, clinicLine];
            queueCopilotRequest(next);
            return next;
          });
          speakPracticeText(nextTurnObj.clinicSpeech);
        }, 1200);
      } else {
        // Out of script turns: wrap up the call
        setTimeout(() => {
          const wrapUpText = "Okay Jamil, that sounds good. We are all set here. Goodbye!";
          const wrapUpCoach = "Outreach target met. Click 'Hang Up' to finalize.";
          setTranscript((prev) =>
            upsertInlineCoachSuggestion(
              [...prev, { speaker: "Clinic", text: wrapUpText, timestamp: new Date().toISOString() }],
              wrapUpCoach,
            ),
          );
          speakPracticeText(wrapUpText);
          setCopilotSuggestion(wrapUpCoach);
          setCopilotQuestion(null);
        }, 1500);
      }
    }, 2000);
  };

  // Copilot request debouncing & stale-response protection
  const copilotRequestSeqRef = useRef(0);
  const transcriptRevisionRef = useRef(0);
  const copilotAbortControllerRef = useRef<AbortController | null>(null);
  const copilotDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCopilotConversationRef = useRef<TranscriptLine[] | null>(null);
  const copilotSuggestionHistoryRef = useRef<string[]>([]);
  const copilotSuggestionsLogRef = useRef<Array<{ suggested_response: string; was_used?: boolean }>>([]);

  // Recording & consent (mandatory for live official calls)
  type LiveRecordingStatus =
    | "not_started" | "initializing" | "active" | "paused" | "failed" | "audio_unavailable"
    | "consent_required" | "uploading" | "uploaded" | "local_backup_saved"
    | "cloud_save_failed" | "local_save_failed" | "finalized";
  const [recordingStatus, setRecordingStatus] = useState<LiveRecordingStatus>("not_started");
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>("pending");
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [consentScript, setConsentScript] = useState(DEFAULT_CONSENT_SCRIPT);
  const [consentJurisdiction, setConsentJurisdiction] = useState("unknown");
  const [consentRequiresExplicit, setConsentRequiresExplicit] = useState(false);
  const [recordingBlocked, setRecordingBlocked] = useState(false);
  const callIdempotencyKeyRef = useRef<string | null>(null);
  const archivalRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const stereoStreamRef = useRef<MediaStream | null>(null);
  const recordingMimeTypeRef = useRef("audio/webm");

  function queueCopilotRequest(conversation: TranscriptLine[]) {
    pendingCopilotConversationRef.current = conversation;
    if (copilotDebounceTimerRef.current) clearTimeout(copilotDebounceTimerRef.current);

    const spoken = utteranceTranscript(conversation);
    const lastClinic = spoken.filter((l) => l.speaker === "Clinic").at(-1)?.text ?? "";
    // Digit / fragment turns need longer wait so phone numbers can merge before we coach.
    const looksLikeFragment = /^[\d\s.,-]{1,12}$/.test(lastClinic.trim()) || lastClinic.trim().split(/\s+/).length <= 3;
    const delay = looksLikeFragment ? 2200 : 1100;

    copilotDebounceTimerRef.current = setTimeout(() => {
      const convo = pendingCopilotConversationRef.current;
      if (!convo) return;
      void requestManualCopilot(convo);
    }, delay);
  }

  const requestManualCopilot = async (conversation: TranscriptLine[]) => {
    if (!activeClinic) return;

    const requestId = (copilotRequestSeqRef.current += 1);
    const transcriptRevision = (transcriptRevisionRef.current += 1);
    copilotAbortControllerRef.current?.abort();
    const controller = new AbortController();
    copilotAbortControllerRef.current = controller;

    setCopilotLoading(true);
    setTranscript((prev) => upsertInlineCoachSuggestion(prev, COACH_DRAFTING_TEXT));

    try {
      const spokenOnly = utteranceTranscript(conversation);
      const clinicTurns = spokenOnly.filter((l) => l.speaker === "Clinic");
      const recentClinicBundle = clinicTurns.slice(-5).map((l) => l.text).join(" ").replace(/\s+/g, " ").trim();
      const lastClinicText = clinicTurns.at(-1)?.text ?? "";
      const transcriptNotes = spokenOnly.slice(-16).map((line) => `${line.speaker}: ${line.text}`).join("\n");
      const previousSuggestions = copilotSuggestionHistoryRef.current.slice(-3);

      const deterministicPreview = suggestFromTranscriptContext({
        transcript: transcriptNotes,
        latestClinicUtterance: recentClinicBundle || lastClinicText,
        previousSuggestions,
      });
      if (deterministicPreview.policy.is_direct_question || deterministicPreview.intent !== "unknown") {
        setCopilotSource("deterministic");
        setCopilotSuggestion(deterministicPreview.suggestion);
        setCopilotShorter(deterministicPreview.shorter);
        setCopilotDoNotSay(deterministicPreview.doNotSay);
        setCopilotFreezeRecovery(deterministicPreview.freezeRecovery);
        setCopilotStructuredReason(deterministicPreview.reason);
        setCopilotQuestion(deterministicPreview.askNext);
        setActiveStage(intentToCallStage(deterministicPreview.intent));
        setTranscript((prev) => upsertInlineCoachSuggestion(prev, deterministicPreview.suggestion));
      }

      const facts = extractClinicFacts(transcriptNotes);
      setQualification((prev) => {
        const next = { ...prev };
        if (facts.phone) next.q3 = true;
        if (facts.services) next.q5 = true;
        if (facts.acceptingNewPatients !== undefined) next.q7 = true;
        if (facts.permissionGranted) next.q1 = true;
        return next;
      });

      const qualNow = {
        ...qualification,
        ...(facts.phone ? { q3: true } : {}),
        ...(facts.services ? { q5: true } : {}),
        ...(facts.acceptingNewPatients !== undefined ? { q7: true } : {}),
        ...(facts.permissionGranted ? { q1: true } : {}),
      };

      const response = await fetch("/api/copilot/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          clinicName: activeClinic.name,
          clinicContext: `${activeClinic.city ?? ""}, ${activeClinic.state ?? ""}. Services: ${(activeClinic.services ?? []).join(", ")}`,
          stage: activeStage,
          transcript: transcriptNotes,
          question: recentClinicBundle || lastClinicText,
          qualificationSummary: QUALIFICATION_CHECKLIST.map((q) => `${q.id}:${qualNow[q.id] ? "YES" : "NO"}`).join(", "),
          missingQualification: QUALIFICATION_CHECKLIST.filter((q) => !qualNow[q.id]).map((q) => q.label).join("; "),
          detectedObjections: expandedObjection ? expandedObjection : objectionGuidance ?? "",
          previousSuggestions: previousSuggestions.join("\n"),
          requestSeq: requestId,
          transcriptRevision,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Copilot failed.");
      const suggestion = typeof payload.suggestion === "string" ? payload.suggestion : "";

      if (requestId !== copilotRequestSeqRef.current) return;
      if (typeof payload.transcriptRevision === "number" && payload.transcriptRevision < transcriptRevisionRef.current) return;

      setCopilotSuggestion(suggestion);
      setCopilotSource(
        payload.source === "deterministic" || payload.source === "deterministic_fallback"
          ? "deterministic"
          : payload.source === "field_guide"
            ? "field_guide"
            : "ai",
      );
      if (typeof payload.shorter === "string") setCopilotShorter(payload.shorter);
      if (Array.isArray(payload.doNotSay)) setCopilotDoNotSay(payload.doNotSay);
      if (typeof payload.freezeRecovery === "string") setCopilotFreezeRecovery(payload.freezeRecovery);
      if (typeof payload.reason === "string") setCopilotStructuredReason(payload.reason);
      if (typeof payload.askNext === "string" || payload.askNext === null) setCopilotQuestion(payload.askNext ?? null);
      if (payload.structured?.call_stage) setActiveStage(payload.structured.call_stage);
      if (payload.structured) {
        setCopilotStructuredReason(payload.structured.reason ?? null);
        setCopilotNextAction(payload.structured.suggested_next_action ?? null);
        setCopilotGroundingStatus(payload.structured.grounding_status ?? null);
        setCopilotKnowledgeSources(Array.isArray(payload.structured.knowledge_sources) ? payload.structured.knowledge_sources : []);
        lastRetrievedKnowledgeRef.current = payload.retrieval ?? null;
      }
      if (suggestion) {
        copilotSuggestionHistoryRef.current = [...copilotSuggestionHistoryRef.current.slice(-3), suggestion];
        copilotSuggestionsLogRef.current = [...copilotSuggestionsLogRef.current, { suggested_response: suggestion }];
        setTranscript((prev) => upsertInlineCoachSuggestion(prev, suggestion));
      }
    } catch (error) {
      if (requestId !== copilotRequestSeqRef.current) return;

      const spokenOnly = utteranceTranscript(conversation);
      const transcriptNotes = spokenOnly.slice(-16).map((line) => `${line.speaker}: ${line.text}`).join("\n");
      const fallbackResult = suggestFromTranscriptContext({
        transcript: transcriptNotes,
        previousSuggestions: copilotSuggestionHistoryRef.current,
      });
      setCopilotSuggestion(fallbackResult.suggestion);
      setCopilotShorter(fallbackResult.shorter);
      setCopilotDoNotSay(fallbackResult.doNotSay);
      setCopilotFreezeRecovery(fallbackResult.freezeRecovery);
      setCopilotStructuredReason(fallbackResult.reason);
      setCopilotQuestion(fallbackResult.askNext);
      setCopilotSource("field_guide");
      copilotSuggestionHistoryRef.current = [...copilotSuggestionHistoryRef.current.slice(-3), fallbackResult.suggestion];
      setTranscript((prev) => upsertInlineCoachSuggestion(prev, fallbackResult.suggestion));
      toast.info("Using the local field guide while the AI coaching provider is unavailable.");
    } finally {
      if (requestId === copilotRequestSeqRef.current) setCopilotLoading(false);
    }
  };

  const submitCopilotFeedback = async (rating: string) => {
    if (!copilotSuggestion) return;
    await fetch("/api/copilot/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callSessionId: callSessionId ?? undefined,
        rating,
        originalSuggestion: copilotSuggestion,
        transcriptContext: utteranceTranscript(transcriptRef.current).slice(-8).map((l) => `${l.speaker}: ${l.text}`).join("\n"),
        retrievedKnowledge: lastRetrievedKnowledgeRef.current,
        callStage: activeStage,
        objectionType: expandedObjection ?? objectionGuidance ?? undefined,
      }),
    }).catch(() => undefined);
    toast.success("Feedback saved — thank you.");
  };

  const handleManualTranscriptInput = (text: string) => {
    if (!text) return;
    const nextLine: TranscriptLine = { speaker: "Clinic", text, timestamp: new Date().toISOString() };
    setTranscript((previous) => {
      const next = [...previous, nextLine];
      queueCopilotRequest(next);
      return next;
    });
  };

  const updateCopilotSuggestions = (stepIdx: number, scenario: ScenarioConfig) => {
    const currentStep = scenario.dialogueTree[stepIdx];
    if (!currentStep) return;

    setActiveStage(currentStep.stage);
    setCopilotSuggestion(currentStep.copilotSuggestion);
    setTranscript((prev) => upsertInlineCoachSuggestion(prev, currentStep.copilotSuggestion));
    setCopilotQuestion(currentStep.copilotQuestion);
    setObjectionGuidance(currentStep.objectionGuidance ?? null);
    setClinicFacts(currentStep.facts ?? []);
    setCopilotWarning(currentStep.warning ?? null);
  };

  const stopSpeechRecognition = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    mediaRecorderRef.current = null;

    if (deepgramSocketRef.current) {
      try { deepgramSocketRef.current.close(); } catch (e) {}
      deepgramSocketRef.current = null;
    }

    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      micStreamRef.current = null;
    }

    if (audioCtxRef.current) {
      try { void audioCtxRef.current.close(); } catch (e) {}
      audioCtxRef.current = null;
    }

    if (practiceAudioRef.current) {
      try { practiceAudioRef.current.pause(); } catch { /* ignore */ }
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsClinicSpeaking(false);
  };

  // Helpers
  async function persistCallSession(data: Record<string, unknown>) {
    if (!callSessionId) return;
    const payload: Record<string, unknown> = { ...data };
    if (payload.transcript !== undefined && typeof payload.transcript !== "string") {
      payload.transcript = JSON.stringify(payload.transcript);
    }
    if (payload.structuredData !== undefined && typeof payload.structuredData !== "string") {
      payload.structuredData = JSON.stringify(payload.structuredData);
    }
    if (payload.aiSuggestions !== undefined && typeof payload.aiSuggestions !== "string") {
      payload.aiSuggestions = JSON.stringify(payload.aiSuggestions);
    }
    await fetch(`/api/calls/${callSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  }

  async function createCallSession(environment: "live" | "practice") {
    if (!activeClinic) return null;
    const idempotencyKey = callIdempotencyKeyRef.current ?? `${activeClinic.id}-${Date.now()}`;
    callIdempotencyKeyRef.current = idempotencyKey;
    try {
      const response = await fetch("/api/telephony/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: activeClinic.id, callEnvironment: environment, idempotencyKey }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.callSessionId) {
        console.warn("Could not create call session:", payload.error);
        return null;
      }
      setCallSessionId(payload.callSessionId);
      return payload.callSessionId as string;
    } catch (error) {
      console.warn("Call session create failed:", error);
      return null;
    }
  }

  async function recordConsentEvent(status: ConsentStatus, wording?: string, sessionId?: string) {
    const sid = sessionId ?? callSessionId;
    if (!sid) return;
    setConsentStatus(status);
    await fetch(`/api/calls/${sid}/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consentStatus: status,
        jurisdiction: consentJurisdiction,
        consentScript,
        consentWording: wording,
      }),
    }).catch(() => undefined);
  }

  function startArchivalRecording(stereoStream: MediaStream) {
    try {
      setRecordingStatus("initializing");
      recordingChunksRef.current = [];
      stereoStreamRef.current = stereoStream;
      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/ogg";
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "";
      }
      recordingMimeTypeRef.current = mimeType || "audio/webm";
      const recorder = new MediaRecorder(stereoStream, mimeType ? { mimeType } : undefined);
      archivalRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setRecordingStatus("failed");
        setRecordingBlocked(true);
        toast.error("Call recording failed to start. Official calls require recording.");
      };
      recorder.onstart = () => setRecordingStatus("active");
      recorder.start(1000);
    } catch {
      setRecordingStatus("failed");
      setRecordingBlocked(true);
      toast.error("Could not initialize call recording.");
    }
  }

  function stopArchivalRecording() {
    const recorder = archivalRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return Promise.resolve<Blob | null>(null);
    return new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const blob = recordingChunksRef.current.length
          ? new Blob(recordingChunksRef.current, { type: recordingMimeTypeRef.current })
          : null;
        resolve(blob);
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }

  async function finalizeCallRecordingAndAnalysis() {
    if (!callSessionId || !isLiveMode) return;
    setRecordingStatus("uploading");
    const audioBlob = await stopArchivalRecording();
    const finalTranscript = utteranceTranscript(transcriptRef.current);
    let analysisPayload: Record<string, unknown> | null = null;
    let nextRecordingStatus: LiveRecordingStatus = "finalized";

    if (audioBlob && audioBlob.size > 0) {
      const form = new FormData();
      form.append("audio", audioBlob, "call-recording.webm");
      form.append("idempotencyKey", callIdempotencyKeyRef.current ?? `${callSessionId}-primary`);
      form.append("fileType", recordingMimeTypeRef.current);
      form.append("audioDurationSec", String(callDurationRef.current));
      form.append("consentStatus", consentStatus);

      const uploadRes = await fetch(`/api/calls/${callSessionId}/recording`, { method: "POST", body: form });
      nextRecordingStatus = uploadRes.ok ? "uploaded" : "cloud_save_failed";
      if (!uploadRes.ok) toast.error("Cloud recording upload failed — local backup will be attempted.");

      const backupForm = new FormData();
      backupForm.append("audio", audioBlob, "audio.webm");
      backupForm.append("metadata", JSON.stringify({
        transcript: finalTranscript,
        consentStatus,
        cloudUploadStatus: uploadRes.ok ? "uploaded" : "cloud_save_failed",
        metadata: { clinicId: activeClinic?.id, durationSec: callDurationRef.current },
      }));
      const backupRes = await fetch(`/api/calls/${callSessionId}/local-backup`, { method: "POST", body: backupForm });
      if (backupRes.ok && uploadRes.ok) nextRecordingStatus = "local_backup_saved";
      else if (!backupRes.ok && !uploadRes.ok) nextRecordingStatus = "local_save_failed";
    } else {
      nextRecordingStatus = "audio_unavailable";
      toast.error("No audio captured for this call.");
    }

    setRecordingStatus(nextRecordingStatus);

    const analyzeRes = await fetch(`/api/calls/${callSessionId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: finalTranscript,
        durationSec: callDurationRef.current,
        consentStatus,
        recordingStatus: nextRecordingStatus,
        qualification,
        copilotSuggestions: copilotSuggestionsLogRef.current,
      }),
    });
    if (analyzeRes.ok) {
      const analyzed = await analyzeRes.json().catch(() => ({}));
      analysisPayload = analyzed.analysis ?? null;
      if (analysisPayload) {
        setPostCallSummary({
          whatHappened: String((analysisPayload as { summary?: string }).summary ?? ""),
          objections: ((analysisPayload as { objectionsRaised?: string[] }).objectionsRaised ?? []).join(", "),
          commitments: String((analysisPayload as { followUpAction?: string }).followUpAction ?? ""),
          sentiment: String((analysisPayload as { clinicInterestLevel?: string }).clinicInterestLevel ?? "unknown"),
          nextSteps: String((analysisPayload as { followUpAction?: string }).followUpAction ?? ""),
          followUpMessage: "",
        });
      }
      setRecordingStatus("finalized");
    }

    await persistCallSession({
      status: "ended",
      structuredData: {
        consentStatus,
        recordingStatus: "finalized",
        postCallAnalysis: analysisPayload,
        qualification,
      },
    });
  }

  function openConsentGateForLiveCall() {
    if (!activeClinic?.primaryPhone) {
      toast.error("Selected clinic has no phone number.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      toast.error("This browser cannot record calls. Use Chrome or Edge for official calls.");
      setRecordingBlocked(true);
      return;
    }
    const { requiresExplicitConsent, jurisdiction } = inferConsentRequirement(activeClinic.state);
    setConsentJurisdiction(jurisdiction);
    setConsentRequiresExplicit(requiresExplicitConsent);
    setConsentScript(DEFAULT_CONSENT_SCRIPT);
    setConsentStatus(requiresExplicitConsent ? "pending" : "not_required");
    setConsentModalOpen(true);
  }

  async function confirmConsentAndStartCall(verbalConsent: boolean) {
    if (consentRequiresExplicit && !verbalConsent) {
      setConsentStatus("declined");
      toast.error("Recording consent is required for official clinic calls in this jurisdiction.");
      return;
    }
    setConsentModalOpen(false);
    const status: ConsentStatus = consentRequiresExplicit
      ? "verbal_consent_obtained"
      : "not_required";
    setConsentStatus(status);
    callIdempotencyKeyRef.current = `${activeClinic?.id}-${Date.now()}`;
    await startCall(status);
  }

  function stopRemoteAudio() {
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.remove();
      } catch {
        // ignore cleanup errors
      }
      remoteAudioRef.current = null;
    }
  }

  async function attachRemoteAudio(stream: MediaStream | null | undefined) {
    if (!stream || stream.getAudioTracks().length === 0) return;
    stopRemoteAudio();
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");
    audio.srcObject = stream;
    audio.muted = !speakerEnabledRef.current;
    if (selectedSpeaker && typeof (audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId === "function") {
      try {
        await (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(selectedSpeaker);
      } catch {
        // Browser may deny sink selection; keep default output.
      }
    }
    document.body.appendChild(audio);
    remoteAudioRef.current = audio;
    try {
      await audio.play();
    } catch (error) {
      console.warn("Remote clinic audio playback blocked:", error);
      toast.warning("Click Speaker once if you cannot hear the clinic.");
    }
  }

  function setAssistantSpeakerEnabled(enabled: boolean) {
    if (remoteAudioRef.current) remoteAudioRef.current.muted = !enabled;
    document.querySelectorAll("audio[data-participant-id]").forEach((node) => {
      (node as HTMLAudioElement).muted = !enabled;
    });
    if (vapiPracticeRef.current) {
      try {
        vapiPracticeRef.current.send({
          type: "control",
          control: enabled ? "unmute-assistant" : "mute-assistant",
        });
      } catch {
        // ignore control errors
      }
    }
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
    if (vapiPracticeRef.current) {
      void vapiPracticeRef.current.stop();
      vapiPracticeRef.current = null;
    }
    if (practiceConnectTimeoutRef.current) {
      clearTimeout(practiceConnectTimeoutRef.current);
      practiceConnectTimeoutRef.current = null;
    }
    if (telnyxCallRef.current) {
      try { telnyxCallRef.current.hangup(); } catch (e) {}
      telnyxCallRef.current = null;
    }
    stopRemoteAudio();
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
    callIdempotencyKeyRef.current = null;
    archivalRecorderRef.current = null;
    recordingChunksRef.current = [];
    stereoStreamRef.current = null;
    setRecordingStatus("not_started");
    setConsentStatus("pending");
    setRecordingBlocked(false);
    copilotSuggestionsLogRef.current = [];
    setResearch(null);
    setTranscript([]);
    setPostCallSummary(null);
    setActiveStage("intro");
    setCopilotSuggestion("Start a call to receive private, suggested talk tracks.");
    setCopilotSource("opening");
    setCopilotQuestion(null);
    setObjectionGuidance(null);
    setClinicFacts([]);
    setCopilotWarning(null);
    setCopilotNextAction(null);
    setSpeakingPace("Good (130 WPM)");
    setInterruptionWarning(false);
    setSpeakingListeningRatio("50:50");
    setCallQualityScore(0);
    setAiCoachingFeedback(null);
    setScenarioStepIndex(-1);
    setPracticeResponse("");
    setSpeechRecognitionUnavailable(false);
    setPracticeInterruptionCount(0);
    stopSpeechRecognition();
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach((track) => track.stop());
      testStreamRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setMicTestLevel(0);
    if (userSpeechDebounceRef.current) {
      clearTimeout(userSpeechDebounceRef.current);
      userSpeechDebounceRef.current = null;
    }
    userSpeechAccumRef.current = "";
  }

  function endCall() {
    // 1. Disconnect Telnyx VoIP call
    if (telnyxCallRef.current) {
      try { telnyxCallRef.current.hangup(); } catch (e) {}
      telnyxCallRef.current = null;
    }
    if (telnyxClientRef.current) {
      try { telnyxClientRef.current.disconnect(); } catch (e) {}
      telnyxClientRef.current = null;
    }
    stopRemoteAudio();

    if (vapiPracticeRef.current) {
      void vapiPracticeRef.current.stop();
      vapiPracticeRef.current = null;
    }

    if (practiceConnectTimeoutRef.current) clearTimeout(practiceConnectTimeoutRef.current);
    practiceConnectTimeoutRef.current = null;

    setCallState("ended");
    stopSpeechRecognition();
    if (timerRef.current) clearInterval(timerRef.current);

    const finalTranscript = transcriptRef.current;
    void persistCallSession({
      status: "ended",
      endedAt: new Date().toISOString(),
      durationSec: callDurationRef.current,
      transcript: finalTranscript,
      structuredData: {
        isPractice: isPracticeMode,
        callEnvironment: isPracticeMode ? "practice" : "live",
        practiceScenario,
        practicePersona,
        practiceDifficulty,
        callQualityScore,
        speakingListeningRatio,
        interruptionCount: practiceInterruptionCount,
        transcript: finalTranscript,
        consentStatus,
        recordingStatus,
      },
    });
    if (isLiveMode) void finalizeCallRecordingAndAnalysis();
    toast.info(`Session ended · ${formatDuration(callDurationRef.current)}`);
  }

  function toggleMute() {
    setMuted((m) => !m);
    if (vapiPracticeRef.current) {
      vapiPracticeRef.current.setMuted(!muted);
    } else if (telnyxCallRef.current) {
      try {
        if (muted) {
          telnyxCallRef.current.unmuteAudio();
        } else {
          telnyxCallRef.current.muteAudio();
        }
      } catch (e) {}
    } else if (mediaRecorderRef.current) {
      if (!muted) {
        try { mediaRecorderRef.current.pause(); } catch (e) {}
      } else {
        try { mediaRecorderRef.current.resume(); } catch (e) {}
      }
    }
    toast.info(muted ? "Microphone active" : "Microphone muted");
  }

  function toggleSpeaker() {
    const next = !speakerEnabled;
    setSpeakerEnabled(next);
    setAssistantSpeakerEnabled(next);
    toast.info(next ? "Clinic speaker on" : "Clinic speaker muted");
  }

  function toggleHold() {
    if (callState === "connected") {
      if (telnyxCallRef.current) {
        try { telnyxCallRef.current.hold(); } catch (e) {}
      }
      setCallState("on_hold");
      setOnHold(true);
      toast.info("Session on hold");
    } else if (callState === "on_hold") {
      if (telnyxCallRef.current) {
        try { telnyxCallRef.current.unhold(); } catch (e) {}
      }
      setCallState("connected");
      setOnHold(false);
      toast.info("Session resumed");
    }
  }

  async function startCall(initialConsent: ConsentStatus = "not_required") {
    if (startingCallRef.current || (callState !== "idle" && callState !== "ended" && callState !== "failed" && callState !== "provider_unavailable")) return;
    if (!activeClinic?.primaryPhone) {
      toast.error("Selected clinic has no phone number.");
      return;
    }

    resetCallState();
    startingCallRef.current = true;
    setCallState("configuring");
    setTranscript([]);
    setSpeechRecognitionUnavailable(false);
    setCopilotSuggestion("Hi — this is Jamil with Novalyte AI. I'm calling to ask permission to include your clinic in our free men's health directory. Do you have about two minutes?");
    setCopilotShorter(openingLine().shorter);
    setCopilotDoNotSay(openingLine().doNotSay);
    setCopilotFreezeRecovery(openingLine().freezeRecovery);
    setCopilotStructuredReason(openingLine().reason);
    setCopilotSource("opening");
    setCopilotSource("opening");
    setCopilotQuestion("Confirm you reached the person who manages the clinic listing.");
    setActiveStage("intro");

    try {
      const sessionId = await createCallSession("live");
      if (sessionId) {
        setConsentStatus(initialConsent);
        await recordConsentEvent(initialConsent, consentScript, sessionId);
      }

      // 1. Capture user microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      });
      micStreamRef.current = stream;
      startMicVisualizer(stream);
      setMicTestPassed(true);
      isListeningRef.current = true;

      // 2. Fetch Telnyx WebRTC JWT Token — fail loud, no fake softphone
      const tokenRes = await fetch("/api/telephony/token");
      const tokenData = await tokenRes.json().catch(() => ({})) as { token?: string; callerNumber?: string; error?: string };

      if (!tokenRes.ok || !tokenData.token || !tokenData.callerNumber) {
        stopSpeechRecognition();
        setCallState("provider_unavailable");
        toast.error(tokenData.error || "Telnyx softphone is not configured. Fix TELNYX_* env vars and retry.");
        void persistCallSession({
          status: "provider_unavailable",
          failureCode: "TELNYX_CONFIGURATION_MISSING",
          failureMessage: tokenData.error || "Telnyx token unavailable",
          endedAt: new Date().toISOString(),
        });
        return;
      }

      // 3. Initialize TelnyxRTC client
      if (telnyxClientRef.current) {
        try { telnyxClientRef.current.disconnect(); } catch (e) {}
        telnyxClientRef.current = null;
      }

      const { TelnyxRTC } = await import("@telnyx/webrtc");
      const client = new TelnyxRTC({ login_token: tokenData.token });
      telnyxClientRef.current = client;

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Telnyx softphone registration timed out.")), 20000);
        client.on("telnyx.ready", () => {
          window.clearTimeout(timeout);
          toast.success("Telnyx softphone registered.");
          resolve();
        });
        client.on("telnyx.error", (err: any) => {
          window.clearTimeout(timeout);
          reject(new Error(err?.message || "Telnyx line failed"));
        });
        client.connect();
      });

      // 4. Dial outbound clinic PSTN number
      const call = client.newCall({
        destinationNumber: activeClinic.primaryPhone,
        callerNumber: tokenData.callerNumber,
      }) as any;
      telnyxCallRef.current = call;
      setCallState("dialing");
      void persistCallSession({ status: "dialing" });

      call.on("ringing", () => {
        setCallState("ringing");
        void persistCallSession({ status: "ringing" });
      });

      call.on("active", () => {
        setCallState("connected");
        void persistCallSession({ status: "connected" });
        toast.success("Live softphone connected — AI is coaching silently.");
        void startDeepgramStereoTranscription(call, stream);
      });

      call.on("hangup", () => {
        toast.info("Call disconnected.");
        stopSpeechRecognition();
        stopRemoteAudio();
        setCallState("ended");
      });

      call.on("error", (err: any) => {
        console.error("Telnyx Call error:", err);
        toast.error(`Call error: ${err.message || "Line issue"}`);
        stopSpeechRecognition();
        stopRemoteAudio();
        setCallState("failed");
        void persistCallSession({
          status: "failed",
          failureCode: "TELNYX_CALL_ERROR",
          failureMessage: err?.message || "Call failed",
          endedAt: new Date().toISOString(),
        });
      });

    } catch (err: any) {
      console.error("Outbound call initialization failed:", err);
      stopSpeechRecognition();
      stopRemoteAudio();
      setCallState("failed");
      toast.error(err?.message || "Could not start Telnyx softphone call.");
      void persistCallSession({
        status: "failed",
        failureCode: "TELNYX_START_FAILED",
        failureMessage: err?.message || "Softphone start failed",
        endedAt: new Date().toISOString(),
      });
    } finally {
      startingCallRef.current = false;
    }
  }

  function handleKeypadPress(key: string) {
    setKeypadInput((v) => v + key);
    if (telnyxCallRef.current) {
      try { telnyxCallRef.current.dtmf(key); } catch (e) {}
    }
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
      const mockResearch = `
# Research Summary: ${activeClinic.name}
*   **Website Status:** Online
*   **Key Doctor:** Dr. Marcus Cole (Specialist in TRT and Peptide therapy)
*   **Primary Locations:** Austin, TX (Main office)
*   **Telehealth Status:** Yes, supported for residents of Texas
*   **Patient Intake:** Accepting new patients. Online booking links found at "/book"
      `;
      setResearch(mockResearch);
      toast.info("Simulated research profile generated.");
    } finally {
      setResearchLoading(false);
    }
  }

  async function saveCallLog() {
    if (!outcome) {
      toast.error("Please select an outcome before saving.");
      return;
    }
    if (!activeClinic) return;

    const outcomeConfig = CALL_OUTCOMES.find((item) => item.id === outcome);
    const bodyPayload = {
      outcome,
      answered: outcomeConfig?.connected ?? false,
      decisionMakerReached: qualification.q1 ?? false,
      interestLevel,
      notes: notes || `${isPracticeMode ? "Practice" : "Live"} session log: ${outcomeConfig?.label || outcome}`,
      nextAction: nextAction || undefined,
      nextActionAt: followUpDate ? new Date(followUpDate).toISOString() : undefined,
      followUpRequired: Boolean(nextAction),
      durationSec: callDuration,
      callSessionId: callSessionId ?? undefined,
      callEnvironment: isPracticeMode ? "practice" : "live",
      structuredData: {
        onboardingChecklist: qualification,
        transcript: transcript,
        postCallSummary: postCallSummary,
        speakingListeningRatio,
        callQualityScore,
        aiCoachingFeedback,
        directoryPermissionStatus: qualification.q1 ?? false,
        bookingLinkPermissionStatus: qualification.q6 ?? false,
        callEnvironment: isPracticeMode ? "practice" : "live",
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
      toast.success(isPracticeMode ? "Simulation scorecard saved." : "Live call logged.");
      resetCallState();
      loadData();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the call log.");
    }
  }

  // Filter out practice sessions from live analytics metrics
  const analyticsMetrics = useMemo(() => {
    const historyList = (callHistory || []).filter((c) => {
      if (c.callEnvironment === "practice") return false;
      try {
        const struct = typeof c.structuredData === "string"
          ? JSON.parse(c.structuredData || "{}")
          : (c.structuredData || {});
        return struct.callEnvironment !== "practice" && struct.isPractice !== true;
      } catch (e) {
        return true;
      }
    });

    const total = historyList.length;
    if (total === 0) return { count: 0, answerRate: 0, convRate: 0, permRate: 0, avgDuration: "0:00" };

    const answered = historyList.filter((c) => c.answered).length;
    const answeredPercentage = Math.round((answered / total) * 100);

    const conversations = historyList.filter((c) => c.decisionMakerReached).length;
    const conversationPercentage = Math.round((conversations / total) * 100);

    const permissionGranted = historyList.filter((c) => c.outcome === "interested" || c.outcome === "meeting_booked" || c.outcome === "information_requested").length;
    const permissionPercentage = Math.round((permissionGranted / Math.max(conversations, 1)) * 100);

    const totalDuration = historyList.reduce((acc, c) => acc + c.durationSec, 0);
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
    const clinicsList = clinics || [];
    return clinicsList.filter((c) =>
      (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.city || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.state || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [clinics, searchQuery]);

  // During an active call, collapse everything except transcript + controls
  // so the founder can read coach replies without visual noise.
  const isLiveFocus = ["configuring", "dialing", "ringing", "connected", "on_hold"].includes(callState);

  return (
    <div className={`${isLiveFocus ? "min-h-[calc(100vh-6rem)] flex flex-col gap-2" : "space-y-4"}`}>
      {/* HEADER SECTION — compact while on a call */}
      <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b ${isLiveFocus ? "pb-2" : "pb-4"}`}>
        <div>
          <h1 className={`font-bold tracking-tight ${isLiveFocus ? "text-lg" : "text-2xl"}`}>
            {isLiveFocus ? (isPracticeMode ? "Simulation Call" : "Live Call") : "Founder Calling Cockpit"}
          </h1>
          {!isLiveFocus && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Dial clinics in-browser via Telnyx while Deepgram transcribes and the silent AI coach tells you what to say next
            </p>
          )}
        </div>

        {/* Operating Modes Selectors */}
        {!isLiveFocus && (
        <div className="flex items-center gap-3 bg-card border rounded-lg px-3 py-1.5 shadow-sm">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            Mode Select:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (callState !== "idle" && callState !== "ended") {
                  toast.error("Please end the active call before switching modes.");
                  return;
                }
                setIsPracticeMode(false);
                setIsLiveMode(true);
                toast.success("Live mode — Telnyx dials the real clinic, AI coaches silently.");
              }}
              className={`text-xs px-2.5 py-1.5 rounded font-bold transition-all ${
                isLiveMode
                  ? "bg-emerald-600 text-white shadow-sm border border-emerald-700"
                  : "hover:bg-accent text-muted-foreground border border-transparent"
              }`}
            >
              Live
            </button>
            <button
              onClick={() => {
                if (callState !== "idle" && callState !== "ended") {
                  toast.error("Please end the active call before switching modes.");
                  return;
                }
                setIsPracticeMode(true);
                setIsLiveMode(false);
                toast.success("Simulation mode — the AI plays the clinic, same call flow as live.");
              }}
              className={`text-xs px-2.5 py-1.5 rounded font-bold transition-all ${
                isPracticeMode
                  ? "bg-indigo-600 text-white shadow-sm border border-indigo-700"
                  : "hover:bg-accent text-muted-foreground border border-transparent"
              }`}
            >
              Simulation
            </button>
          </div>
        </div>
        )}
      </div>

      {/* MODE LABEL + METRICS — hide while focused on a live call */}
      {!isLiveFocus && (
        <>
      <div className={`p-2.5 rounded-lg border text-center text-xs font-bold uppercase tracking-widest transition-colors ${
        isPracticeMode
          ? "bg-indigo-50 border-indigo-200 text-indigo-800"
          : "bg-emerald-50 border-emerald-200 text-emerald-800"
      }`}>
        {isPracticeMode
          ? "SIMULATION — AI ACTS AS THE CLINIC · SAME FLOW AS LIVE · SILENT AI COACH"
          : "LIVE — TELNYX SOFTPHONE · REAL CLINIC · SILENT AI COACH"}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Total Live Calls" value={analyticsMetrics.count} icon={PhoneCall} tone="default" hint="Simulation calls excluded" />
        <MetricCard label="Answer Rate" value={`${analyticsMetrics.answerRate}%`} icon={TrendingUp} tone="teal" hint="Calls connected" />
        <MetricCard label="Conversations" value={`${analyticsMetrics.convRate}%`} icon={Activity} tone="violet" hint="Decision maker reached" />
        <MetricCard label="Listing Permission" value={`${analyticsMetrics.permRate}%`} icon={Award} tone="green" hint="Of conversations" />
        <MetricCard label="Avg Duration" value={analyticsMetrics.avgDuration} icon={Clock} tone="amber" hint="Average call time" />
      </div>
        </>
      )}

      {/* AUDIO SETUP TEST COMPONENT */}
      {audioTestingOpen && (
        <Card className="p-4 border-amber-200 bg-amber-50/20 space-y-4 animate-in slide-in-from-top-3 duration-250">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-sm flex items-center gap-1.5">
              <SlidersHorizontal className="size-4 text-amber-600" /> Audio Setup & Hardware Test
            </span>
            <Button variant="ghost" size="icon" className="size-7" onClick={stopAudioTesting}>
              <VolumeX className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Input & Output selection */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Select Microphone (Input)</label>
                <Select value={selectedMic} onValueChange={setSelectedMic}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Microphone" />
                  </SelectTrigger>
                  <SelectContent>
                    {micsList.map((mic) => (
                      <SelectItem key={mic.deviceId} value={mic.deviceId}>{mic.label || `Microphone ${mic.deviceId.slice(0, 5)}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Select Speaker (Output)</label>
                <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Speaker / Headset" />
                  </SelectTrigger>
                  <SelectContent>
                    {speakersList.map((spk) => (
                      <SelectItem key={spk.deviceId} value={spk.deviceId}>{spk.label || `Speaker ${spk.deviceId.slice(0, 5)}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Volume decibel bar visualizer */}
              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground">Microphone Input Level</span>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${micTestLevel}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Hardware action loops */}
            <div className="bg-background border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold block">1. Microphone Recording Loop</span>
                  <span className="text-[10px] text-muted-foreground">Record 3s sample to check audio capture</span>
                </div>
                <Button
                  size="sm"
                  onClick={recordMicSample}
                  disabled={isRecordingSample}
                  className="h-7 text-xs"
                >
                  {isRecordingSample ? `Recording (${sampleDuration}s)` : "Record"}
                </Button>
              </div>

              {recordingBlobUrl && (
                <div className="flex items-center gap-2 pt-1 border-t border-dashed">
                  <span className="font-semibold text-[10px]">Play sample:</span>
                  <audio src={recordingBlobUrl} className="h-8 flex-1" controls />
                </div>
              )}

              <div className="flex items-center justify-between border-t pt-2 border-dashed">
                <div>
                  <span className="font-bold block">2. Text-to-Speech Speaker Check</span>
                  <span className="text-[10px] text-muted-foreground">Plays test audio to confirm volume level</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={playVoiceTest}
                  disabled={testAudioPlaying}
                  className="h-7 text-xs gap-1"
                >
                  <Volume2 className="size-3" /> {testAudioPlaying ? "Playing..." : "Test Voice"}
                </Button>
              </div>

              {/* Status validation matrix */}
              <div className="flex items-center gap-2.5 pt-2 border-t text-[11px] font-semibold">
                <div className="flex items-center gap-1">
                  <span className={`size-2 rounded-full ${micTestPassed ? "bg-emerald-500" : "bg-slate-300"}`} />
                  Mic Test: {micTestPassed ? "PASS" : "WAIT"}
                </div>
                <div className="flex items-center gap-1">
                  <span className={`size-2 rounded-full ${speakerTestPassed ? "bg-emerald-500" : "bg-slate-300"}`} />
                  Speaker Test: {speakerTestPassed ? "PASS" : "WAIT"}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* MOBILE SCREEN NAVIGATION TABS */}
      {!isLiveFocus && (
      <div className="flex lg:hidden border-b pb-1 gap-1">
        <Button variant={mobileTab === "dialer" ? "default" : "ghost"} size="sm" className="flex-1 text-xs" onClick={() => setMobileTab("dialer")}>
          Dialer / Profile
        </Button>
        <Button variant={mobileTab === "copilot" ? "default" : "ghost"} size="sm" className="flex-1 text-xs gap-1.5" onClick={() => setMobileTab("copilot")}>
          <Sparkles className="size-3 text-amber-500 fill-amber-500" /> AI Copilot
        </Button>
        <Button variant={mobileTab === "notes" ? "default" : "ghost"} size="sm" className="flex-1 text-xs" onClick={() => setMobileTab("notes")}>
          Log / Outcome
        </Button>
      </div>
      )}

      {/* MAIN LAYOUT GRID */}
      <div className={`grid grid-cols-1 ${isLiveFocus ? "gap-2 lg:grid-cols-1 flex-1 min-h-0" : "gap-4 lg:grid-cols-12"}`}>
        
        {/* LEFT COLUMN: Queue & History List — hidden during live focus */}
        {!isLiveFocus && (
        <Card className="lg:col-span-3 p-0 flex flex-col h-[65vh] lg:h-[calc(100vh-320px)] overflow-hidden shrink-0">
          <div className="border-b px-3 py-2 flex items-center justify-between bg-muted/20 shrink-0">
            <div className="flex items-center gap-1">
              <Button variant={sidebarTab === "queue" ? "secondary" : "ghost"} size="sm" className="h-8 text-xs font-semibold px-3" onClick={() => setSidebarTab("queue")}>
                Queue ({clinics.length})
              </Button>
              <Button variant={sidebarTab === "history" ? "secondary" : "ghost"} size="sm" className="h-8 text-xs font-semibold px-3" onClick={() => setSidebarTab("history")}>
                History
              </Button>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase font-mono bg-background">
              {isPracticeMode ? "SIMULATION" : "LIVE"}
            </Badge>
          </div>

          {/* Search box */}
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
                <EmptyState icon={PhoneCall} title="No clinics" description="Search returned no clinics." />
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
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-sm truncate">{clinic.name}</span>
                          <DataSourceBadge source={(clinic as any).dataSource || (appConfig.liveClinics ? "live" : "demo")} />
                        </div>
                        <PriorityBadge priority={clinic.priority} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                        <span className="truncate">{[clinic.city, clinic.state].filter(Boolean).join(", ")}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-mono">{localTime(clinic.timezone)}</span>
                          <span className={`size-1.5 rounded-full ${withinHours ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                        </div>
                      </div>
                    </button>
                  );
                })
              )
            ) : (
              callHistory.length === 0 ? (
                <EmptyState icon={History} title="No history" description="No logged calls." />
              ) : (
                callHistory.map((session) => (
                  <div key={session.id} className="p-3 text-xs flex flex-col gap-1.5 hover:bg-muted/10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-medium truncate">{session.clinicName}</span>
                        <DataSourceBadge source={(session as any).dataSource || (appConfig.liveClinics ? "live" : "demo")} />
                      </div>
                      <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full ${
                        session.outcome === "interested" || session.outcome === "meeting_booked"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
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
        )}

        {/* CENTER COLUMN: Dialer, Configs, Live transcript */}
        <div className={`flex flex-col min-h-0 ${isLiveFocus ? "gap-2 lg:col-span-1 flex-1" : "gap-4 lg:col-span-6"} ${!isLiveFocus && mobileTab !== "dialer" ? "hidden lg:flex" : ""}`}>

          {callState === "idle" && activeClinic && (
            <Card className={`p-4 ${isPracticeMode ? "border-indigo-200 bg-indigo-50/40" : "border-emerald-200 bg-emerald-50/40"}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className={`font-bold text-sm ${isPracticeMode ? "text-indigo-950" : "text-emerald-950"}`}>
                    {isPracticeMode ? `Call ${activeClinic.name} (AI answers as the clinic)` : `Call ${activeClinic.name}`}
                  </p>
                  <p className={`text-xs mt-1 ${isPracticeMode ? "text-indigo-800" : "text-emerald-800"}`}>
                    {isPracticeMode
                      ? "Exact same flow as Live: you talk, the AI clinic answers out loud, the copilot tells you what to say next."
                      : "You speak to the clinic through the Telnyx softphone; Deepgram transcribes both sides; the copilot tells you what to say next."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    variant="outline"
                    disabled={!activeClinic.primaryPhone}
                    onClick={async () => {
                      await navigator.clipboard.writeText(activeClinic.primaryPhone ?? "");
                      toast.success("Clinic number copied.");
                    }}
                    className={isPracticeMode ? "border-indigo-300 bg-white" : "border-emerald-300 bg-white"}
                  >
                    <Phone className="size-4" /> {formatPhone(activeClinic.primaryPhone)}
                  </Button>
                  <Button
                    onClick={isPracticeMode ? startPracticeCall : openConsentGateForLiveCall}
                    disabled={(!isPracticeMode && !activeClinic.primaryPhone) || startingCallRef.current}
                    className={isPracticeMode ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"}
                  >
                    <Mic className="size-4" /> Start Call
                  </Button>
                </div>
              </div>
            </Card>
          )}
          
          {/* CONFIGURATION PANEL FOR PRACTICE MODE */}
          {isPracticeMode && callState === "idle" && (
            <Card className="p-4 border-indigo-200 bg-indigo-50/10 space-y-3.5">
              <span className="font-bold text-sm flex items-center gap-1.5 text-indigo-950">
                <SlidersHorizontal className="size-4 text-indigo-600" /> Simulation — the AI acts as the clinic
              </span>
              <p className="text-xs text-indigo-900/80">
                Exact same call flow as Live: you talk, the AI clinic answers out loud, and the silent copilot tells you what to say next. Only the other end of the line is simulated.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Persona */}
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground block">Simulated Clinic Role</label>
                  <Select value={practicePersona} onValueChange={setPracticePersona}>
                    <SelectTrigger className="h-8 text-xs bg-background border-indigo-200">
                      <SelectValue placeholder="Role Persona" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRACTICE_PERSONAS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.role} ({p.name})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground italic mt-1 leading-normal">
                    {PRACTICE_PERSONAS.find(p => p.id === practicePersona)?.description}
                  </p>
                </div>

                {/* Scenario */}
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground block">Call Scenario Library</label>
                  <Select value={practiceScenario} onValueChange={setPracticeScenario}>
                    <SelectTrigger className="h-8 text-xs bg-background border-indigo-200">
                      <SelectValue placeholder="Scenario" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRACTICE_SCENARIOS.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground italic mt-1 leading-normal">
                    {PRACTICE_SCENARIOS.find(s => s.id === practiceScenario)?.objective}
                  </p>
                </div>

                {/* Difficulty */}
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground block">Difficulty Level</label>
                  <div className="flex gap-1.5 mt-0.5">
                    {(["beginner", "intermediate", "advanced"] as const).map((level) => {
                      const isLvlSelected = practiceDifficulty === level;
                      return (
                        <button
                          key={level}
                          onClick={() => setPracticeDifficulty(level)}
                          className={`flex-1 text-[10px] py-1 border rounded-lg capitalize font-bold transition-all ${
                            isLvlSelected
                              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                              : "bg-background text-muted-foreground border-indigo-200 hover:bg-muted"
                          }`}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-indigo-100 pt-3 text-xs">
                <span className="text-indigo-950 flex items-center gap-2 font-semibold">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Provider voice: Hume via live Vapi configuration
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Microphone permission is requested when roleplay starts. Headphones recommended.
                </span>
              </div>
            </Card>
          )}

          {/* ACTIVE CLINIC INFORMATION PROFILE — hidden during live focus */}
          {!isLiveFocus && (activeClinic ? (
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
                  <Badge variant="outline" className="font-mono text-xs bg-background">
                    Score: {activeClinic.readinessScore}
                  </Badge>
                </div>
              </div>

              {/* CONTACT DETAILS & LOCAL TIME */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-y py-2.5 text-xs">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Primary Phone</p>
                  <p className="font-semibold text-foreground mt-0.5">{formatPhone(activeClinic.primaryPhone) || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Email Address</p>
                  <p className="truncate text-foreground mt-0.5" title={activeClinic.generalEmail ?? ""}>
                    {activeClinic.generalEmail ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Website</p>
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
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Local Time</p>
                  <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                    <Clock className="size-3 text-muted-foreground" />
                    <span>{localTime(activeClinic.timezone)}</span>
                    <span className={`size-1.5 rounded-full ${isWithinCallingHours(activeClinic.timezone) ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                  </p>
                </div>
              </div>

              {/* DECISION MAKER CONTACTS */}
              {activeClinic.contacts && activeClinic.contacts.length > 0 && (
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
                <Button variant="outline" size="sm" onClick={fetchClinicResearch} disabled={researchLoading} className="flex-1 text-xs gap-1.5">
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
          ))}

          {/* DOCK DIALER — compact bar during live focus */}
          {activeClinic && (
            <Card className={`text-white shadow-xl flex flex-col relative overflow-hidden transition-colors shrink-0 ${
              isLiveFocus ? "p-2.5 gap-2" : "p-4 gap-4"
            } ${isPracticeMode ? "bg-slate-900 border-slate-950" : "bg-emerald-950 border-emerald-950"}`}>
              <div className="absolute inset-0 bg-radial-gradient from-slate-800 to-slate-900 opacity-50 z-0 pointer-events-none" />
              <div className="relative z-10 flex flex-row items-center justify-between gap-3">
                
                {/* Caller identity status indicator */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isLiveFocus ? "size-9" : "size-12"
                  } ${
                    callState === "connected"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 animate-pulse"
                      : callState === "dialing" || callState === "ringing"
                        ? "border-amber-500 bg-amber-500/10 text-amber-400"
                        : callState === "on_hold"
                          ? "border-amber-400 bg-amber-400/10 text-amber-400"
                          : "border-slate-700 bg-slate-800 text-slate-400"
                  }`}>
                    <PhoneOutgoing className={isLiveFocus ? "size-4" : "size-6"} />
                  </div>
                  <div className="text-left min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold tracking-wide uppercase truncate ${isLiveFocus ? "text-[10px]" : "text-xs"}`}>
                        {isPracticeMode ? "SIMULATION" : "LIVE"} · {activeClinic.name}
                      </span>
                      <span className={`size-2 rounded-full shrink-0 ${
                        callState === "connected" ? "bg-emerald-500" : callState === "idle" ? "bg-slate-500" : "bg-amber-500"
                      }`} />
                    </div>
                    {!isLiveFocus && (
                      <p className="text-sm font-semibold tracking-wider font-mono mt-0.5">
                        {isPracticeMode ? `${activeClinic.name} (AI)` : formatPhone(activeClinic.primaryPhone)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Call Timer counter */}
                {(callState === "connected" || callState === "on_hold" || callState === "ended") && (
                  <div className={`font-mono font-bold tracking-widest text-slate-100 bg-slate-800/80 rounded-lg border border-slate-700 shadow-inner shrink-0 ${
                    isLiveFocus ? "text-lg px-3 py-1" : "text-3xl px-4 py-1.5"
                  }`}>
                    {formatDuration(callDuration)}
                  </div>
                )}

                {/* Recording status (live official calls) */}
                {isLiveMode && callState !== "idle" && (
                  <Badge
                    className={`shrink-0 text-[10px] uppercase tracking-wide ${
                      recordingStatus === "active" || recordingStatus === "uploaded" || recordingStatus === "finalized" || recordingStatus === "local_backup_saved"
                        ? "bg-rose-600/90 text-white border-rose-500"
                        : recordingStatus === "failed" || recordingStatus === "cloud_save_failed" || recordingStatus === "audio_unavailable"
                          ? "bg-amber-600 text-white border-amber-500"
                          : "bg-slate-700 text-slate-200 border-slate-600"
                    }`}
                  >
                    REC · {recordingStatus.replace(/_/g, " ")}
                  </Badge>
                )}

                {/* Dial controller actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isLiveFocus && callState !== "idle" && callState !== "ended" && callState !== "failed" && callState !== "provider_unavailable" && (
                    <>
                      <button
                        onClick={toggleMute}
                        title={muted ? "Unmute" : "Mute"}
                        className={`size-9 rounded-lg flex items-center justify-center hover:bg-slate-800 transition-colors ${
                          muted ? "text-rose-400 bg-rose-500/10" : "text-slate-300"
                        }`}
                      >
                        {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                      </button>
                      <button
                        onClick={toggleSpeaker}
                        title="Speaker"
                        className={`size-9 rounded-lg flex items-center justify-center hover:bg-slate-800 transition-colors ${
                          speakerEnabled ? "text-emerald-400 bg-emerald-500/10" : "text-slate-300"
                        }`}
                      >
                        {speakerEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                      </button>
                    </>
                  )}
                  {["idle", "ended", "failed", "provider_unavailable"].includes(callState) ? (
                    isPracticeMode ? (
                      <Button
                        onClick={startPracticeCall}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 h-11 rounded-lg flex items-center gap-2 shadow-lg"
                      >
                        <Mic className="size-4" /> Start Call
                      </Button>
                    ) : (
                      <Button
                        onClick={openConsentGateForLiveCall}
                        disabled={startingCallRef.current}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 h-11 rounded-lg flex items-center gap-2 shadow-lg"
                      >
                        <Mic className="size-4" /> Start Call
                      </Button>
                    )
                  ) : (
                    <Button
                      onClick={endCall}
                      className={`bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg flex items-center gap-2 shadow-lg ${
                        isLiveFocus ? "text-xs px-3 h-9" : "text-sm px-6 h-11"
                      }`}
                    >
                      <PhoneOff className="size-4" /> Hang Up
                    </Button>
                  )}
                </div>
              </div>

              {/* Full controls only when not in live focus */}
              {!isLiveFocus && callState !== "idle" && callState !== "ended" && callState !== "failed" && callState !== "provider_unavailable" && (
                <div className="relative z-10 grid gap-2 border-t border-slate-800 pt-3 text-slate-300 grid-cols-6">
                  <button
                    onClick={toggleMute}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-800 transition-colors ${
                      muted ? "text-rose-400 bg-rose-500/10" : ""
                    }`}
                  >
                    {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                    <span className="text-[10px] font-semibold mt-1">Mute</span>
                  </button>

                  <button
                    onClick={toggleHold}
                    disabled={callState === "dialing" || callState === "ringing"}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-800 transition-colors ${
                      onHold ? "text-amber-400 bg-amber-500/10" : ""
                    }`}
                  >
                    {onHold ? <Play className="size-5" /> : <Pause className="size-5" />}
                    <span className="text-[10px] font-semibold mt-1">{onHold ? "Resume" : "Hold"}</span>
                  </button>

                  <button
                    onClick={() => setDialPadOpen(!dialPadOpen)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-800 transition-colors ${
                      dialPadOpen ? "text-primary bg-primary/10" : ""
                    }`}
                  >
                    <Grid3x3 className="size-5" />
                    <span className="text-[10px] font-semibold mt-1">Keypad</span>
                  </button>

                  <button
                    onClick={toggleSpeaker}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-800 transition-colors ${
                      speakerEnabled ? "text-emerald-400 bg-emerald-500/10" : ""
                    }`}
                  >
                    {speakerEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
                    <span className="text-[10px] font-semibold mt-1">Speaker</span>
                  </button>

                  <button
                    onClick={() => {
                      if (isPracticeMode && callState === "connected") {
                        const currentScenario = PRACTICE_SCENARIOS.find(s => s.id === practiceScenario);
                        const currentStep = currentScenario?.dialogueTree[scenarioStepIndex];
                        if (currentStep) speakPracticeText(currentStep.clinicSpeech);
                      } else {
                        toast.warning("VoIP call transfers require business registry setup.");
                      }
                    }}
                    disabled={isPracticeMode && callState === "dialing"}
                    className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    {isPracticeMode ? <RotateCcw className="size-5" /> : <UserCheck className="size-5" />}
                    <span className="text-[10px] font-semibold mt-1">{isPracticeMode ? "Repeat" : "Transfer"}</span>
                  </button>

                  <div className="flex flex-col items-center justify-center p-2 text-slate-500">
                    <Clock className="size-5" />
                    <span className="text-[9px] font-bold mt-1 uppercase font-mono text-slate-400">
                      {isPracticeMode ? "SIM" : "TELNYX"}
                    </span>
                  </div>
                </div>
              )}

              {/* Collapsible Keypad */}
              {!isLiveFocus && dialPadOpen && callState !== "ended" && (
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

          {/* SPEAKER-SEPARATED TRANSCRIPT — fills viewport during live focus */}
          {callState !== "idle" && (
            <Card className={`flex-1 flex flex-col p-0 overflow-hidden min-h-0 ${
              isLiveFocus ? "min-h-[calc(100vh-11rem)]" : "min-h-[320px] max-h-[390px]"
            }`}>
              <div className={`border-b bg-muted/20 flex items-center justify-between shrink-0 ${isLiveFocus ? "px-4 py-2" : "px-4 py-3"}`}>
                <span className="text-sm font-bold flex items-center gap-1.5">
                  <Activity className="size-4 text-emerald-500 animate-pulse" /> Live Transcript
                  {isLiveFocus && activeStage && (
                    <Badge variant="outline" className="ml-2 text-[10px] capitalize font-medium">
                      Stage: {activeStage}
                    </Badge>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] text-indigo-700 border-indigo-200 bg-indigo-50">
                    You
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-slate-700 border-slate-200 bg-slate-50">
                    Clinic
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-amber-800 border-amber-300 bg-amber-50">
                    Coach
                  </Badge>
                </div>
              </div>

              {/* Scrolling transcript turns */}
              <div
                ref={transcriptScrollRef}
                onScroll={handleTranscriptScroll}
                className={`flex-1 overflow-y-auto nv-scroll bg-muted/5 space-y-3 ${isLiveFocus ? "p-5" : "p-4"}`}
              >
                {transcript.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-xs p-6">
                    <Clock className="size-6 mb-1 text-slate-300 animate-pulse" />
                    Waiting for call connection...
                  </div>
                ) : (
                  transcript.map((line, idx) => {
                    const isCoach = isCoachLine(line);
                    const isJamil = !isCoach && line.speaker === "Jamil";
                    const isDrafting = isCoach && [COACH_DRAFTING_TEXT, COACH_LISTENING_TEXT].includes(line.text);
                    return (
                      <div
                        key={`${line.kind ?? "utterance"}-${line.speaker}-${line.timestamp}`}
                        className={`flex flex-col ${
                          isCoach
                            ? "mr-auto items-start w-full max-w-[min(920px,96%)]"
                            : isJamil
                              ? "ml-auto items-end max-w-[min(720px,85%)]"
                              : "mr-auto items-start max-w-[min(720px,85%)]"
                        }`}
                      >
                        <span
                          className={`text-[9px] font-semibold px-1 py-0.5 uppercase tracking-wide ${
                            isCoach ? "text-amber-700" : "text-muted-foreground"
                          }`}
                        >
                          {isCoach ? "Coach · Say this next" : line.speaker}
                        </span>
                        <div
                          className={`rounded-lg mt-0.5 leading-relaxed ${
                            isLiveFocus ? "p-3 text-[15px]" : "p-2.5 text-sm"
                          } ${
                            isCoach
                              ? `border border-dashed border-amber-400/80 bg-amber-50 text-amber-950 rounded-tl-none ${
                                  isDrafting ? "italic text-amber-700/80" : ""
                                }`
                              : isJamil
                                ? "bg-indigo-600 text-white rounded-tr-none shadow-sm"
                                : "bg-card border text-foreground rounded-tl-none shadow-sm"
                          }`}
                        >
                          {isCoach && !isDrafting ? (
                            <span className="flex items-start gap-1.5">
                              <Sparkles className="size-3.5 mt-0.5 shrink-0 text-amber-600" />
                              <span>{line.text}</span>
                            </span>
                          ) : (
                            line.text
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                {showNewMessages && newMessagesCount > 0 && (
                  <button
                    type="button"
                    onClick={jumpToTranscriptBottom}
                    className="sticky bottom-3 mx-auto z-20 bg-background/95 backdrop-blur border rounded-full px-3 py-1 text-xs font-bold text-indigo-700 shadow-sm hover:bg-background"
                  >
                    New messages ↓ {newMessagesCount}
                  </button>
                )}
                <div ref={transcriptEndRef} />
              </div>

              {callState === "connected" && (
                <form
                  className="border-t bg-background p-3 flex flex-col sm:flex-row gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const response = practiceResponse.trim();
                    if (!response) return;
                    if (isPracticeMode && vapiPracticeRef.current) {
                      vapiPracticeRef.current.send({
                        type: "add-message",
                        message: { role: "user", content: response },
                        triggerResponseEnabled: true,
                      });
                      setTranscript((previous) => [...previous, { speaker: "Jamil", text: response, timestamp: new Date().toISOString() }]);
                    } else if (isPracticeMode) {
                      handleUserSpeechInput(response);
                    } else {
                      handleManualTranscriptInput(response);
                    }
                    setPracticeResponse("");
                  }}
                >
                  <div className="flex-1">
                    <Input
                      value={practiceResponse}
                      onChange={(event) => setPracticeResponse(event.target.value)}
                      placeholder={isPracticeMode ? "Type what you would say to the clinic…" : "Type what the clinic just said…"}
                      aria-label={isPracticeMode ? "Simulation response" : "Clinic response"}
                    />
                    {speechRecognitionUnavailable && (
                      <p className="mt-1 text-[10px] text-amber-700">
                        Voice recognition is unavailable here; type the clinic’s response and coaching will update immediately.
                      </p>
                    )}
                    {!isPracticeMode && (
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className={`size-2 rounded-full ${micTestLevel > 0 ? "bg-emerald-500" : "bg-amber-400"}`} />
                        <span>Computer mic signal</span>
                        <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-75" style={{ width: `${micTestLevel}%` }} />
                        </div>
                        <span className="font-mono">{micTestLevel}%</span>
                      </div>
                    )}
                  </div>
                  <Button type="submit" disabled={!practiceResponse.trim()}>
                    {copilotLoading ? "Updating…" : "Update coaching"}
                  </Button>
                </form>
              )}
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN — hidden during live focus (coach is inline in transcript) */}
        {!isLiveFocus && (
        <div className={`lg:col-span-3 flex flex-col gap-4 ${mobileTab !== "copilot" ? "hidden lg:flex" : ""}`}>
          
          {/* DYNAMIC TALK TRACK STAGE PROGRESS */}
          {activeClinic && callState !== "idle" && (
            <Card className="p-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Live Talk Track Stage
              </span>
              <div className="grid grid-cols-4 gap-1 mt-2">
                {[
                  { id: "intro", label: "Intro" },
                  { id: "permission", label: "Perm" },
                  { id: "directory", label: "Direct" },
                  { id: "qualification", label: "Qual" },
                  { id: "objections", label: "Object" },
                  { id: "interest", label: "Interest" },
                  { id: "scheduling", label: "Sched" },
                  { id: "closing", label: "Close" },
                ].map((s, idx) => {
                  const isActive = activeStage === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`text-center py-1 rounded text-[9px] font-bold uppercase border transition-all ${
                        isActive
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-sm font-black scale-105"
                          : "bg-muted text-muted-foreground/60 border-transparent"
                      }`}
                      title={s.label}
                    >
                      {s.label}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* AI VOICE COPILOT CARD */}
          {activeClinic && (
            <Card className="p-4 bg-gradient-to-br from-indigo-50/50 via-purple-50/10 to-indigo-50/10 border-indigo-100 flex flex-col gap-3.5 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                <Sparkles className="size-16 text-indigo-700" />
              </div>

              <div className="flex items-center justify-between border-b pb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0 border border-indigo-200">
                    <Sparkles className="size-4 text-indigo-700 fill-indigo-700/20" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">AI Voice Copilot</h3>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wide">SILENT Private Coach</span>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 text-[9px] uppercase border border-indigo-200">
                  {isPracticeMode
                    ? "Simulation"
                    : copilotSource === "deterministic"
                      ? "Deterministic"
                      : copilotSource === "ai"
                        ? "Live AI"
                        : copilotSource === "field_guide"
                          ? "Field Guide"
                          : "Opening"}
                </Badge>
              </div>

              {/* Interruption warning */}
              {interruptionWarning && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-2.5 text-xs flex items-start gap-2 animate-bounce">
                  <AlertTriangle className="size-4 shrink-0 text-rose-500 mt-0.5" />
                  <div>
                    <span className="font-bold">Interruption warning:</span>
                    <p className="mt-0.5">Let the clinic representative finish speaking before responding.</p>
                  </div>
                </div>
              )}

              {/* Warnings Panel */}
              {copilotWarning && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-2.5 text-xs flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-rose-500 mt-0.5" />
                  <div>
                    <span className="font-bold">Compliance Checklist warning:</span>
                    <p className="mt-0.5">{copilotWarning}</p>
                  </div>
                </div>
              )}

              {/* Suggestions — anti-freeze hierarchy */}
              <div className="space-y-3.5 text-xs">
                <div>
                  <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wide flex items-center gap-1">
                    <CheckCircle2 className="size-3.5 text-indigo-600" /> Say this now
                  </p>
                  <div className="bg-white border border-indigo-200 p-3 rounded-lg text-slate-800 font-medium mt-1 relative group shadow-sm leading-relaxed text-sm">
                    {copilotSuggestion}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (copilotSuggestion) {
                          navigator.clipboard.writeText(copilotSuggestion);
                          toast.success("Suggested response copied!");
                        }
                      }}
                      className="absolute right-1 bottom-1 size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy suggestion"
                    >
                      <Send className="size-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                {copilotShorter && (
                  <div>
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wide">Shorter version</p>
                    <p className="mt-1 text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5 leading-relaxed">{copilotShorter}</p>
                  </div>
                )}

                {copilotQuestion && (
                  <div>
                    <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wide">Ask next</p>
                    <p className="text-slate-800 bg-purple-50/40 border border-purple-100 p-2.5 rounded-lg font-medium mt-1 leading-relaxed">
                      {copilotQuestion}
                    </p>
                  </div>
                )}

                {copilotDoNotSay.length > 0 && (
                  <div>
                    <p className="text-[10px] text-rose-700 font-bold uppercase tracking-wide">Do not say</p>
                    <ul className="mt-1 space-y-1 text-rose-900/80 bg-rose-50/50 border border-rose-100 rounded-lg p-2.5">
                      {copilotDoNotSay.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wide">If you freeze</p>
                  <p className="mt-1 text-amber-950 bg-amber-50 border border-amber-200 rounded-lg p-2.5 font-medium leading-relaxed">
                    {copilotFreezeRecovery}
                  </p>
                </div>

                <details className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5">
                  <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    Emergency fallback card
                  </summary>
                  <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700 leading-relaxed">
                    <li><span className="font-semibold">Opening:</span> {emergencyCard.opening}</li>
                    <li><span className="font-semibold">Cost:</span> {emergencyCard.cost}</li>
                    <li><span className="font-semibold">Decline:</span> {emergencyCard.decline}</li>
                    <li><span className="font-semibold">DNC:</span> {emergencyCard.dnc}</li>
                    <li><span className="font-semibold">Freeze:</span> {emergencyCard.freeze}</li>
                  </ul>
                </details>

                {(copilotStructuredReason || copilotNextAction || copilotGroundingStatus) && (
                  <details className="rounded-lg border border-indigo-100 bg-white/70 p-2.5">
                    <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                      Reason (internal) · {copilotSource}
                    </summary>
                    {copilotStructuredReason && <p className="mt-2 text-slate-700 leading-relaxed">{copilotStructuredReason}</p>}
                    {copilotNextAction && <p className="mt-1 text-slate-600"><span className="font-semibold">Next:</span> {copilotNextAction}</p>}
                    {copilotKnowledgeSources.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                        {copilotKnowledgeSources.map((src, i) => (
                          <li key={`${src.title}-${i}`}>• {src.title} — {src.source}{src.section ? ` · ${src.section}` : ""}</li>
                        ))}
                      </ul>
                    )}
                  </details>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { id: "helpful", label: "Helpful" },
                    { id: "incorrect", label: "Incorrect" },
                    { id: "too_long", label: "Too long" },
                    { id: "repetitive", label: "Repetitive" },
                    { id: "used_successfully", label: "Used it" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void submitCopilotFeedback(item.id)}
                      className="text-[10px] px-2 py-1 rounded-full border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-800 font-medium"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {objectionGuidance && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-lg">
                    <span className="font-bold text-[10px] text-amber-800 uppercase tracking-wide flex items-center gap-1">
                      <Flame className="size-3 text-amber-600 fill-amber-600/30" /> Objection handling guide
                    </span>
                    <p className="mt-1 font-medium leading-relaxed">{objectionGuidance}</p>
                  </div>
                )}

                {/* Real-time speech trackers */}
                <div className="border-t pt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500">
                  <div className="bg-muted/40 p-2 rounded border">
                    <span className="text-[9px] uppercase text-muted-foreground">Speaking Pace</span>
                    <p className="text-slate-800 font-bold mt-0.5">{speakingPace}</p>
                  </div>
                  <div className="bg-muted/40 p-2 rounded border">
                    <span className="text-[9px] uppercase text-muted-foreground">Talk/Listen Ratio</span>
                    <p className="text-slate-800 font-bold mt-0.5">{speakingListeningRatio}</p>
                  </div>
                </div>

                {clinicFacts.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
                      Mentioned Clinic Facts
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600 mt-1.5 font-medium">
                      {clinicFacts.map((fact, idx) => (
                        <li key={idx}>{fact}</li>
                      ))}
                    </ul>
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
              <div className="space-y-1.5 mt-2 max-h-[140px] overflow-y-auto nv-scroll text-xs">
                {OBJECTION_LIBRARY.map((obj) => {
                  const isExpanded = expandedObjection === obj.id;
                  return (
                    <div key={obj.id} className="border-b last:border-0 pb-1.5 last:pb-0 pt-1.5 first:pt-0">
                      <button
                        onClick={() => setExpandedObjection(isExpanded ? null : obj.id)}
                        className="w-full text-left font-semibold text-slate-700 hover:text-primary flex items-center justify-between"
                      >
                        <span>{obj.text}</span>
                        <ChevronRight className={`size-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </button>
                      {isExpanded && (
                        <p className="text-[11px] bg-slate-50 border p-2 rounded text-slate-600 mt-1 italic leading-relaxed">
                          {obj.response}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
        )}

        {/* FULL-WIDTH OUTCOME ROW — hidden during live focus */}
        {!isLiveFocus && (
        <div className={`lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-4 ${mobileTab !== "notes" ? "hidden lg:grid" : ""}`}>
          
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

          {/* POST-CALL SUMMARY CARD / SCORECARD */}
          {postCallSummary && (
            <Card className="p-4 border-indigo-100 bg-indigo-50/20 flex flex-col gap-3 animate-in fade-in-20 duration-200">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="size-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                    {isPracticeMode ? "Simulation Scorecard" : "Post-Call AI Summary"}
                  </h4>
                </div>
                {callQualityScore > 0 && (
                  <Badge className="bg-indigo-600 text-white text-[9px] tracking-wider font-mono">
                    Score: {callQualityScore}/100
                  </Badge>
                )}
              </div>

              {/* Simulated Metrics Card */}
              {isPracticeMode && (
                <div className="bg-white border rounded p-2.5 text-[10px] space-y-2">
                  <div className="flex justify-between font-semibold text-slate-500 border-b pb-1 border-dotted">
                    <span>Interruption Count: {practiceInterruptionCount}</span>
                    <span>Ratio: {speakingListeningRatio}</span>
                  </div>
                  {aiCoachingFeedback && (
                    <div className="text-indigo-950 font-medium leading-relaxed italic">
                      <Sparkle className="size-3 text-indigo-600 inline mr-1" />
                      "{aiCoachingFeedback}"
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 text-xs text-slate-700 overflow-y-auto max-h-[220px] nv-scroll pr-1">
                <div>
                  <span className="font-bold text-indigo-900">Summary Context:</span>
                  <p className="mt-0.5 leading-relaxed">{postCallSummary.whatHappened}</p>
                </div>
                <div>
                  <span className="font-bold text-indigo-900">Objections:</span>
                  <p className="mt-0.5 leading-relaxed">{postCallSummary.objections}</p>
                </div>
                <div>
                  <span className="font-bold text-indigo-900">Commitments:</span>
                  <p className="mt-0.5 leading-relaxed">{postCallSummary.commitments}</p>
                </div>
                <div>
                  <span className="font-bold text-indigo-900">Sentiment:</span>
                  <p className="mt-0.5 leading-relaxed">{postCallSummary.sentiment}</p>
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
                    placeholder="e.g., Send verified profile URL"
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
                  Call Notes / Rehearsal feedback
                </label>
                <Textarea
                  placeholder="Record summaries, feedback, key arguments, objections discussed..."
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
                {isPracticeMode ? "Save Simulation Scorecard" : "Save Live Outcome"}
              </Button>
            </Card>
          )}
        </div>
        )}
      </div>

      {/* Recording consent gate — required before official live calls */}
      {consentModalOpen && activeClinic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <ShieldCheck className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-base">Recording & consent required</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Official clinic calls must be recorded. This is not legal advice — confirm applicable consent rules for your jurisdiction.
                </p>
              </div>
            </div>
            <div className="text-xs space-y-2 bg-muted/40 rounded-lg p-3">
              <p><span className="font-semibold">Clinic state:</span> {activeClinic.state ?? "Unknown"}</p>
              <p><span className="font-semibold">Jurisdiction:</span> {consentJurisdiction}</p>
              <p><span className="font-semibold">Explicit consent required:</span> {consentRequiresExplicit ? "Yes" : "No (still record with notice)"}</p>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Consent script</label>
              <Textarea
                value={consentScript}
                onChange={(e) => setConsentScript(e.target.value)}
                className="mt-1 text-xs min-h-[70px]"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Call objective: request permission for the <strong>free Novalyte AI directory listing</strong> only — no paid services on this call.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <Button variant="outline" onClick={() => setConsentModalOpen(false)}>Cancel</Button>
              {consentRequiresExplicit ? (
                <>
                  <Button variant="destructive" onClick={() => { setConsentStatus("declined"); setConsentModalOpen(false); toast.error("Call cancelled — consent declined."); }}>
                    Consent declined
                  </Button>
                  <Button onClick={() => void confirmConsentAndStartCall(true)}>
                    Verbal consent obtained — start call
                  </Button>
                </>
              ) : (
                <Button onClick={() => void confirmConsentAndStartCall(false)}>
                  Acknowledge & start recorded call
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function formatDuration(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
