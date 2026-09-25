// ============================================================
// CORE TYPES - Modular Local Hybrid AI Agent
// ============================================================

export type Modality = 'text' | 'audio' | 'image' | 'video' | 'screen' | 'document' | 'event';
export type RoutePath = 'direct_response' | 'direct_tool' | 'layered_tool' | 'qwen' | 'clarification' | 'confirmation';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AgentStatus = 'idle' | 'listening' | 'thinking' | 'executing' | 'verifying' | 'error';
export type ModelType = 'decision' | 'reasoning' | 'vision' | 'audio';

// Input Pipeline
export interface InputEvent {
  id: string;
  timestamp: number;
  modality: Modality;
  content: string;
  metadata: Record<string, unknown>;
}

export interface NormalizedRequest {
  request_id: string;
  text: string;
  modality: Modality;
  attachments: Attachment[];
  context: Record<string, unknown>;
  source: string;
  partial?: boolean;
}

export interface Attachment {
  type: string;
  data: string;
  metadata?: Record<string, unknown>;
}

// Routing
export interface RouteDecision {
  path: RoutePath;
  domain: string;
  tool: string | null;
  confidence: number;
  requires_qwen: boolean;
  risk: RiskLevel;
  multi_step: boolean;
  reasoning_required: boolean;
}

// Laya Decision
export interface LayaDecision {
  tool_required: boolean;
  browser_required: boolean;
  reasoning_required: boolean;
  risk: RiskLevel;
  multi_step: boolean;
  intent: string;
  confidence: number;
  domain: string | null;
  tool: string | null;
  latency_ms: number;
}

// Tools
export interface ToolDefinition {
  name: string;
  domain: string;
  description: string;
  risk: RiskLevel;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  provider: string;
  enabled: boolean;
}

export interface ToolExecution {
  tool_name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  success: boolean;
  latency_ms: number;
  timestamp: number;
}

// Models
export interface ModelConfig {
  id: string;
  name: string;
  type: ModelType;
  endpoint: string;
  max_tokens: number;
  temperature: number;
  enabled: boolean;
}

// State
export interface AgentState {
  status: AgentStatus;
  currentRequest: NormalizedRequest | null;
  routeDecision: RouteDecision | null;
  layaDecision: LayaDecision | null;
  tools: ToolDefinition[];
  modelConfigs: ModelConfig[];
  conversation: ChatMessage[];
  metrics: AgentMetrics;
  events: AgentEvent[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system' | 'tool';
  content: string;
  timestamp: number;
  metadata?: {
    route?: RoutePath;
    tool?: string;
    latency_ms?: number;
    laya_calls?: number;
    qwen_called?: boolean;
    confidence?: number;
  };
}

export interface AgentMetrics {
  total_requests: number;
  laya_avg_latency: number;
  laya_p95_latency: number;
  qwen_invocation_pct: number;
  direct_execution_pct: number;
  tool_success_pct: number;
  avg_e2e_latency: number;
  laya_calls_total: number;
  qwen_calls_total: number;
}

export interface AgentEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  latency_ms?: number;
}

// Voice
export interface VoiceState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSpeaking: boolean;
  confidence: number;
}

// Pipeline
export interface PipelineStage {
  name: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  latency_ms?: number;
}

export interface PipelineState {
  stages: PipelineStage[];
  currentStage: number;
  startTime: number;
}
