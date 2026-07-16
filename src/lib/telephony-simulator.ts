/**
 * Telephony and AI Voice Copilot Simulator
 * 
 * Simulates a realistic outbound clinic acquisition call. Emits events for:
 * - Call state transitions (idle, dialing, ringing, connected, hold, ended)
 * - Real-time transcription turns (You vs. Clinic)
 * - Dynamic Talk Track (script stage transitions)
 * - Qualification checklist verifications (completed in real-time)
 * - AI Voice Copilot recommendations (objections, responses, facts, warnings)
 */

export interface SimulatorEvent {
  type: "status" | "transcript" | "copilot" | "checklist" | "stage" | "duration";
  payload: any;
}

export interface DialogueTurn {
  timeSec: number;
  speaker: "you" | "clinic";
  text: string;
  stage: "intro" | "discovery" | "objections" | "agreement" | "closing";
  checklistChecked?: string[]; // IDs of checklist items verified in this turn
  copilot?: {
    suggestion: string;
    question: string;
    objectionGuidance?: string;
    facts?: string[];
    warning?: string;
    nextAction: string;
  };
}

export const SIMULATOR_DIALOGUE: DialogueTurn[] = [
  {
    timeSec: 3,
    speaker: "clinic",
    text: "Hello, Summit Vitality Clinic, this is Priya. How can I help you today?",
    stage: "intro",
    copilot: {
      suggestion: "Introduce yourself, state your company name (Novalyte), and verify Dr. Cole's status.",
      question: "Confirm if Dr. Marcus Cole is still the Medical Director at Summit Vitality.",
      facts: ["Clinic Name: Summit Vitality Clinic", "Primary contact: Priya (Practice Manager)"],
      nextAction: "Verify decision-maker.",
    }
  },
  {
    timeSec: 10,
    speaker: "you",
    text: "Hi Priya, this is Devon from Novalyte. We are verifying listing details for Summit Vitality Clinic in our Men's Health Patient Directory. I wanted to check if Dr. Marcus Cole is still the Medical Director?",
    stage: "intro",
    checklistChecked: ["q3"], // Verified clinic name
  },
  {
    timeSec: 16,
    speaker: "clinic",
    text: "Yes, Dr. Cole is our Medical Director. But what directory are you talking about? We didn't sign up for any directory.",
    stage: "objections",
    copilot: {
      suggestion: "Explain that this is a free, high-intent national patient matching directory with no sign-up costs.",
      question: "Would it be okay to verify your address so we can route patients correctly?",
      objectionGuidance: "Objection: 'We didn't sign up'. Response: 'No worries! It's our national patient matching directory. It is completely free for clinics, and we just want to ensure your profile is accurate for incoming patients.'",
      facts: ["Decision-maker confirmed: Dr. Cole", "Clinic has not explicitly signed up before"],
      nextAction: "Address sign-up objection and move to location verification.",
    }
  },
  {
    timeSec: 25,
    speaker: "you",
    text: "No worries at all, Priya! This is our national patient matching directory. It is completely free for clinics, and we just want to ensure your profile is accurate so we route patients in the Austin area to you correctly.",
    stage: "objections",
    checklistChecked: ["q2"], // Listing contact name and role confirmed
  },
  {
    timeSec: 32,
    speaker: "clinic",
    text: "Oh, okay. I see. If it is free, I guess that is fine. What other details do you need to verify?",
    stage: "discovery",
    copilot: {
      suggestion: "Verify the main location address and check what services they offer (e.g., TRT and Peptide therapy).",
      question: "Confirm your main address is 1201 Congress Ave, and if you offer telehealth?",
      facts: ["Clinic offers TRT, Peptide therapy, and Telehealth (from website research)"],
      nextAction: "Verify address and services.",
    }
  },
  {
    timeSec: 42,
    speaker: "you",
    text: "Perfect. I have your main office address down as 1201 Congress Ave, Austin. Is that correct? And do you offer TRT, Peptide Therapy, and Telehealth at this location?",
    stage: "discovery",
    checklistChecked: ["q4"], // Address verified
  },
  {
    timeSec: 49,
    speaker: "clinic",
    text: "Yes, 1201 Congress Ave is correct. We offer TRT, Peptide Therapy, and IV hydration. We also do telehealth visits for Texas residents.",
    stage: "discovery",
    checklistChecked: ["q5", "q7"], // Telehealth and services confirmed
    copilot: {
      suggestion: "Acknowledge the services. Ask about how patients book appointments (URL or phone).",
      question: "Do patients book appointments via your website, or do they call in?",
      nextAction: "Confirm booking process.",
    }
  },
  {
    timeSec: 58,
    speaker: "you",
    text: "Awesome, I've updated our system to show you offer TRT, Peptides, and Telehealth. How do patients typically book appointments with you? Do you have an online booking URL?",
    stage: "discovery",
  },
  {
    timeSec: 65,
    speaker: "clinic",
    text: "They can book on our website at summitvitality.com/book, or just call us here.",
    stage: "discovery",
    checklistChecked: ["q6"], // Booking URL verified
    copilot: {
      suggestion: "Great. Now request explicit permission to publish the listing on our active directory.",
      question: "May we list Summit Vitality as verified in the Novalyte directory?",
      warning: "Important: You must obtain explicit permission to list the clinic before wrapping up.",
      nextAction: "Get listing permission.",
    }
  },
  {
    timeSec: 74,
    speaker: "you",
    text: "Perfect, summitvitality.com/book. Now, Priya, to send patients your way, we just need your permission to list Summit Vitality as verified in the directory. Is it okay to keep your profile active?",
    stage: "agreement",
  },
  {
    timeSec: 81,
    speaker: "clinic",
    text: "Yes, you have my permission to list us, as long as there are no monthly fees or hidden charges.",
    stage: "agreement",
    checklistChecked: ["q1"], // Permission to list granted!
    copilot: {
      suggestion: "Confirm the basic directory profile is free forever, and get her direct email to send the verified link.",
      question: "What is the best email address to send your verified listing link to?",
      facts: ["Listing permission GRANTED"],
      nextAction: "Get email address.",
    }
  },
  {
    timeSec: 90,
    speaker: "you",
    text: "Absolutely, basic listing is 100% free forever. What is the best email to send your verified directory link to, so you can inspect your profile?",
    stage: "agreement",
  },
  {
    timeSec: 96,
    speaker: "clinic",
    text: "You can send it to priya@summitvitality.com. And please follow up with us next month to see how it's going.",
    stage: "closing",
    copilot: {
      suggestion: "Thank Priya, confirm the email is priya@summitvitality.com, and schedule a follow-up task for next month.",
      question: "Conclude the call and wish her a great day.",
      nextAction: "End call and log follow-up.",
    }
  },
  {
    timeSec: 105,
    speaker: "you",
    text: "Got it, priya@summitvitality.com. I will send that over immediately and set a reminder to follow up in mid-August. Thank you so much for your time, Priya. Have a wonderful day!",
    stage: "closing",
    checklistChecked: ["q12"], // Follow-up owner and date agreed
  },
  {
    timeSec: 111,
    speaker: "clinic",
    text: "You too, Devon. Thanks! Bye-bye.",
    stage: "closing",
    copilot: {
      suggestion: "The call has concluded. Click 'End Call' to wrap up and log the call session.",
      question: "End the call.",
      nextAction: "Complete call logging.",
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
    // Start call duration tracking
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
        speaker: nextTurn.speaker,
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
  }

  private emit(type: SimulatorEvent["type"], payload: any) {
    this.onEvent({ type, payload });
  }

  public getDuration() {
    return this.elapsedSeconds;
  }
}
