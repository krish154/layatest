import { v4 as uuid } from 'uuid';
import type { NormalizedRequest, LayaDecision, RouteDecision, ToolExecution, ChatMessage, AgentEvent, PipelineState } from '../types';
import { useAgentStore } from '../store/agentStore';

// ============================================================
// FAST PATH - Deterministic command registry
// ============================================================
const FAST_COMMANDS: Record<string, { tool: string; args: Record<string, unknown> }> = {
  'open chrome': { tool: 'system.open_app', args: { app_name: 'chrome' } },
  'open calculator': { tool: 'system.open_app', args: { app_name: 'calculator' } },
  'open terminal': { tool: 'system.open_app', args: { app_name: 'terminal' } },
  'open settings': { tool: 'system.open_app', args: { app_name: 'settings' } },
  'check cpu': { tool: 'monitoring.cpu', args: {} },
  'check memory': { tool: 'monitoring.memory', args: {} },
  'check disk': { tool: 'monitoring.disk', args: {} },
  'take screenshot': { tool: 'system.screenshot', args: {} },
  'list apps': { tool: 'system.list_apps', args: {} },
  'pause': { tool: 'audio.pause', args: {} },
  'stop': { tool: 'audio.pause', args: {} },
};

// ============================================================
// DOMAIN-TOOL MAPPING
// ============================================================
const DOMAIN_TOOLS: Record<string, string[]> = {
  system: ['system.list_apps', 'system.open_app', 'system.close_app'],
  monitoring: ['monitoring.cpu', 'monitoring.memory', 'monitoring.disk'],
  browser: ['browser.open', 'browser.search', 'browser.click', 'browser.type'],
  filesystem: ['filesystem.read', 'filesystem.write'],
  audio: ['audio.play', 'audio.pause'],
};

// ============================================================
// SIMULATED LAYA - System-1 Decision Engine
// ============================================================
async function simulateLaya(request: NormalizedRequest, stage: 'initial' | 'tool_select'): Promise<LayaDecision> {
  const latency = 30 + Math.random() * 70; // 30-100ms
  await new Promise(r => setTimeout(r, latency));

  const text = request.text.toLowerCase();

  if (stage === 'initial') {
    const needsTool = /open|close|check|list|search|play|pause|stop|click|type|get|find|run|execute/.test(text);
    const needsBrowser = /search|google|youtube|website|url|open.*http/.test(text);
    const needsReasoning = /why|how|compare|analyze|debug|explain|what.*if|plan/.test(text);
    const isMultiStep = /and|then|after|before|while|first.*then/.test(text);
    
    let domain: string | null = null;
    if (needsBrowser) domain = 'browser';
    else if (/cpu|memory|disk|monitor|usage|performance/.test(text)) domain = 'monitoring';
    else if (/open|close|list|app|program/.test(text)) domain = 'system';
    else if (/file|read|write|save|load/.test(text)) domain = 'filesystem';
    else if (/play|pause|music|audio|song/.test(text)) domain = 'audio';

    return {
      tool_required: needsTool,
      browser_required: needsBrowser,
      reasoning_required: needsReasoning,
      risk: /delete|remove|destroy|format|shutdown/.test(text) ? 'high' : 'low',
      multi_step: isMultiStep,
      intent: classifyIntent(text),
      confidence: 0.85 + Math.random() * 0.15,
      domain,
      tool: null,
      latency_ms: Math.round(latency),
    };
  } else {
    // Tool selection stage
    const tools = useAgentStore.getState().tools;
    const text = request.text.toLowerCase();
    let selectedTool = '';
    
    if (/cpu/.test(text)) selectedTool = 'monitoring.cpu';
    else if (/memory|ram/.test(text)) selectedTool = 'monitoring.memory';
    else if (/disk|storage/.test(text)) selectedTool = 'monitoring.disk';
    else if (/list.*app|show.*app|installed/.test(text)) selectedTool = 'system.list_apps';
    else if (/open/.test(text)) selectedTool = 'system.open_app';
    else if (/close/.test(text)) selectedTool = 'system.close_app';
    else if (/search|google/.test(text)) selectedTool = 'browser.search';
    else if (/open.*url|open.*http|go to/.test(text)) selectedTool = 'browser.open';
    else if (/play|music/.test(text)) selectedTool = 'audio.play';
    else if (/pause|stop/.test(text)) selectedTool = 'audio.pause';
    else selectedTool = tools.find(t => t.enabled)?.name || 'system.list_apps';

    return {
      tool_required: true,
      browser_required: selectedTool.startsWith('browser'),
      reasoning_required: false,
      risk: 'low',
      multi_step: false,
      intent: 'tool_execution',
      confidence: 0.9 + Math.random() * 0.1,
      domain: selectedTool.split('.')[0],
      tool: selectedTool,
      latency_ms: Math.round(latency),
    };
  }
}

