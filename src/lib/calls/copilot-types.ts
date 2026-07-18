/** Shared types for founder call copilot conversation intelligence. */

export type QuestionIntent =
  | "confirm_call_purpose"
  | "ask_if_free"
  | "ask_if_sales"
  | "ask_for_email"
  | "ask_hipaa"
  | "busy_callback"
  | "decline"
  | "do_not_call"
  | "grant_permission"
  | "owner_unavailable"
  | "provide_info"
  | "ask_what_details"
  | "what_is_novalyte"
  | "source_of_info"
  | "how_directory_works"
  | "are_you_google"
  | "already_have_website"
  | "will_you_change_info"
  | "not_accepting_patients"
  | "smalltalk_or_greeting"
  | "unknown";

export type ExtractedClinicFacts = {
  phone?: string;
  services?: string;
  acceptingNewPatients?: boolean;
  permissionGranted: boolean;
  permissionDeclined: boolean;
  doNotCall?: boolean;
  rawClinicText: string;
};

export type ReasoningPolicy = {
  latest_speaker: "clinic" | "jamil" | "none";
  latest_utterance: string;
  is_direct_question: boolean;
  question_intent: QuestionIntent;
  unanswered_question_exists: boolean;
  allowed_next_action:
    | "answer_question"
    | "handle_objection"
    | "acknowledge_and_verify"
    | "collect_next_field"
    | "close_call";
  blocked_actions: string[];
};
