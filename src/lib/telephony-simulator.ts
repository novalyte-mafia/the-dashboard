/**
 * Human-Led Telephony and AI Voice Copilot Simulator
 * 
 * Simulates an outbound clinic call where you (Jamil) speak to the clinic (Martha).
 * The AI Copilot silently listens, transcribes both sides, tracks checklist items,
 * and updates suggested responses and private coaching alerts on screen.
 */

export interface SimulatorEvent {
  type: "status" | "transcript" | "copilot" | "checklist" | "stage" | "duration" | "metrics";
  payload: any;
}

export interface DialogueTurn {
  timeSec: number;
  speaker: "you" | "clinic";
  text: string;
  stage: "intro" | "permission" | "directory" | "qualification" | "agreement" | "objections" | "interest" | "scheduling" | "closing";
  checklistChecked?: string[]; // IDs of checklist items verified in this turn
  copilot?: {
    suggestion: string;
    question: string;
    objectionGuidance?: string;
    facts?: string[];
    warning?: string;
    nextAction: string;
    speakingPace?: string; // e.g. "Good pace (135 WPM)"
    interruptionWarning?: boolean; // True if operator interrupted clinic
  };
}

export const SIMULATOR_DIALOGUE: DialogueTurn[] = [
  {
    timeSec: 3,
    speaker: "clinic",
    text: "Hello, Summit Vitality Clinic, this is Martha. How can I help you?",
    stage: "intro",
    copilot: {
      suggestion: "Hello, Martha. This is Jamil with Novalyte. I wanted to verify your clinic's listing details.",
      question: "Verify if you are speaking with the correct clinic representative (Martha).",
      facts: ["Clinic Name: Summit Vitality Clinic", "Answered by: Martha"],
      nextAction: "Introduce yourself & state purpose.",
      speakingPace: "Good (130 WPM)",
    }
  },
  {
    timeSec: 10,
    speaker: "you",
    text: "Hello, Martha. This is Jamil with Novalyte. I hope you're having a good day. I'm calling to verify some of the listing details for Summit Vitality Clinic in our national directory.",
    stage: "intro",
    checklistChecked: ["q3"], // Clinic name and phone verified
  },
  {
    timeSec: 16,
    speaker: "clinic",
    text: "Oh, hi Jamil. Yes, this is Summit Vitality. I am the Practice Manager. What directory are you referring to? We didn't sign up for anything.",
    stage: "directory",
    checklistChecked: ["q2"], // Contact name & role confirmed (Martha, PM)
    copilot: {
      suggestion: "No worries! It's the Novalyte Men's Health Directory. We list clinics for free to help local patients find care. Can I explain how it works?",
      question: "Request permission to continue and explain the directory.",
      objectionGuidance: "Objection: 'We didn't sign up'. Response: Reassure them that listings are free and meant for patient routing, with no billing or strings attached.",
      facts: ["Martha is the Practice Manager", "Decision-maker Marcus Cole works at this location"],
      nextAction: "Get permission to explain directory.",
      speakingPace: "Good (135 WPM)"
    }
  },
  {
    timeSec: 25,
    speaker: "you",
    text: "No worries at all, Martha! It's the Novalyte Men's Health Directory. We list clinics for free in the Austin area so local patients looking for hormone optimization and TRT can find care. I just wanted to get your permission to explain how this works and confirm your details?",
    stage: "permission",
  },
  {
    timeSec: 32,
    speaker: "clinic",
    text: "Okay, go ahead. If it's free, I can give you a couple of minutes.",
    stage: "directory",
    copilot: {
      suggestion: "Thank her. Explain that we match high-intent patients looking for TRT and Peptide therapy to qualified clinics.",
      question: "Verify if your main address is 1201 Congress Ave and if you offer telehealth?",
      facts: ["Directory explanation provided", "Permission to explain granted"],
      nextAction: "Qualify clinic services and locations.",
      speakingPace: "Pace is a bit fast (155 WPM). Try to slow down."
    }
  },
  {
    timeSec: 40,
    speaker: "you",
    text: "Thank you, Martha. We match patients in Austin who are looking for specialized hormone therapy directly to providers. I have your main office address down as 1201 Congress Ave, Austin. Is that correct? And do you offer TRT and Peptide therapy at this location?",
    stage: "qualification",
    checklistChecked: ["q4"], // Address verified
  },
  {
    timeSec: 47,
    speaker: "clinic",
    text: "Yes, 1201 Congress Ave is correct. We offer TRT, Peptide therapy, and IV hydration. We also support telehealth visits for residents of Texas.",
    stage: "qualification",
    checklistChecked: ["q5"], // Services verified
    copilot: {
      suggestion: "Great! Do patients book appointments on your website, or do they call in? And can we include your booking link in the directory?",
      question: "Ask for permission to list their booking URL.",
      facts: ["Offers TRT, Peptides, IV, and Telehealth"],
      nextAction: "Verify booking link.",
      speakingPace: "Good (130 WPM)"
    }
  },
  {
    timeSec: 56,
    speaker: "you",
    text: "That's fantastic. I've noted down that you offer TRT, Peptides, and Telehealth. How do patients typically book appointments with you? Do you have an online booking link we could feature in your profile?",
    stage: "qualification",
  },
  {
    timeSec: 62,
    speaker: "clinic",
    text: "Yes, they can go to summitvitality.com/book. It's fully online.",
    stage: "qualification",
    checklistChecked: ["q6", "q7"], // Booking URL & Accepting patients confirmed
    copilot: {
      suggestion: "Awesome, summitvitality.com/book. Martha, would it be okay if we list Summit Vitality as verified in the directory so we can start matching patients to you?",
      question: "Request explicit permission to list the clinic in the directory.",
      warning: "Ensure you ask for explicit directory permission before concluding the call.",
      nextAction: "Get directory permission.",
      speakingPace: "Good (135 WPM)"
    }
  },
  {
    timeSec: 72,
    speaker: "you",
    text: "Perfect, summitvitality.com/book. I've updated your booking URL. Now, Martha, to send patients your way, we just need your permission to list Summit Vitality as a verified clinic in the directory. Is it okay to activate your profile?",
    stage: "agreement",
  },
  {
    timeSec: 78,
    speaker: "clinic",
    text: "Wait, is this really free? Are there any hidden fees or commission percentages later on?",
    stage: "objections",
    copilot: {
      suggestion: "The basic directory listing is free forever. We only charge if you choose to receive premium guaranteed patient leads later. Is it alright if we list you?",
      question: "Address pricing concerns and re-ask for directory listing permission.",
      objectionGuidance: "Objection: 'Hidden fees'. Response: State clearly that the directory profile is 100% free forever. Explain that paid packages are entirely optional and only apply to guaranteed lead generation.",
      nextAction: "Re-confirm directory permission.",
      speakingPace: "Good (130 WPM)"
    }
  },
  {
    timeSec: 86,
    speaker: "you",
    text: "That is a great question. The basic directory profile is 100% free forever, and there are no commissions. We only offer paid subscriptions if you want to receive extra, guaranteed patient leads down the line, but that is completely optional. Is it alright to publish the free listing?",
    stage: "agreement",
  },
  {
    timeSec: 93,
    speaker: "clinic",
    text: "Yes, that sounds fine. You have my permission to list us as verified.",
    stage: "interest",
    checklistChecked: ["q1"], // Permission to list granted!
    copilot: {
      suggestion: "Thank Martha. Get her direct email to send the confirmation link, and set a brief check-in follow-up next month.",
      question: "Ask for direct email to send the directory link.",
      facts: ["Permission to list GRANTED"],
      nextAction: "Get email and schedule follow-up.",
      speakingPace: "Good (125 WPM)"
    }
  },
  {
    timeSec: 101,
    speaker: "you",
    text: "Awesome, Martha. Thank you! I'll publish the verified badge immediately. What is the best email to send your verified directory profile link to, so you can check how it looks?",
    stage: "scheduling",
  },
  {
    timeSec: 107,
    speaker: "clinic",
    text: "You can send it to martha@summitvitality.com. You can follow up with us next month to see how many patients clicked it.",
    stage: "scheduling",
    checklistChecked: ["q12"], // Follow-up owner and date agreed
    copilot: {
      suggestion: "Perfect, martha@summitvitality.com. I will send that email now and schedule a check-in for next month. Thank you so much for your help!",
      question: "Conclude the conversation and wish her a great day.",
      nextAction: "Conclude call.",
      speakingPace: "Good (130 WPM)"
    }
  },
  {
    timeSec: 115,
    speaker: "you",
    text: "Excellent, martha@summitvitality.com. I will email that link over immediately and schedule our follow-up check-in for mid-August. Thank you so much for your time today, Martha. Have a wonderful day!",
    stage: "closing",
  },
  {
    timeSec: 121,
    speaker: "clinic",
    text: "Thanks, Jamil. You too! Bye-bye.",
    stage: "closing",
    copilot: {
      suggestion: "The call has ended. Click 'Hang Up' to review metrics and log this call session.",
      question: "End the call.",
      nextAction: "Hang up.",
      speakingPace: "Good (130 WPM)"
    }
  }
];

