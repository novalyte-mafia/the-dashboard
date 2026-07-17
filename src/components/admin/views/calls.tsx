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
} from "@/components/admin/shared";
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
  { id: "receptionist", name: "Priya Shah", role: "Receptionist", voiceName: "Google US English", accent: "US Standard", trait: "Helpful but busy", description: "Wants to know why you are calling and check if this is a sales call before routing." },
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

function manualFieldGuideResponse(clinicReply: string) {
  const reply = clinicReply.toLowerCase();
  if (reply.includes("sales") || reply.includes("did not request") || reply.includes("didn't request") || reply.includes("not interested")) {
    return "That’s fair. This is not a paid sales call—the basic verified listing is free. I only need to confirm your public details and your permission to publish them.";
  }
  if (reply.includes("email") || reply.includes("send me")) {
    return "Absolutely. Before I send it, may I confirm the best email and the name of the person who manages your clinic listing?";
  }
  if (reply.includes("cost") || reply.includes("price") || reply.includes("charge")) {
    return "The basic verified listing is free. There is no charge to confirm your clinic information or publish the profile.";
  }
  if (reply.includes("busy") || reply.includes("bad time") || reply.includes("call back")) {
    return "Of course. What day and time would be best for a two-minute verification call?";
  }
  if (reply.includes("manager") || reply.includes("owner") || reply.includes("doctor")) {
    return "Thank you. May I speak with that person briefly, or confirm their name and the best time to reach them?";
  }
  return "Thank you. To make sure we list the clinic accurately, may I confirm your public phone number, services, and whether you are accepting new patients?";
}