function classifyIntent(text: string): string {
  if (/open|launch|start/.test(text)) return 'app_launch';
  if (/close|quit|exit|kill/.test(text)) return 'app_close';
  if (/check|get|show|display/.test(text)) return 'info_query';
  if (/search|find|look/.test(text)) return 'search';
  if (/play|listen|music/.test(text)) return 'media_control';
  if (/click|type|navigate/.test(text)) return 'browser_action';
  return 'general';
}

// ============================================================
// SIMULATED QWEN - System-2 Reasoning Engine
// ============================================================
async function simulateQwen(request: NormalizedRequest, context: unknown): Promise<string> {
  const latency = 500 + Math.random() * 2000;
  await new Promise(r => setTimeout(r, latency));
  
  const text = request.text.toLowerCase();
  
  if (/why.*slow|performance|issue/.test(text)) {
    return "Based on system analysis, the slowdown appears to be caused by high CPU utilization from background processes. I recommend checking the top processes and considering restarting the affected services.";
  }
  if (/compare|analyze/.test(text)) {
    return "I've analyzed the available options. Based on the criteria you specified, here's my recommendation with a detailed comparison of the trade-offs involved.";
  }
  return "I've processed your request and here's a comprehensive analysis based on the available information and context.";
}

// ============================================================
// TOOL EXECUTOR
// ============================================================
async function executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolExecution> {
  const start = Date.now();
  const latency = 20 + Math.random() * 80;
  await new Promise(r => setTimeout(r, latency));

  let result: unknown;
  
  switch (toolName) {
    case 'monitoring.cpu':
      result = { usage_pct: Math.round(15 + Math.random() * 70), cores: 8, avg_freq_ghz: 3.2 };
      break;
    case 'monitoring.memory':
      result = { usage_pct: Math.round(30 + Math.random() * 50), total_gb: 16, used_gb: Math.round(5 + Math.random() * 8), free_gb: Math.round(2 + Math.random() * 6) };
      break;
    case 'monitoring.disk':
      result = { usage_pct: Math.round(40 + Math.random() * 40), total_gb: 512, free_gb: Math.round(50 + Math.random() * 200) };
      break;
    case 'system.list_apps':
      result = { apps: ['Chrome', 'VS Code', 'Terminal', 'Spotify', 'Slack', 'Discord', 'Figma', 'Docker', 'Notion', 'Obsidian'] };
      break;
    case 'system.open_app':
      result = { success: true, app_name: args.app_name, pid: Math.floor(1000 + Math.random() * 9000) };
      break;
    case 'system.close_app':
      result = { success: true, app_name: args.app_name };
      break;
    case 'browser.search':
      result = { success: true, query: args.query, results: [{ title: 'Result 1', url: 'https://example.com/1' }, { title: 'Result 2', url: 'https://example.com/2' }] };
      break;
    case 'browser.open':
      result = { success: true, url: args.url };
      break;
    case 'audio.play':
      result = { success: true, source: args.source, status: 'playing' };
      break;
    case 'audio.pause':
      result = { success: true, status: 'paused' };
      break;
    default:
      result = { success: true, message: 'Executed successfully' };
  }

  return {
    tool_name: toolName,
    arguments: args,
    result,
    success: true,
    latency_ms: Math.round(latency),
    timestamp: Date.now(),
  };
}

