export type KnowledgeCategory =
  | "company_identity"
  | "clinic_directory"
  | "clinic_outreach"
  | "patient_acquisition"
  | "clinic_services"
  | "qualification"
  | "objection_handling"
  | "compliance";

export type KnowledgeApprovalStatus = "approved" | "draft" | "outdated" | "rejected" | "internal";

export type CopilotResponseType =
  | "answer"
  | "question"
  | "objection_handling"
  | "clarification"
  | "transition"
  | "close";

export type CopilotCallStage =
  | "opening"
  | "purpose"
  | "permission"
  | "verification"
  | "qualification"
  | "follow_up"
  | "closing";

export interface KnowledgeEntrySeed {
  id: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  tags: string[];
  keywords: string[];
  callStages: string[];
  sourceFile: string;
  sourceSection: string;
  externalApproved: boolean;
  confidence: number;
}

export interface RetrievedKnowledgeChunk {
  id: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  source: string;
  section: string;
  score: number;
  confidence: number;
}

export interface CopilotStructuredResponse {
  suggested_response: string;
  response_type: CopilotResponseType;
  call_stage: CopilotCallStage;
  reason: string;
  knowledge_sources: Array<{ title: string; source: string; section: string }>;
  suggested_next_action: string;
  confidence: number;
  grounding_status: "grounded" | "partial" | "low_confidence" | "no_knowledge" | "conflict";
}

export interface CopilotFeedbackRating {
  rating:
    | "helpful"
    | "not_helpful"
    | "incorrect"
    | "too_long"
    | "too_aggressive"
    | "repetitive"
    | "not_relevant"
    | "factually_inaccurate"
    | "used_successfully"
    | "edited_before_speaking";
}