export class TelephonySimulator {
  private timer: NodeJS.Timeout | null = null;
  private durationInterval: NodeJS.Timeout | null = null;
  private onEvent: (event: SimulatorEvent) => void;
  private elapsedSeconds = 0;
  private isPaused = false;
  private currentTurnIndex = 0;

  constructor(onEvent: (event: SimulatorEvent) => void) {
    this.onEvent = onEvent;
  }

  public start() {
    this.isPaused = false;
    
    // Status: Dialing (1.5s) -> Ringing (2s) -> Connected
    this.emit("status", "dialing");
    
    setTimeout(() => {
      if (this.isPaused) return;
      this.emit("status", "ringing");
      
      setTimeout(() => {
        if (this.isPaused) return;
        this.emit("status", "connected");
        this.startTimer();
      }, 2000);
    }, 1500);
  }

  private startTimer() {
    this.durationInterval = setInterval(() => {
      if (this.isPaused) return;
      this.elapsedSeconds += 1;
      this.emit("duration", this.elapsedSeconds);
      this.checkDialogueTimeline();
    }, 1000);
  }

  private checkDialogueTimeline() {
    if (this.currentTurnIndex >= SIMULATOR_DIALOGUE.length) return;
    
    const nextTurn = SIMULATOR_DIALOGUE[this.currentTurnIndex];
    if (this.elapsedSeconds >= nextTurn.timeSec) {
      // Emit transcript turn
      this.emit("transcript", {
        speaker: nextTurn.speaker === "you" ? "Jamil" : "Clinic",
        text: nextTurn.text,
        timestamp: new Date().toISOString()
      });

      // Emit stage change if needed
      this.emit("stage", nextTurn.stage);

      // Emit checklist updates if any
      if (nextTurn.checklistChecked) {
        this.emit("checklist", nextTurn.checklistChecked);
      }

      // Emit Copilot AI updates if any
      if (nextTurn.copilot) {
        this.emit("copilot", nextTurn.copilot);
      }

      this.currentTurnIndex++;
    }
  }

  public pause() {
    this.isPaused = true;
    this.emit("status", "on_hold");
    if (this.durationInterval) clearInterval(this.durationInterval);
  }

  public resume() {
    this.isPaused = false;
    this.emit("status", "connected");
    this.startTimer();
  }

  public stop() {
    this.isPaused = true;
    this.emit("status", "ended");
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Emit final metrics for logging when the call ends
    this.emit("metrics", {
      speakingListeningRatio: "54:46", // 54% Jamil, 46% Clinic WPM breakdown
      callQualityScore: 92,
      aiCoachingFeedback: "Excellent pacing and objection handling. Consistently hit your directory listing targets. Warning: You spoke slightly fast at 40s when qualifying, but adjusted well. Interruption count: 0."
    });
  }

  private emit(type: SimulatorEvent["type"], payload: any) {
    this.onEvent({ type, payload });
  }

  public getDuration() {
    return this.elapsedSeconds;
  }
}