// ============================================================
// MAIN ORCHESTRATOR
// ============================================================
export async function processRequest(text: string, isPartial: boolean = false): Promise<void> {
  const store = useAgentStore.getState();
  const requestId = uuid();
  const startTime = Date.now();

  const request: NormalizedRequest = {
    request_id: requestId,
    text,
    modality: 'text',
    attachments: [],
    context: {},
    source: 'user',
    partial: isPartial,
  };

  store.setCurrentRequest(request);
  store.setStatus('thinking');

  // Emit event
  store.addEvent({
    id: uuid(),
    type: 'RequestReceived',
    timestamp: Date.now(),
    data: { text, modality: 'text' },
  });

  // Pipeline stages
  const pipeline: PipelineState = {
    stages: [
      { name: 'Input', status: 'active' },
      { name: 'Fast Path', status: 'pending' },
      { name: 'Laya #1', status: 'pending' },
      { name: 'Laya #2', status: 'pending' },
      { name: 'Execute', status: 'pending' },
      { name: 'Verify', status: 'pending' },
    ],
    currentStage: 0,
    startTime,
  };
  store.setPipeline(pipeline);

  // Stage 1: Input normalization (instant)
  await sleep(10);
  pipeline.stages[0].status = 'complete';
  pipeline.stages[0].latency_ms = 10;
  pipeline.currentStage = 1;
  store.setPipeline({ ...pipeline });
  store.addEvent({ id: uuid(), type: 'InputNormalized', timestamp: Date.now(), data: {}, latency_ms: 10 });

  // Stage 2: Fast Path check
  const fastMatch = FAST_COMMANDS[text.toLowerCase().trim()];
  if (fastMatch) {
    pipeline.stages[1].status = 'complete';
    pipeline.stages[1].latency_ms = 5;
    store.setPipeline({ ...pipeline });
    store.addEvent({ id: uuid(), type: 'FastPathMatched', timestamp: Date.now(), data: { tool: fastMatch.tool }, latency_ms: 5 });

    // Execute directly
    pipeline.stages[4].status = 'active';
    store.setPipeline({ ...pipeline });
    const execution = await executeTool(fastMatch.tool, fastMatch.args);
    pipeline.stages[4].status = 'complete';
    pipeline.stages[4].latency_ms = execution.latency_ms;
    store.setPipeline({ ...pipeline });

    const totalLatency = Date.now() - startTime;
    respondWithResult(text, execution, totalLatency, 0, false);
    return;
  }

  pipeline.stages[1].status = 'complete';
  pipeline.stages[1].latency_ms = 5;
  pipeline.currentStage = 2;
  store.setPipeline({ ...pipeline });

  // Stage 3: Laya #1 - Initial classification
  store.setStatus('thinking');
  const laya1 = await simulateLaya(request, 'initial');
  store.setLayaDecision(laya1);
  pipeline.stages[2].status = 'complete';
  pipeline.stages[2].latency_ms = laya1.latency_ms;
  store.setPipeline({ ...pipeline });
  store.addEvent({ id: uuid(), type: 'LayaDecisionCompleted', timestamp: Date.now(), data: { ...laya1 }, latency_ms: laya1.latency_ms });

  // Check if Qwen is needed
  if (laya1.reasoning_required || laya1.multi_step || laya1.confidence < 0.65) {
    store.setStatus('thinking');
    store.addEvent({ id: uuid(), type: 'QwenRequired', timestamp: Date.now(), data: { reason: 'complex_task' } });
    const qwenResponse = await simulateQwen(request, laya1);
    const totalLatency = Date.now() - startTime;
    
    store.addMessage({
      id: uuid(),
      role: 'agent',
      content: qwenResponse,
      timestamp: Date.now(),
      metadata: { route: 'qwen', latency_ms: totalLatency, laya_calls: 1, qwen_called: true, confidence: laya1.confidence },
    });
    
    store.updateMetrics({
      total_requests: store.metrics.total_requests + 1,
      laya_calls_total: store.metrics.laya_calls_total + 1,
      qwen_calls_total: store.metrics.qwen_calls_total + 1,
      laya_avg_latency: Math.round((store.metrics.laya_avg_latency * store.metrics.total_requests + laya1.latency_ms) / (store.metrics.total_requests + 1)),
      qwen_invocation_pct: Math.round(((store.metrics.qwen_calls_total + 1) / (store.metrics.total_requests + 1)) * 100),
      avg_e2e_latency: Math.round((store.metrics.avg_e2e_latency * store.metrics.total_requests + totalLatency) / (store.metrics.total_requests + 1)),
    });

    store.setStatus('idle');
    store.setPipeline(null);
    return;
  }

  // Check if tool is needed
  if (!laya1.tool_required) {
    // Direct response
    store.addMessage({
      id: uuid(),
      role: 'agent',
      content: generateDirectResponse(text),
      timestamp: Date.now(),
      metadata: { route: 'direct_response', latency_ms: Date.now() - startTime, laya_calls: 1, qwen_called: false, confidence: laya1.confidence },
    });
    store.setStatus('idle');
    store.setPipeline(null);
    return;
  }

  // Stage 4: Laya #2 - Tool selection
  pipeline.currentStage = 3;
  store.setPipeline({ ...pipeline });
  const laya2 = await simulateLaya(request, 'tool_select');
  pipeline.stages[3].status = 'complete';
  pipeline.stages[3].latency_ms = laya2.latency_ms;
  store.setPipeline({ ...pipeline });
  store.addEvent({ id: uuid(), type: 'ToolSelected', timestamp: Date.now(), data: { tool: laya2.tool }, latency_ms: laya2.latency_ms });

  // Set route decision
  const routeDecision: RouteDecision = {
    path: 'direct_tool',
    domain: laya2.domain || 'system',
    tool: laya2.tool,
    confidence: laya2.confidence,
    requires_qwen: false,
    risk: laya1.risk,
    multi_step: false,
    reasoning_required: false,
  };
  store.setRouteDecision(routeDecision);

  // Stage 5: Execute tool
  pipeline.stages[4].status = 'active';
  store.setPipeline({ ...pipeline });
  store.setStatus('executing');

  const toolArgs = extractToolArgs(laya2.tool || '', text);
  const execution = await executeTool(laya2.tool || 'system.list_apps', toolArgs);
  
  pipeline.stages[4].status = 'complete';
  pipeline.stages[4].latency_ms = execution.latency_ms;
  pipeline.currentStage = 5;
  store.setPipeline({ ...pipeline });
  store.addEvent({ id: uuid(), type: 'ToolCompleted', timestamp: Date.now(), data: { tool: laya2.tool, success: execution.success }, latency_ms: execution.latency_ms });

  // Stage 6: Verify
  pipeline.stages[5].status = 'active';
  store.setPipeline({ ...pipeline });
  store.setStatus('verifying');
  await sleep(15);
  pipeline.stages[5].status = 'complete';
  pipeline.stages[5].latency_ms = 15;
  store.setPipeline({ ...pipeline });

  const totalLatency = Date.now() - startTime;
  respondWithResult(text, execution, totalLatency, 2, false);
}

