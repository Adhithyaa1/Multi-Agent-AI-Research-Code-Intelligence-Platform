export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
}

export interface UploadResponse {
  filename: string;
  path: string;
  size: number;
  documentId?: string;
  chunkCount?: number;
  ingested?: boolean;
  ingestError?: string;
}

export interface ActiveDocument {
  documentId: string;
  filename: string;
  chunkCount: number;
}

export interface ActiveRepo {
  repoId: string;
  name: string;
  fileCount: number;
  indexed: boolean;
  files: string[];
  indexedChunks?: number | null;
}

export interface RetrievedChunk {
  text: string;
  score: number | null;
  metadata: Record<string, unknown>;
}

export type ChatErrorCode =
  | "network"
  | "empty_response"
  | "ollama_unavailable"
  | "rag_unavailable"
  | "invalid_request"
  | "server_error";

export interface ChatErrorResponse {
  error: string;
  code: ChatErrorCode;
}

export interface ResearchNotes {
  question: string;
  important_concepts: string[];
  evidence: string[];
  limitations: string[];
  future_work: string[];
  summary: string;
  grounded_in_document: boolean;
  document_id: string | null;
}

export interface AgentTraceStep {
  agent: string;
  status: string;
  summary: string;
  duration_ms: number;
}

export interface PipelineResult {
  question: string;
  document_id: string | null;
  grounded_in_document: boolean;
  tasks: string[];
  plan_summary: string;
  research_notes: Record<string, unknown>;
  code_analysis: Record<string, unknown>;
  critique: Record<string, unknown>;
  final_report: {
    title?: string;
    report?: string;
    summary?: string;
  };
  trace: AgentTraceStep[];
}

export interface CodeRepoInfo {
  repoId: string;
  name: string;
  fileCount: number;
  files: string[];
}

export interface RepoComponent {
  name: string;
  files: string[];
  description: string;
}

export interface RepoMapResult {
  repo_id: string;
  project_name: string;
  components: RepoComponent[];
  summary: string;
}

export interface CodeBugIssue {
  line?: number;
  severity?: string;
  description?: string;
  suggestion?: string;
}

export interface CodeSuggestion {
  title?: string;
  description?: string;
  impact?: string;
}

export interface CodeAnalysisResult {
  mode: "explain" | "bugs" | "improve";
  file: string;
  summary: string;
  key_elements?: string[];
  data_flow?: string;
  dependencies?: string[];
  issues?: CodeBugIssue[];
  suggestions?: CodeSuggestion[];
  raw?: string;
}

export interface CodeAskResult {
  question: string;
  answer: string;
  sources: string[];
  confidence: string;
  limitations: string;
  retrieved_chunks: number;
  retrieved?: RetrievedChunk[];
}

export interface EvalTypeStats {
  count: number;
  avg_duration_ms: number;
}

export interface EvalRun {
  id: string;
  type: string;
  duration_ms: number;
  success: boolean;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface EvalMetrics {
  total_runs: number;
  recent_runs: EvalRun[];
  by_type: Record<string, EvalTypeStats>;
  avg_duration_ms: number;
  critic_confidence_avg: number | null;
}