const PRACTICE_SCENARIOS: ScenarioConfig[] = [
  {
    id: "scenario_friendly",
    name: "Friendly Clinic Listing",
    objective: "Verify contact name, confirm services (TRT & Telehealth), and secure permission to list profile.",
    initialPrompt: "Hello, Summit Vitality, Priya speaking. How can I help you?",
    dialogueTree: [
      {
        stage: "intro",
        triggerKeywords: ["jamil", "novalyte", "directory", "hello", "hi"],
        clinicSpeech: "Oh, hi Jamil. Yes, this is Summit Vitality. I am the Practice Manager. What listing is this?",
        copilotSuggestion: "It's the Novalyte Men's Health Directory. We help local patients find TRT providers. May I confirm Dr. Cole is still the Medical Director?",
        copilotQuestion: "Confirm if Dr. Marcus Cole is still the Medical Director.",
        facts: ["Clinic Name: Summit Vitality Clinic", "Priya: Practice Manager"]
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
        triggerKeywords: ["email", "priya@", "thank", "bye"],
        clinicSpeech: "You can send it to priya@summitvitality.com. Talk to you soon, Jamil. Bye!",
        copilotSuggestion: "Thank her, confirm email is priya@summitvitality.com, and click 'End Practice Call'.",
        copilotQuestion: "Conclude call.",
        facts: ["Email: priya@summitvitality.com"]
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
        clinicSpeech: "Yes, you can list it. Send the verified badge link to priya@summitvitality.com so we can check it.",
        copilotSuggestion: "Confirm the email priya@summitvitality.com and wrap up the call.",
        copilotQuestion: "Conclude call.",
        facts: ["Email: priya@summitvitality.com", "Booking link: summitvitality.com/book"]
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
  const [transcript, setTranscript] = useState<{ speaker: string; text: string; timestamp: string }[]>([]);
  const [activeStage, setActiveStage] = useState<string>("intro");
  const [copilotSuggestion, setCopilotSuggestion] = useState<string | null>("Place a call to receive private, suggested talk tracks.");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotSource, setCopilotSource] = useState<"opening" | "ai" | "field_guide">("opening");
  const [copilotQuestion, setCopilotQuestion] = useState<string | null>(null);
  const [objectionGuidance, setObjectionGuidance] = useState<string | null>(null);
  const [clinicFacts, setClinicFacts] = useState<string[]>([]);
  const [copilotWarning, setCopilotWarning] = useState<string | null>(null);
  const [copilotNextAction, setCopilotNextAction] = useState<string | null>(null);

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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simulatorRef = useRef<TelephonySimulator | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const callDurationRef = useRef(0);
  const startingCallRef = useRef(false);

  useEffect(() => {
    callDurationRef.current = callDuration;
  }, [callDuration]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => () => {
    if (speakerTestTimeoutRef.current) clearTimeout(speakerTestTimeoutRef.current);
    if (practiceConnectTimeoutRef.current) clearTimeout(practiceConnectTimeoutRef.current);
  }, []);

  // Scroll transcript
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
          whatHappened: "Jamil contacted Summit Vitality Clinic and spoke with Priya, the Practice Manager. Verified Dr. Marcus Cole as the Medical Director and verified their listing details.",
          objections: "Initial objection raised: 'We didn't sign up for this directory'. Clarified that the directory is free, which resolved the objection.",
          commitments: "Priya granted Jamil explicit permission to publish the clinic as verified in the Novalyte directory.",
          sentiment: "Positive and receptive.",
          nextSteps: "Email verified link to priya@summitvitality.com and follow up next month.",
          followUpMessage: "Hi Priya, thanks for verifying Summit Vitality Clinic today! Here is your listing link: directory.novalyte.io/summit-vitality. We will check in next month. Best, Jamil.",
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

  const playVoiceTest = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Speech Synthesis is not supported in this browser.");
      return;
    }
    setTestAudioPlaying(true);
    window.speechSynthesis.cancel();
    if (speakerTestTimeoutRef.current) clearTimeout(speakerTestTimeoutRef.current);
    
    const utterance = new SpeechSynthesisUtterance("Hello Jamil. This is a test of the AI clinic voice. Can you hear me clearly?");
    
    const voices = window.speechSynthesis.getVoices();
    // Select selected voice name if any
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

    utterance.onerror = (event) => {
      if (completed) return;
      completed = true;
      if (speakerTestTimeoutRef.current) clearTimeout(speakerTestTimeoutRef.current);
      speakerTestTimeoutRef.current = null;
      setTestAudioPlaying(false);
      toast.error(`Voice output check failed${event.error ? `: ${event.error}` : "."}`);
    };

    // Chromium can omit `onend` for system voices even though playback completed.
    // Release the hardware-check deadlock after the expected sample duration.
    speakerTestTimeoutRef.current = setTimeout(completeTest, 5000);
    window.speechSynthesis.speak(utterance);
  };

  // ---------------------------------------------------------------------------
  // PROVIDER-GRADE PRACTICE CALL ENGINE
  // ---------------------------------------------------------------------------
  const startPracticeCall = async () => {
    resetCallState();
    setCallState("configuring");
    setPracticeResponse("");
    setSpeechRecognitionUnavailable(false);
    setScenarioStepIndex(-1);
    setPracticeInterruptionCount(0);
    setCopilotSuggestion(PRACTICE_SCENARIOS.find((scenario) => scenario.id === practiceScenario)?.dialogueTree[0]?.copilotSuggestion ?? "Introduce yourself and explain the free directory verification.");
    setCopilotSource("ai");

    const tokenResponse = await fetch("/api/vapi/practice-token", { method: "POST" });
    const tokenData = await tokenResponse.json().catch(() => ({})) as { token?: string; error?: string };
    if (!tokenResponse.ok || !tokenData.token) {
      setCallState("idle");
      toast.error(tokenData.error ?? "Could not authorize the provider-grade practice call.");
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
      toast.success("Human-voice practice call connected through Vapi.");
    });
    vapi.on("local-volume-level", (volume) => setMicTestLevel(Math.min(100, Math.round(volume * 100))));
    vapi.on("speech-start", () => setIsClinicSpeaking(true));
    vapi.on("speech-end", () => setIsClinicSpeaking(false));
    vapi.on("message", (message) => {
      if (message?.type !== "transcript" || message?.transcriptType !== "final" || !message.transcript) return;
      const speaker = message.role === "assistant" ? "Clinic" : "Jamil";
      setTranscript((previous) => {
        const duplicate = previous.at(-1)?.speaker === speaker && previous.at(-1)?.text === message.transcript;
        return duplicate ? previous : [...previous, { speaker, text: message.transcript, timestamp: new Date().toISOString() }];
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
    vapi.on("error", () => {
      if (practiceConnectTimeoutRef.current) clearTimeout(practiceConnectTimeoutRef.current);
      practiceConnectTimeoutRef.current = null;
      setCallState("provider_unavailable");
      setSpeechRecognitionUnavailable(true);
      toast.error("Provider practice audio failed. Check microphone permission and Vapi account status.");
    });

    let practiceConnectionTimedOut = false;
    practiceConnectTimeoutRef.current = setTimeout(() => {
      if (callStateRef.current !== "configuring") return;
      practiceConnectionTimedOut = true;
      void vapi.stop();
      vapiPracticeRef.current = null;
      setCallState("provider_unavailable");
      setSpeechRecognitionUnavailable(true);
      toast.error("Practice audio could not access the microphone. Allow mic access in Chrome and try again.");
    }, 18000);

    try {
      const call = await vapi.start("practice");
      setProviderCallId(call?.id ?? null);
    } catch {
      if (practiceConnectTimeoutRef.current) clearTimeout(practiceConnectTimeoutRef.current);
      practiceConnectTimeoutRef.current = null;
      vapiPracticeRef.current = null;
      if (!practiceConnectionTimedOut) {
        setCallState("idle");
        toast.error("Could not start the provider-grade practice call.");
      }
    }
  };

  const speakPracticeText = (text: string) => {
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

  const startSpeechRecognition = async () => {
    try {
      // 1. Get user media stream if not already active
      let stream = micStreamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
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
        // Speaker Mode feedback loop prevention:
        if (isClinicSpeaking && !isHeadphonesMode) {
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
                handleManualTranscriptInput(spokenText);
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

      // 3. Web Audio stereo merger setup
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const micSource = audioCtx.createMediaStreamSource(micStream);
      const merger = audioCtx.createChannelMerger(2);
      micSource.connect(merger, 0, 0); // Jamil mic to Left channel (0)

      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
        remoteSource.connect(merger, 0, 1); // Clinic speaker to Right channel (1)
      }

      const dest = audioCtx.createMediaStreamDestination();
      merger.connect(dest);
      const stereoStream = dest.stream;

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

        // 5. Initialize MediaRecorder to stream raw audio in 250ms chunks
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
        // Speaker Mode feedback loop prevention:
        if (isClinicSpeaking && !isHeadphonesMode) {
          return;
        }

        try {
          const data = JSON.parse(event.data);
          const channelData = data.channel;
          const transcriptText = channelData?.alternatives?.[0]?.transcript;
          
          if (transcriptText && data.is_final) {
            const spokenText = transcriptText.trim();
            if (spokenText) {
              // Left channel index 0 matches Jamil, Right channel index 1 matches Clinic
              const channelIndex = data.channel_index ?? 0;
              const speaker = channelIndex === 0 ? "Jamil" : "Clinic";

              if (speaker === "Jamil") {
                if (isPracticeMode) {
                  handleUserSpeechInput(spokenText);
                } else {
                  handleManualTranscriptInput(spokenText);
                }
              } else {
                setTranscript((prev) => [
                  ...prev,
                  { speaker: "Clinic", text: spokenText, timestamp: new Date().toISOString() }
                ]);
              }
            }
          }
        } catch (e) {
          console.error("Error parsing Deepgram stereo transcript:", e);
        }
      };

      ws.onerror = (e) => console.error("Deepgram WebSocket error:", e);
      ws.onclose = () => console.log("Deepgram WebSocket closed.");

    } catch (err: any) {
      console.error("Deepgram stereo transcription setup failed:", err);
      toast.warning("Deepgram transcription failed. Real-time translation might be unavailable.");
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

    // Push operator text to transcript
    setTranscript((prev) => [...prev, { speaker: "Jamil", text, timestamp: new Date().toISOString() }]);

    // Trigger next dialogue turn from the scenario Dialogue Tree
    const scenario = PRACTICE_SCENARIOS.find((s) => s.id === practiceScenario) || PRACTICE_SCENARIOS[0];
    const nextStepIdx = scenarioStepIndex + 1;

    if (nextStepIdx < scenario.dialogueTree.length) {
      const nextTurnObj = scenario.dialogueTree[nextStepIdx];
      
      // Update step index
      setScenarioStepIndex(nextStepIdx);

      // Simulate a thinking delay (1-2s) before clinic responds
      setTimeout(() => {
        setTranscript((prev) => [...prev, { speaker: "Clinic", text: nextTurnObj.clinicSpeech, timestamp: new Date().toISOString() }]);
        speakPracticeText(nextTurnObj.clinicSpeech);
        updateCopilotSuggestions(nextStepIdx, scenario);
      }, 1200);
    } else {
      // Out of script turns: wrap up the call
      setTimeout(() => {
        const wrapUpText = "Okay Jamil, that sounds good. We are all set here. Goodbye!";
        setTranscript((prev) => [...prev, { speaker: "Clinic", text: wrapUpText, timestamp: new Date().toISOString() }]);
        speakPracticeText(wrapUpText);
        setCopilotSuggestion("Outreach target met. Click 'End Practice Call' to finalize.");
        setCopilotQuestion(null);
      }, 1500);
    }
  };

  const requestManualCopilot = async (conversation: { speaker: string; text: string }[]) => {
    if (!activeClinic) return;
    setCopilotLoading(true);
    try {
      const response = await fetch("/api/copilot/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicName: activeClinic.name,
          clinicContext: `${activeClinic.city ?? ""}, ${activeClinic.state ?? ""}. Services: ${(activeClinic.services ?? []).join(", ")}`,
          transcript: conversation.map((line) => `${line.speaker}: ${line.text}`).join("\n"),
          question: "What should Jamil say next to move this clinic toward a free verified directory listing?",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Copilot failed.");
      setCopilotSuggestion(payload.suggestion);
      setCopilotSource(payload.source === "field_guide" ? "field_guide" : "ai");
    } catch (error) {
      const latestClinicReply = conversation.at(-1)?.text ?? "";
      setCopilotSuggestion(manualFieldGuideResponse(latestClinicReply));
      setCopilotSource("field_guide");
      toast.info("Using the local field guide while the AI coaching provider is unavailable.");
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleManualTranscriptInput = (text: string) => {
    if (!text) return;
    const nextLine = { speaker: "Clinic", text, timestamp: new Date().toISOString() };
    setTranscript((previous) => {
      const next = [...previous, nextLine];
      void requestManualCopilot(next);
      return next;
    });
  };

  const updateCopilotSuggestions = (stepIdx: number, scenario: ScenarioConfig) => {
    const currentStep = scenario.dialogueTree[stepIdx];
    if (!currentStep) return;

    setActiveStage(currentStep.stage);
    setCopilotSuggestion(currentStep.copilotSuggestion);
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

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsClinicSpeaking(false);
  };

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
    if (vapiPracticeRef.current) {
      void vapiPracticeRef.current.stop();
      vapiPracticeRef.current = null;
    }
    if (practiceConnectTimeoutRef.current) {
      clearTimeout(practiceConnectTimeoutRef.current);
      practiceConnectTimeoutRef.current = null;
    }
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

    if (practiceConnectTimeoutRef.current) clearTimeout(practiceConnectTimeoutRef.current);
    practiceConnectTimeoutRef.current = null;
    
    setCallState("ended");
    stopSpeechRecognition();
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Save to Supabase setting environment to practice
    void persistCallSession({
      status: "ended",
      endedAt: new Date().toISOString(),
      durationSec: callDuration,
      callEnvironment: isPracticeMode ? "practice" : "live",
      structuredData: {
        isPractice: isPracticeMode,
        practiceScenario,
        practicePersona,
        practiceDifficulty,
        callQualityScore,
        speakingListeningRatio,
        interruptionCount: practiceInterruptionCount,
      }
    });
    toast.info(`Session ended · ${formatDuration(callDuration)}`);
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

  async function startCall() {
    if (startingCallRef.current || callState !== "idle") return;
    if (!activeClinic?.primaryPhone) {
      toast.error("Selected clinic has no phone number.");
      return;
    }

    resetCallState();
    startingCallRef.current = true;
    setCallState("configuring");
    setTranscript([]);
    setSpeechRecognitionUnavailable(false);
    setCopilotSuggestion("Hi, this is Jamil with Novalyte. I’m calling to verify a few details for your free clinic directory listing. Is now okay for a quick question?");
    setCopilotSource("opening");
    setCopilotQuestion("Confirm you reached the person who manages the clinic listing.");
    setActiveStage("intro");

    try {
      // 1. Capture user microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      });
      micStreamRef.current = stream;
      startMicVisualizer(stream);
      setMicTestPassed(true);
      isListeningRef.current = true;

      // 2. Fetch Telnyx WebRTC JWT Token
      const tokenRes = await fetch("/api/telephony/token");
      const tokenData = await tokenRes.json().catch(() => ({}));
      
      if (!tokenRes.ok || !tokenData.token) {
        console.warn("Telnyx credentials missing. Falling back to Simulated VoIP Mode.");
        toast.info("Telnyx configuration not found. Starting call in Simulated VoIP Mode.");
        
        setCallState("dialing");
        setTimeout(() => {
          setCallState("connected");
          toast.success("Simulated VoIP call connected. Speak naturally.");
          // Start browser single channel Deepgram translation
          void startSpeechRecognition();
        }, 1500);
        startingCallRef.current = false;
        return;
      }

      // 3. Initialize TelnyxRTC client (dynamic load to prevent SSR crashes)
      let client = telnyxClientRef.current;
      if (!client) {
        const { TelnyxRTC } = await import("@telnyx/webrtc");
        client = new TelnyxRTC({
          login_token: tokenData.token,
        });
        telnyxClientRef.current = client;

        client.on("telnyx.ready", () => {
          console.log("TelnyxRTC line registered.");
          toast.success("Telnyx softphone registered.");
        });

        client.on("telnyx.error", (err: any) => {
          console.error("Telnyx client error:", err);
          toast.error(`Telnyx connection error: ${err.message || "Line failed"}`);
        });

        client.connect();
      }

      // 4. Dial outbound clinic PSTN number
      const call = client.newCall({
        destinationNumber: activeClinic.primaryPhone,
        callerNumber: process.env.TELNYX_PHONE_NUMBER || "+16017168585",
      });
      telnyxCallRef.current = call;

      setCallState("dialing");

      call.on("active", () => {
        setCallState("connected");
        toast.success("VoIP call connected.");
        // Initialize Web Audio stereo merging and Deepgram WebSocket
        void startDeepgramStereoTranscription(call, stream);
      });

      call.on("hangup", () => {
        toast.info("Call disconnected.");
        stopSpeechRecognition();
        setCallState("ended");
      });

      call.on("error", (err: any) => {
        console.error("Telnyx Call error:", err);
        toast.error(`Call error: ${err.message || "Line issue"}`);
        stopSpeechRecognition();
        setCallState("failed");
      });

    } catch (err: any) {
      console.error("Outbound call initialization failed:", err);
      toast.warning("Telephony API failed. Checking backup visualizer route.");
      // Fallback to local audio simulator
      setCallState("connected");
      void startSpeechRecognition();
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
      notes: notes || `Practice Session log: ${outcomeConfig?.label || outcome}`,
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
      toast.success(isPracticeMode ? "Practice session scorecard saved." : "Live call logged.");
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
      try {
        const struct = JSON.parse(c.structuredData || "{}");
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

  return (
    <div className="space-y-4">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Founder Calling Cockpit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Call clinics from your phone while the silent copilot coaches and records outcomes
          </p>
        </div>

        {/* Operating Modes Selectors */}
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
                toast.success("Manual Phone Mode ready — you speak, AI coaches silently.");
              }}
              className={`text-xs px-2.5 py-1.5 rounded font-bold transition-all ${
                isLiveMode
                  ? "bg-emerald-600 text-white shadow-sm border border-emerald-700"
                  : "hover:bg-accent text-muted-foreground border border-transparent"
              }`}
            >
              Manual Phone Call
            </button>
            <button
              onClick={() => {
                if (callState !== "idle" && callState !== "ended") {
                  toast.error("Please end the active call before switching modes.");
                  return;
                }
                setIsPracticeMode(true);
                setIsLiveMode(false);
                toast.success("Switched to Practice Mode — AI Clinic Simulation.");
              }}
              className={`text-xs px-2.5 py-1.5 rounded font-bold transition-all ${
                isPracticeMode
                  ? "bg-indigo-600 text-white shadow-sm border border-indigo-700"
                  : "hover:bg-accent text-muted-foreground border border-transparent"
              }`}
            >
              Practice Roleplay
            </button>
          </div>
        </div>
      </div>

      {/* MODE LABEL WATERMARKS */}
      <div className={`p-2.5 rounded-lg border text-center text-xs font-bold uppercase tracking-widest transition-colors ${
        isPracticeMode
          ? "bg-indigo-50 border-indigo-200 text-indigo-800"
          : "bg-emerald-50 border-emerald-200 text-emerald-800"
      }`}>
        {isPracticeMode
          ? "PRACTICE ROLEPLAY — SIMULATED CLINIC"
          : "MANUAL PHONE MODE — YOUR VOICE · VERIZON CALL · SILENT AI COACH"}
      </div>

      {/* PERFORMANCE ANALYTICS BAR */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Total Live Calls" value={analyticsMetrics.count} icon={PhoneCall} tone="default" hint="Practice calls excluded" />
        <MetricCard label="Answer Rate" value={`${analyticsMetrics.answerRate}%`} icon={TrendingUp} tone="teal" hint="Calls connected" />
        <MetricCard label="Conversations" value={`${analyticsMetrics.convRate}%`} icon={Activity} tone="violet" hint="Decision maker reached" />
        <MetricCard label="Listing Permission" value={`${analyticsMetrics.permRate}%`} icon={Award} tone="green" hint="Of conversations" />
        <MetricCard label="Avg Duration" value={analyticsMetrics.avgDuration} icon={Clock} tone="amber" hint="Average call time" />
      </div>

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

      {/* MAIN LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT COLUMN: Queue & History List */}
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
              {isPracticeMode ? "PRACTICE" : "LIVE"}
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
                        <span className="font-semibold text-sm truncate">{clinic.name}</span>
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
                      <span className="font-medium truncate">{session.clinicName}</span>
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

        {/* CENTER COLUMN: Dialer, Configs, Live transcript */}
        <div className={`lg:col-span-6 flex flex-col gap-4 ${mobileTab !== "dialer" ? "hidden lg:flex" : ""}`}>

          {!isPracticeMode && callState === "idle" && activeClinic && (
            <Card className="p-4 border-emerald-200 bg-emerald-50/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-sm text-emerald-950">Use your Pixel on speakerphone</p>
                  <p className="text-xs text-emerald-800 mt-1">
                    Copy the clinic number, dial it from Verizon, place the phone near this computer, then start coaching.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    variant="outline"
                    disabled={!activeClinic.primaryPhone}
                    onClick={async () => {
                      await navigator.clipboard.writeText(activeClinic.primaryPhone ?? "");
                      toast.success("Clinic number copied. Dial it from your Pixel.");
                    }}
                    className="border-emerald-300 bg-white"
                  >
                    <Phone className="size-4" /> Copy {formatPhone(activeClinic.primaryPhone)}
                  </Button>
                  <Button onClick={startCall} disabled={!activeClinic.primaryPhone} className="bg-emerald-600 hover:bg-emerald-700">
                    <Mic className="size-4" /> Start Coaching
                  </Button>
                </div>
              </div>
            </Card>
          )}
          
          {/* CONFIGURATION PANEL FOR PRACTICE MODE */}
          {isPracticeMode && callState === "idle" && (
            <Card className="p-4 border-indigo-200 bg-indigo-50/10 space-y-3.5">
              <span className="font-bold text-sm flex items-center gap-1.5 text-indigo-950">
                <SlidersHorizontal className="size-4 text-indigo-600" /> Human-Voice Practice Roleplay
              </span>

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
          )}

          {/* DOCK DIALER CONSOLE CONTROLLER */}
          {activeClinic && (
            <Card className={`text-white p-4 shadow-xl flex flex-col gap-4 relative overflow-hidden transition-colors ${
              isPracticeMode ? "bg-slate-900 border-slate-950" : "bg-emerald-950 border-emerald-950"
            }`}>
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
                      <span className="text-xs font-bold tracking-wide uppercase">
                        {isPracticeMode ? "PRACTICE SIMULATION" : "MANUAL PHONE COACHING"}
                      </span>
                      <span className={`size-2 rounded-full ${
                        callState === "connected" ? "bg-emerald-500" : callState === "idle" ? "bg-slate-500" : "bg-amber-500"
                      }`} />
                    </div>
                    <p className="text-sm font-semibold tracking-wider font-mono mt-0.5">
                      {isPracticeMode ? `Simulating ${PRACTICE_PERSONAS.find(p => p.id === practicePersona)?.name}` : formatPhone(activeClinic.primaryPhone)}
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
                  {["idle", "ended", "failed", "provider_unavailable"].includes(callState) ? (
                    isPracticeMode ? (
                      <Button
                        onClick={startPracticeCall}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 h-11 rounded-lg flex items-center gap-2 shadow-lg"
                      >
                        <Mic className="size-4" /> START PRACTICE CALL
                      </Button>
                    ) : (
                      <Button
                        onClick={startCall}
                        disabled={startingCallRef.current}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 h-11 rounded-lg flex items-center gap-2 shadow-lg"
                      >
                        <Mic className="size-4" /> Start Coaching Session
                      </Button>
                    )
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
              {callState !== "idle" && callState !== "ended" && callState !== "failed" && callState !== "provider_unavailable" && (
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
                    onClick={() => {
                      setSpeakerEnabled(!speakerEnabled);
                      toast.info(speakerEnabled ? "Speaker muted" : "Speaker unmuted");
                    }}
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
                      {isPracticeMode ? "PRACTICE" : "VOIP APP"}
                    </span>
                  </div>
                </div>
              )}

              {/* Collapsible Keypad */}
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

          {/* SPEAKER-SEPARATED TRANSCRIPT PANEL (JAMIL VS CLINIC) */}
          {callState !== "idle" && (
            <Card className="flex-1 flex flex-col p-0 min-h-[320px] max-h-[390px] overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between shrink-0">
                <span className="text-sm font-bold flex items-center gap-1.5">
                  <Activity className="size-4 text-emerald-500 animate-pulse" /> Live Call Transcript
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">
                    Jamil (Operator)
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-slate-700 border-slate-200 bg-slate-50">
                    {isPracticeMode ? `AI ${PRACTICE_PERSONAS.find(p => p.id === practicePersona)?.role}` : "Clinic"}
                  </Badge>
                </div>
              </div>

              {/* Scrolling transcript turns */}
              <div className="flex-1 overflow-y-auto nv-scroll p-4 bg-muted/5 space-y-3">
                {transcript.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground text-xs p-6">
                    <Clock className="size-6 mb-1 text-slate-300 animate-pulse" />
                    Waiting for call connection...
                  </div>
                ) : (
                  transcript.map((line, idx) => {
                    const isJamil = line.speaker === "Jamil";
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col max-w-[85%] ${isJamil ? "ml-auto items-end" : "mr-auto items-start"}`}
                      >
                        <span className="text-[9px] text-muted-foreground font-semibold px-1 py-0.5 uppercase tracking-wide">
                          {line.speaker}
                        </span>
                        <div className={`p-2.5 rounded-lg text-sm mt-0.5 shadow-sm leading-relaxed ${
                          isJamil
                            ? "bg-indigo-600 text-white rounded-tr-none"
                            : "bg-card border text-foreground rounded-tl-none"
                        }`}>
                          {line.text}
                        </div>
                      </div>
                    );
                  })
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
                      aria-label={isPracticeMode ? "Practice response" : "Clinic response"}
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

        {/* RIGHT COLUMN: AI Copilot Coaching */}
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
                  {isPracticeMode ? "Sim Practice" : copilotSource === "ai" ? "Live AI" : copilotSource === "field_guide" ? "Field Guide" : "Opening"}
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

              {/* Suggestions */}
              <div className="space-y-3.5 text-xs">
                <div>
                  <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wide flex items-center gap-1">
                    <CheckCircle2 className="size-3.5 text-indigo-600" /> SAY THIS NEXT (Suggested Response)
                  </p>
                  <div className="bg-white border border-indigo-100 p-3 rounded-lg text-slate-800 italic font-medium mt-1 relative group shadow-sm leading-relaxed">
                    "{copilotSuggestion}"
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

                {copilotQuestion && (
                  <div>
                    <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wide">
                      Recommended Follow-Up Question
                    </p>
                    <p className="text-slate-800 bg-purple-50/20 border border-purple-100/60 p-2.5 rounded-lg font-medium mt-1 leading-relaxed">
                      {copilotQuestion}
                    </p>
                  </div>
                )}

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

        {/* FULL-WIDTH OUTCOME ROW: aligned beneath the 3 + 6 + 3 cockpit */}
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
                    {isPracticeMode ? "AI Practice Scorecard" : "Post-Call AI Summary"}
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
                {isPracticeMode ? "Save Practice Scorecard" : "Save Live Outcome"}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDuration(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