function respondWithResult(text: string, execution: ToolExecution, totalLatency: number, layaCalls: number, qwenCalled: boolean) {
  const store = useAgentStore.getState();
  const response = formatToolResponse(execution);
  
  store.addMessage({
    id: uuid(),
    role: 'agent',
    content: response,
    timestamp: Date.now(),
    metadata: {
      route: 'direct_tool',
      tool: execution.tool_name,
      latency_ms: totalLatency,
      laya_calls: layaCalls,
      qwen_called: qwenCalled,
      confidence: 0.92,
    },
  });

  store.addMessage({
    id: uuid(),
    role: 'tool',
    content: JSON.stringify(execution.result, null, 2),
    timestamp: Date.now(),
    metadata: { tool: execution.tool_name },
  });

  store.updateMetrics({
    total_requests: store.metrics.total_requests + 1,
    laya_calls_total: store.metrics.laya_calls_total + layaCalls,
    laya_avg_latency: Math.round((store.metrics.laya_avg_latency * store.metrics.total_requests + 65) / (store.metrics.total_requests + 1)),
    direct_execution_pct: Math.round(((store.metrics.direct_execution_pct * store.metrics.total_requests + 100) / (store.metrics.total_requests + 1))),
    avg_e2e_latency: Math.round((store.metrics.avg_e2e_latency * store.metrics.total_requests + totalLatency) / (store.metrics.total_requests + 1)),
  });

  store.setStatus('idle');
  store.setPipeline(null);
}

