import { create } from 'zustand';
import type {
  AgentState, ChatMessage, ToolDefinition, ModelConfig,
  RouteDecision, LayaDecision, AgentEvent, AgentMetrics,
  NormalizedRequest, AgentStatus, PipelineState
} from '../types';

interface AgentStore extends AgentState {
  pipeline: PipelineState | null;
  // Actions
  setStatus: (status: AgentStatus) => void;
  addMessage: (message: ChatMessage) => void;
  addEvent: (event: AgentEvent) => void;
  setRouteDecision: (decision: RouteDecision | null) => void;
  setLayaDecision: (decision: LayaDecision | null) => void;
  setCurrentRequest: (request: NormalizedRequest | null) => void;
  updateMetrics: (metrics: Partial<AgentMetrics>) => void;
  addTool: (tool: ToolDefinition) => void;
  removeTool: (name: string) => void;
  toggleTool: (name: string) => void;
  updateModelConfig: (id: string, config: Partial<ModelConfig>) => void;
  clearConversation: () => void;
  setPipeline: (pipeline: PipelineState | null) => void;
}

const defaultTools: ToolDefinition[] = [
  { name: 'system.list_apps', domain: 'system', description: 'List all installed applications', risk: 'low', input_schema: {}, output_schema: { apps: 'array' }, provider: 'native', enabled: true },
  { name: 'system.open_app', domain: 'system', description: 'Open an application by name', risk: 'low', input_schema: { app_name: 'string' }, output_schema: { success: 'boolean' }, provider: 'native', enabled: true },
  { name: 'system.close_app', domain: 'system', description: 'Close an application by name', risk: 'medium', input_schema: { app_name: 'string' }, output_schema: { success: 'boolean' }, provider: 'native', enabled: true },
  { name: 'monitoring.cpu', domain: 'monitoring', description: 'Get CPU usage', risk: 'low', input_schema: {}, output_schema: { usage_pct: 'number' }, provider: 'native', enabled: true },
  { name: 'monitoring.memory', domain: 'monitoring', description: 'Get memory usage', risk: 'low', input_schema: {}, output_schema: { usage_pct: 'number', total_gb: 'number' }, provider: 'native', enabled: true },
  { name: 'monitoring.disk', domain: 'monitoring', description: 'Get disk usage', risk: 'low', input_schema: {}, output_schema: { usage_pct: 'number', free_gb: 'number' }, provider: 'native', enabled: true },
  { name: 'browser.open', domain: 'browser', description: 'Open a URL in browser', risk: 'low', input_schema: { url: 'string' }, output_schema: { success: 'boolean' }, provider: 'browser', enabled: true },
  { name: 'browser.search', domain: 'browser', description: 'Search the web', risk: 'low', input_schema: { query: 'string' }, output_schema: { results: 'array' }, provider: 'browser', enabled: true },
  { name: 'browser.click', domain: 'browser', description: 'Click an element', risk: 'low', input_schema: { selector: 'string' }, output_schema: { success: 'boolean' }, provider: 'browser', enabled: true },
  { name: 'browser.type', domain: 'browser', description: 'Type text into element', risk: 'low', input_schema: { selector: 'string', text: 'string' }, output_schema: { success: 'boolean' }, provider: 'browser', enabled: true },
  { name: 'filesystem.read', domain: 'filesystem', description: 'Read a file', risk: 'medium', input_schema: { path: 'string' }, output_schema: { content: 'string' }, provider: 'native', enabled: true },
  { name: 'filesystem.write', domain: 'filesystem', description: 'Write to a file', risk: 'high', input_schema: { path: 'string', content: 'string' }, output_schema: { success: 'boolean' }, provider: 'native', enabled: true },
  { name: 'audio.play', domain: 'audio', description: 'Play audio/media', risk: 'low', input_schema: { source: 'string' }, output_schema: { success: 'boolean' }, provider: 'native', enabled: true },
  { name: 'audio.pause', domain: 'audio', description: 'Pause audio/media', risk: 'low', input_schema: {}, output_schema: { success: 'boolean' }, provider: 'native', enabled: true },
];

const defaultModels: ModelConfig[] = [
  { id: 'laya', name: 'Laya 421M', type: 'decision', endpoint: 'http://localhost:8080/v1', max_tokens: 256, temperature: 0.1, enabled: true },
  { id: 'qwen', name: 'Qwen 30B', type: 'reasoning', endpoint: 'http://localhost:8081/v1', max_tokens: 4096, temperature: 0.7, enabled: true },
];

const defaultMetrics: AgentMetrics = {
  total_requests: 0,
  laya_avg_latency: 0,
  laya_p95_latency: 0,
  qwen_invocation_pct: 0,
  direct_execution_pct: 0,
  tool_success_pct: 100,
  avg_e2e_latency: 0,
  laya_calls_total: 0,
  qwen_calls_total: 0,
};

export const useAgentStore = create<AgentStore>((set, get) => ({
  status: 'idle',
  currentRequest: null,
  routeDecision: null,
  layaDecision: null,
  tools: defaultTools,
  modelConfigs: defaultModels,
  conversation: [],
  metrics: defaultMetrics,
  events: [],
  pipeline: null,

  setStatus: (status) => set({ status }),
  
  addMessage: (message) => set((state) => ({
    conversation: [...state.conversation, message]
  })),
  
  addEvent: (event) => set((state) => ({
    events: [...state.events.slice(-99), event]
  })),
  
  setRouteDecision: (decision) => set({ routeDecision: decision }),
  setLayaDecision: (decision) => set({ layaDecision: decision }),
  setCurrentRequest: (request) => set({ currentRequest: request }),
  
  updateMetrics: (metrics) => set((state) => ({
    metrics: { ...state.metrics, ...metrics }
  })),
  
  addTool: (tool) => set((state) => ({
    tools: [...state.tools, tool]
  })),
  
  removeTool: (name) => set((state) => ({
    tools: state.tools.filter(t => t.name !== name)
  })),
  
  toggleTool: (name) => set((state) => ({
    tools: state.tools.map(t => t.name === name ? { ...t, enabled: !t.enabled } : t)
  })),
  
  updateModelConfig: (id, config) => set((state) => ({
    modelConfigs: state.modelConfigs.map(m => m.id === id ? { ...m, ...config } : m)
  })),
  
  clearConversation: () => set({ conversation: [] }),
  setPipeline: (pipeline) => set({ pipeline }),
}));
