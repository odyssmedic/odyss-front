export type Student = {
  id: string;
  name: string;
  stage: string;
  academic_year?: number;
};
export type User = { student: Student; email: string };
export type PracticeAvailability = {
  published_cases: number;
  eligible_cases: number;
  max_questions_per_case: number;
  questions_per_case: number;
};
export type Item = {
  id: string;
  name: string;
  practice?: PracticeAvailability;
};
export type Page<T> = { items: T[]; limit: number; offset: number };
export type LearningRoute = {
  id: string;
  name: string;
  student_id: string;
  discipline_id: string;
  specialty_id: string;
  topic_id: string;
  archived: boolean;
};
export type SessionRow = {
  id: string;
  route_id: string;
  topic_id: string;
  status: "active" | "completed" | "cancelled";
  answered: number;
  total_questions: number;
  exp: number;
  created_at: string;
};
export type Axis = {
  correct?: number;
  recommend_reforcement?: boolean;
  competency: string;
  value: number | null;
  answers: number;
  evidence: string;
  difficulty: string;
};
export type Question = {
  guidance?: string[];
  id: string;
  prompt: string;
  competency: string;
  difficulty: string;
  options: { id: string; text: string }[];
};
export type NeuralEvidence = {
  status: string;
  model_version?: string;
  training_source?: string;
  changed_selection?: boolean;
  message?: string;
};
export type Recommendation = {
  neural?: NeuralEvidence;
  candidate_count: number;
  case_selection?: {
    candidate_count: number;
    reason: string;
    neural?: NeuralEvidence;
  };
};
export type Practice = SessionRow & {
  session_metrics?: Axis[];
  recommendation: Recommendation | null;
  student_id: string;
  current_question: Question | null;
  current_case: {
    id: string;
    title: string;
    demo: boolean;
    content_kind?: string;
    clinical_review_status?: string;
    initial_context: string;
    context_blocks: { id: string; text: string }[];
  } | null;
  competencies: Axis[];
};
export type Answer = {
  source?: string;
  correct: boolean;
  feedback: string;
  explanation: string;
  exp_gained: number;
  session: Practice;
  pearls: string[];
};
export type Summary = {
  case_results?: { case_id: string; title: string; competencies: Axis[] }[];
  content_kind?: string;
  clinical_review_status?: string;
  session_id: string;
  status: string;
  answers: number;
  correct: number;
  incorrect: number;
  exp_gained: number;
  competencies: Axis[];
  completed_cases: { case_id: string; pearls: string[] }[];
};