function formatToolResponse(execution: ToolExecution): string {
  const result = execution.result as Record<string, unknown>;
  
  switch (execution.tool_name) {
    case 'monitoring.cpu':
      return `CPU Usage: ${result.usage_pct}% across ${result.cores} cores @ ${result.avg_freq_ghz} GHz`;
    case 'monitoring.memory':
      return `Memory: ${result.usage_pct}% used (${result.used_gb}GB / ${result.total_gb}GB), ${result.free_gb}GB free`;
    case 'monitoring.disk':
      return `Disk: ${result.usage_pct}% used, ${result.free_gb}GB free of ${result.total_gb}GB`;
    case 'system.list_apps':
      return `Installed applications: ${(result.apps as string[]).join(', ')}`;
    case 'system.open_app':
      return `✓ Opened ${result.app_name} (PID: ${result.pid})`;
    case 'system.close_app':
      return `✓ Closed ${result.app_name}`;
    case 'browser.search':
      return `Searched for "${result.query}". Found ${(result.results as unknown[]).length} results.`;
    case 'browser.open':
      return `✓ Opened ${result.url}`;
    case 'audio.play':
      return `♪ Now playing: ${result.source}`;
    case 'audio.pause':
      return `⏸ Media paused`;
    default:
      return `Executed ${execution.tool_name} successfully.`;
  }
}

function generateDirectResponse(text: string): string {
  const lower = text.toLowerCase();
  if (/hello|hi|hey/.test(lower)) return "Hello! I'm your AI agent. I can help you with system tasks, browser automation, monitoring, and more. What would you like to do?";
  if (/help|what can you do/.test(lower)) return "I can:\n• Open/close applications\n• Monitor system resources (CPU, memory, disk)\n• Browse the web and search\n• Play/pause media\n• Read/write files\n• List installed apps\n\nJust tell me what you need!";
  if (/thank/.test(lower)) return "You're welcome! Let me know if you need anything else.";
  return "I understand your request. Let me help you with that.";
}

function extractToolArgs(toolName: string, text: string): Record<string, unknown> {
  const lower = text.toLowerCase();
  
  if (toolName === 'system.open_app' || toolName === 'system.close_app') {
    const appMatch = text.match(/(?:open|close|launch)\s+(?:the\s+)?(.+)/i);
    return { app_name: appMatch ? appMatch[1].trim() : 'unknown' };
  }
  if (toolName === 'browser.search') {
    const searchMatch = text.match(/(?:search|google|find)\s+(?:for\s+)?(.+)/i);
    return { query: searchMatch ? searchMatch[1].trim() : text };
  }
  if (toolName === 'browser.open') {
    const urlMatch = text.match(/(?:open|go to|visit)\s+(.+)/i);
    return { url: urlMatch ? urlMatch[1].trim() : text };
  }
  if (toolName === 'audio.play') {
    const playMatch = text.match(/(?:play)\s+(.+)/i);
    return { source: playMatch ? playMatch[1].trim() : 'media' };
  }
  return {};
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ============================================================
// STREAMING VOICE DECISION ENGINE
// ============================================================
export async function processPartialVoice(transcript: string): Promise<{ shouldAct: boolean; action?: string }> {
  const lower = transcript.toLowerCase();
  
  // Check if we have enough to trigger an action
  if (/^open\s+\w+/.test(lower)) {
    return { shouldAct: true, action: 'open_app' };
  }
  if (/^close\s+\w+/.test(lower)) {
    return { shouldAct: true, action: 'close_app' };
  }
  if (/^play\s+\w+/.test(lower)) {
    return { shouldAct: true, action: 'play_media' };
  }
  if (/^(check|get)\s+(cpu|memory|disk)/.test(lower)) {
    return { shouldAct: true, action: 'monitor' };
  }
  
  return { shouldAct: false };
}
