/**
 * Declarative assessment question shapes for Campaign Studio editing.
 * showIf is JSON-serializable (engine functions are compiled at runtime).
 */

export type EditableQuestionType =
  | "single"
  | "multi"
  | "text"
  | "contact-name"
  | "contact-email"
  | "contact-location"
  | "consent";

export type ShowIfRule = {
  questionId: string;
  op: "eq" | "neq" | "includes" | "truthy";
  value?: string | string[] | boolean;
};

export type EditableQuestion = {
  id: string;
  type: EditableQuestionType;
  title: string;
  desc?: string;
  required?: boolean;
  options?: { value: string; label: string; desc?: string }[];
  placeholder?: string;
  stage?: string;
  whyWeAsk?: string;
  signal?: "timeline" | "selfpay" | "experience" | "consent" | "contact";
  showIf?: ShowIfRule;
};

export type AssessmentQuestionsConfig = {
  engine_slug?: string;
  mode?: string;
  questions: EditableQuestion[];
};

const CORE_CONTACT: EditableQuestion[] = [
  {
    id: "contact_name",
    type: "contact-name",
    title: "What is your name?",
    required: true,
    stage: "info",
    signal: "contact",
  },
  {
    id: "contact_email",
    type: "contact-email",
    title: "How can we reach you?",
    required: true,
    stage: "info",
    signal: "contact",
  },
  {
    id: "contact_location",
    type: "contact-location",
    title: "Where are you located?",
    required: true,
    stage: "info",
    signal: "contact",
  },
];

const CORE_CONSENT: EditableQuestion = {
  id: "consent",
  type: "consent",
  title: "Consent",
  required: true,
  stage: "review",
  signal: "consent",
  desc: "I understand this assessment is informational only and is not medical advice, diagnosis, or treatment.",
};

function goalQuestion(treatmentLabel: string): EditableQuestion {
  return {
    id: "goal",
    type: "multi",
    title: `What are your ${treatmentLabel} goals?`,
    required: true,
    stage: "goals",
    options: [
      { value: "energy", label: "Improve energy and focus" },
      { value: "symptoms", label: "Address specific symptoms" },
      { value: "optimize", label: "Optimize overall wellness" },
      { value: "explore", label: "Explore options and learn more" },
    ],
  };
}

function careFormatQuestion(): EditableQuestion {
  return {
    id: "care_format",
    type: "single",
    title: "What care format do you prefer?",
    required: true,
    stage: "preferences",
    options: [
      { value: "telehealth", label: "Telehealth" },
      { value: "in-person", label: "In-person" },
      { value: "hybrid", label: "Either / hybrid" },
      { value: "unsure", label: "Not sure yet" },
    ],
  };
}

function timelineQuestion(): EditableQuestion {
  return {
    id: "timeline",
    type: "single",
    title: "When would you like to speak with a clinic?",
    required: true,
    stage: "timing",
    signal: "timeline",
    options: [
      { value: "asap", label: "As soon as possible" },
      { value: "2-weeks", label: "Within 2 weeks" },
      { value: "1-month", label: "Within a month" },
      { value: "researching", label: "Still researching" },
    ],
  };
}

function selfPayQuestion(): EditableQuestion {
  return {
    id: "self_pay",
    type: "single",
    title: "Are you open to self-pay options?",
    required: false,
    stage: "timing",
    signal: "selfpay",
    options: [
      { value: "yes", label: "Yes" },
      { value: "insurance-first", label: "Prefer insurance first" },
      { value: "unsure", label: "Not sure" },
    ],
    showIf: { questionId: "timeline", op: "neq", value: "researching" },
  };
}

/** Default editable catalogs by assessment engine slug. */
export const DEFAULT_QUESTION_CATALOGS: Record<string, EditableQuestion[]> = {
  "testosterone-replacement-therapy": [
    ...CORE_CONTACT,
    goalQuestion("testosterone care"),
    careFormatQuestion(),
    timelineQuestion(),
    selfPayQuestion(),
    CORE_CONSENT,
  ],
  "erectile-dysfunction": [
    ...CORE_CONTACT,
    goalQuestion("sexual health"),
    careFormatQuestion(),
    timelineQuestion(),
    selfPayQuestion(),
    CORE_CONSENT,
  ],
  "medical-weight-loss": [
    ...CORE_CONTACT,
    goalQuestion("weight management"),
    careFormatQuestion(),
    timelineQuestion(),
    selfPayQuestion(),
    CORE_CONSENT,
  ],
  "longevity-medicine": [
    ...CORE_CONTACT,
    goalQuestion("longevity"),
    careFormatQuestion(),
    timelineQuestion(),
    selfPayQuestion(),
    CORE_CONSENT,
  ],
  "glp-1": [
    ...CORE_CONTACT,
    goalQuestion("GLP-1 programs"),
    careFormatQuestion(),
    timelineQuestion(),
    selfPayQuestion(),
    CORE_CONSENT,
  ],
  "peptide-therapy": [
    ...CORE_CONTACT,
    goalQuestion("peptide therapy"),
    careFormatQuestion(),
    timelineQuestion(),
    selfPayQuestion(),
    CORE_CONSENT,
  ],
  "hair-restoration": [
    ...CORE_CONTACT,
    goalQuestion("hair restoration"),
    careFormatQuestion(),
    timelineQuestion(),
    selfPayQuestion(),
    CORE_CONSENT,
  ],
  "hormone-optimization": [
    ...CORE_CONTACT,
    goalQuestion("hormone optimization"),
    careFormatQuestion(),
    timelineQuestion(),
    selfPayQuestion(),
    CORE_CONSENT,
  ],
};

export function defaultQuestionsForEngine(engineSlug: string): EditableQuestion[] {
  return (
    DEFAULT_QUESTION_CATALOGS[engineSlug] ??
    DEFAULT_QUESTION_CATALOGS["hormone-optimization"] ??
    [...CORE_CONTACT, goalQuestion("care"), careFormatQuestion(), timelineQuestion(), CORE_CONSENT]
  ).map((q) => ({ ...q, options: q.options?.map((o) => ({ ...o })) }));
}

export function questionsFromVersionConfig(
  config: Record<string, unknown> | null | undefined,
  engineSlug: string,
): EditableQuestion[] {
  const raw = config?.questions;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw as EditableQuestion[];
  }
  return defaultQuestionsForEngine(engineSlug);
}

export function syncQuestionIdArrays(questions: EditableQuestion[]) {
  const question_ids = questions.map((q) => q.id);
  const required_question_ids = questions.filter((q) => q.required).map((q) => q.id);
  const optional_question_ids = questions.filter((q) => !q.required).map((q) => q.id);
  return { question_ids, required_question_ids, optional_question_ids };
}
