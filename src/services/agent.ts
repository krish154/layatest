import { v4 as uuid } from 'uuid';
import type { NormalizedRequest, LayaDecision, RouteDecision, ToolExecution, ToolDefinition, PipelineState } from '../types';
import { useAgentStore } from '../store/agentStore';

// ============================================================
// FAST PATH - Truly deterministic, bypasses ALL models
// ============================================================
const FAST_COMMANDS: Record<string, { tool: string; args: Record<string, unknown> }> = {
  'pause': { tool: 'audio.pause', args: {} },
  'stop': { tool: 'audio.pause', args: {} },
  'refresh': { tool: 'browser.refresh', args: {} },
};

// ============================================================
// TOOL REGISTRY - Fetched from Python backend
// ============================================================
// This simulates fetching from Python's single get_tools() method
// In production, this calls: GET http://localhost:3001/mcp/tools

async function fetchToolsFromBackend(): Promise<ToolDefinition[]> {
  // Simulate network call to Python backend
  await sleep(5);
  
  const store = useAgentStore.getState();
  return store.tools.filter(t => t.enabled);
}

// ============================================================
// LAYA SYSTEM-1 ENGINE
// ============================================================

/**
 * LAYA CALL #1: "Can you handle this request?"
 * 
 * Returns a binary decision: YES (I can handle it) or NO (needs Qwen)
 * This is a fast, cheap classification.
 */
async function layaCall1_CanHandle(request: NormalizedRequest): Promise<{
  can_handle: boolean;
  reason: string;
  confidence: number;
  latency_ms: number;
}> {
  const start = performance.now();
  const text = request.text.toLowerCase();
  
  // Simulate Laya processing (15-35ms)
  await sleep(15 + Math.random() * 20);
  
  // Laya decides if it can handle this
  const needsComplexReasoning = /why|how does|compare|analyze|debug|explain|what if|plan|strategy|should i|which is better/.test(text);
  const needsCodeGeneration = /write code|create function|implement|program|script/.test(text);
  const needsLongForm = /write essay|summarize book|explain in detail|tell me about/.test(text);
  const needsMultiStepPlanning = /first.*then.*after|step by step.*plan/.test(text);
  
  const canHandle = !(needsComplexReasoning || needsCodeGeneration || needsLongForm || needsMultiStepPlanning);
  
  let reason = '';
  if (needsComplexReasoning) reason = 'Requires complex reasoning';
  else if (needsCodeGeneration) reason = 'Requires code generation';
  else if (needsLongForm) reason = 'Requires long-form generation';
  else if (needsMultiStepPlanning) reason = 'Requires multi-step planning';
  else reason = 'Simple task - Laya can handle';
  
  const latency = Math.round(performance.now() - start);
  
  return {
    can_handle: canHandle,
    reason,
    confidence: canHandle ? 0.9 + Math.random() * 0.1 : 0.85 + Math.random() * 0.1,
    latency_ms: latency,
  };
}

/**
 * LAYA CALL #2: "Here are ALL tools, pick one"
 * 
 * Receives the complete tool list from Python backend.
 * Laya selects the best tool for the job.
 * Returns the selected tool name.
 */
async function layaCall2_SelectTool(
  request: NormalizedRequest,
  allTools: ToolDefinition[]
): Promise<{
  selected_tool: string;
  tool_arguments: Record<string, unknown>;
  confidence: number;
  latency_ms: number;
}> {
  const start = performance.now();
  const text = request.text.toLowerCase();
  
  // Simulate Laya processing (20-45ms)
  await sleep(20 + Math.random() * 25);
  
  // Laya picks the best tool from ALL available tools
  let selectedTool = '';
  let toolArguments: Record<string, unknown> = {};
  
  // Pattern matching to simulate Laya's decision
  if (/list.*app|show.*app|installed|what.*app|get.*app/.test(text)) {
    selectedTool = 'system.list_apps';
  } else if (/open\s+(.+)/i.test(text)) {
    selectedTool = 'system.open_app';
    const match = text.match(/open\s+(.+)/i);
    toolArguments = { app_name: match ? match[1].trim() : '' };
  } else if (/close\s+(.+)/i.test(text)) {
    selectedTool = 'system.close_app';
    const match = text.match(/close\s+(.+)/i);
    toolArguments = { app_name: match ? match[1].trim() : '' };
  } else if (/cpu|processor/.test(text)) {
    selectedTool = 'monitoring.cpu';
  } else if (/memory|ram/.test(text)) {
    selectedTool = 'monitoring.memory';
  } else if (/disk|storage|drive/.test(text)) {
    selectedTool = 'monitoring.disk';
  } else if (/search|google|find online/.test(text)) {
    selectedTool = 'browser.search';
    const match = text.match(/(?:search|google|find online)\s+(?:for\s+)?(.+)/i);
    toolArguments = { query: match ? match[1].trim() : text };
  } else if (/open.*url|go to|visit|navigate/.test(text)) {
    selectedTool = 'browser.open';
    const match = text.match(/(?:open|go to|visit|navigate)\s+(.+)/i);
    toolArguments = { url: match ? match[1].trim() : '' };
  } else if (/play\s+(.+)/i.test(text)) {
    selectedTool = 'audio.play';
    const match = text.match(/play\s+(.+)/i);
    toolArguments = { source: match ? match[1].trim() : '' };
  } else if (/pause|stop.*play/.test(text)) {
    selectedTool = 'audio.pause';
  } else if (/read.*file|open file/.test(text)) {
    selectedTool = 'filesystem.read';
  } else if (/write.*file|save.*file|create file/.test(text)) {
    selectedTool = 'filesystem.write';
  } else {
    // Fallback: pick first available tool
    selectedTool = allTools[0]?.name || 'system.list_apps';
  }
  
  // Verify selected tool exists in the list
  const toolExists = allTools.some(t => t.name === selectedTool);
  if (!toolExists && allTools.length > 0) {
    selectedTool = allTools[0].name;
  }
  
  const latency = Math.round(performance.now() - start);
  
  return {
    selected_tool: selectedTool,
    tool_arguments: toolArguments,
    confidence: 0.88 + Math.random() * 0.12,
    latency_ms: latency,
  };
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
// MAIN ORCHESTRATOR - Two-Call Laya Architecture
// ============================================================
export async function processRequest(text: string): Promise<void> {
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
      { name: 'Fetch Tools', status: 'pending' },
      { name: 'Laya #2', status: 'pending' },
      { name: 'Execute', status: 'pending' },
      { name: 'Verify', status: 'pending' },
    ],
    currentStage: 0,
    startTime,
  };
  store.setPipeline(pipeline);

  // ─────────────────────────────────────────────────────────
  // STAGE 1: Input normalization (instant)
  // ─────────────────────────────────────────────────────────
  await sleep(8);
  pipeline.stages[0].status = 'complete';
  pipeline.stages[0].latency_ms = 8;
  pipeline.currentStage = 1;
  store.setPipeline({ ...pipeline });
  store.addEvent({ id: uuid(), type: 'InputNormalized', timestamp: Date.now(), data: {}, latency_ms: 8 });

  // ─────────────────────────────────────────────────────────
  // STAGE 2: Fast Path check (bypasses ALL models)
  // ─────────────────────────────────────────────────────────
  const fastMatch = FAST_COMMANDS[text.toLowerCase().trim()];
  if (fastMatch) {
    pipeline.stages[1].status = 'complete';
    pipeline.stages[1].latency_ms = 3;
    pipeline.stages[2].status = 'complete';
    pipeline.stages[2].latency_ms = 0;
    pipeline.stages[3].status = 'complete';
    pipeline.stages[3].latency_ms = 0;
    pipeline.stages[4].status = 'complete';
    pipeline.stages[4].latency_ms = 0;
    store.setPipeline({ ...pipeline });
    store.addEvent({ id: uuid(), type: 'FastPathMatched', timestamp: Date.now(), data: { tool: fastMatch.tool }, latency_ms: 3 });

    // Execute directly
    pipeline.stages[5].status = 'active';
    store.setPipeline({ ...pipeline });
    store.setStatus('executing');
    const execution = await executeTool(fastMatch.tool, fastMatch.args);
    pipeline.stages[5].status = 'complete';
    pipeline.stages[5].latency_ms = execution.latency_ms;
    store.setPipeline({ ...pipeline });

    // Verify
    pipeline.stages[6].status = 'active';
    store.setPipeline({ ...pipeline });
    await sleep(8);
    pipeline.stages[6].status = 'complete';
    pipeline.stages[6].latency_ms = 8;
    store.setPipeline({ ...pipeline });

    const totalLatency = Date.now() - startTime;
    respondWithResult(text, execution, totalLatency, 0, false, 'fast_path');
    return;
  }

  pipeline.stages[1].status = 'complete';
  pipeline.stages[1].latency_ms = 3;
  pipeline.currentStage = 2;
  store.setPipeline({ ...pipeline });

  // ─────────────────────────────────────────────────────────
  // STAGE 3: LAYA CALL #1 — "Can you handle this?"
  // ─────────────────────────────────────────────────────────
  store.setStatus('thinking');
  store.addEvent({ id: uuid(), type: 'LayaCall1Started', timestamp: Date.now(), data: { question: 'Can Laya handle this?' } });
  
  const laya1Result = await layaCall1_CanHandle(request);
  
  pipeline.stages[2].status = 'complete';
  pipeline.stages[2].latency_ms = laya1Result.latency_ms;
  store.setPipeline({ ...pipeline });
  
  store.addEvent({ 
    id: uuid(), 
    type: 'LayaCall1Completed', 
    timestamp: Date.now(), 
    data: { can_handle: laya1Result.can_handle, reason: laya1Result.reason, confidence: laya1Result.confidence },
    latency_ms: laya1Result.latency_ms 
  });

  // Set Laya decision for UI display
  store.setLayaDecision({
    tool_required: laya1Result.can_handle,
    browser_required: false,
    reasoning_required: !laya1Result.can_handle,
    risk: 'low',
    multi_step: false,
    intent: laya1Result.can_handle ? 'laya_handleable' : 'needs_qwen',
    confidence: laya1Result.confidence,
    domain: null,
    tool: null,
    latency_ms: laya1Result.latency_ms,
  });

  // ─────────────────────────────────────────────────────────
  // CHECK: If Laya says NO → escalate to Qwen
  // ─────────────────────────────────────────────────────────
  if (!laya1Result.can_handle) {
    store.addEvent({ id: uuid(), type: 'QwenRequired', timestamp: Date.now(), data: { reason: laya1Result.reason } });
    
    // Skip to Qwen
    pipeline.stages[3].status = 'complete';
    pipeline.stages[3].latency_ms = 0;
    pipeline.stages[4].status = 'complete';
    pipeline.stages[4].latency_ms = 0;
    store.setPipeline({ ...pipeline });
    
    // Simulate Qwen reasoning
    store.setStatus('thinking');
    const qwenLatency = 500 + Math.random() * 1500;
    await sleep(qwenLatency);
    
    const qwenResponse = generateQwenResponse(text);
    const totalLatency = Date.now() - startTime;
    
    store.addMessage({
      id: uuid(),
      role: 'agent',
      content: qwenResponse,
      timestamp: Date.now(),
      metadata: {
        route: 'qwen',
        latency_ms: totalLatency,
        laya_calls: 1,
        qwen_called: true,
        confidence: laya1Result.confidence,
      },
    });
    
    store.updateMetrics({
      total_requests: store.metrics.total_requests + 1,
      laya_calls_total: store.metrics.laya_calls_total + 1,
      qwen_calls_total: store.metrics.qwen_calls_total + 1,
      laya_avg_latency: Math.round((store.metrics.laya_avg_latency * store.metrics.total_requests + laya1Result.latency_ms) / (store.metrics.total_requests + 1)),
      qwen_invocation_pct: Math.round(((store.metrics.qwen_calls_total + 1) / (store.metrics.total_requests + 1)) * 100),
      avg_e2e_latency: Math.round((store.metrics.avg_e2e_latency * store.metrics.total_requests + totalLatency) / (store.metrics.total_requests + 1)),
    });

    store.setStatus('idle');
    store.setPipeline(null);
    return;
  }

  // ─────────────────────────────────────────────────────────
  // STAGE 4: FETCH ALL TOOLS from Python backend
  // ─────────────────────────────────────────────────────────
  pipeline.stages[3].status = 'active';
  store.setPipeline({ ...pipeline });
  store.addEvent({ id: uuid(), type: 'FetchingTools', timestamp: Date.now(), data: { source: 'mcp_server' } });
  
  const allTools = await fetchToolsFromBackend();
  
  pipeline.stages[3].status = 'complete';
  pipeline.stages[3].latency_ms = 5;
  pipeline.currentStage = 4;
  store.setPipeline({ ...pipeline });
  store.addEvent({ 
    id: uuid(), 
    type: 'ToolsFetched', 
    timestamp: Date.now(), 
    data: { count: allTools.length, domains: [...new Set(allTools.map(t => t.domain))] },
    latency_ms: 5 
  });

  // ─────────────────────────────────────────────────────────
  // STAGE 5: LAYA CALL #2 — "Pick a tool from ALL tools"
  // ─────────────────────────────────────────────────────────
  pipeline.stages[4].status = 'active';
  store.setPipeline({ ...pipeline });
  store.addEvent({ 
    id: uuid(), 
    type: 'LayaCall2Started', 
    timestamp: Date.now(), 
    data: { tools_submitted: allTools.length, question: 'Which tool to use?' } 
  });
  
  const laya2Result = await layaCall2_SelectTool(request, allTools);
  
  pipeline.stages[4].status = 'complete';
  pipeline.stages[4].latency_ms = laya2Result.latency_ms;
  pipeline.currentStage = 5;
  store.setPipeline({ ...pipeline });
  
  store.addEvent({ 
    id: uuid(), 
    type: 'LayaCall2Completed', 
    timestamp: Date.now(), 
    data: { selected_tool: laya2Result.selected_tool, confidence: laya2Result.confidence },
    latency_ms: laya2Result.latency_ms 
  });

  // Update Laya decision with tool selection
  const currentLaya = store.layaDecision;
  if (currentLaya) {
    store.setLayaDecision({
      ...currentLaya,
      domain: laya2Result.selected_tool.split('.')[0],
      tool: laya2Result.selected_tool,
    });
  }

  // Set route decision
  const routeDecision: RouteDecision = {
    path: 'laya_direct',
    domain: laya2Result.selected_tool.split('.')[0],
    tool: laya2Result.selected_tool,
    confidence: laya2Result.confidence,
    requires_qwen: false,
    risk: 'low',
    multi_step: false,
    reasoning_required: false,
  };
  store.setRouteDecision(routeDecision);

  // ─────────────────────────────────────────────────────────
  // STAGE 6: EXECUTE the selected tool
  // ─────────────────────────────────────────────────────────
  pipeline.stages[5].status = 'active';
  store.setPipeline({ ...pipeline });
  store.setStatus('executing');
  store.addEvent({ id: uuid(), type: 'ToolStarted', timestamp: Date.now(), data: { tool: laya2Result.selected_tool } });
  
  const execution = await executeTool(laya2Result.selected_tool, laya2Result.tool_arguments);
  
  pipeline.stages[5].status = 'complete';
  pipeline.stages[5].latency_ms = execution.latency_ms;
  pipeline.currentStage = 6;
  store.setPipeline({ ...pipeline });
  store.addEvent({ 
    id: uuid(), 
    type: 'ToolCompleted', 
    timestamp: Date.now(), 
    data: { tool: laya2Result.selected_tool, success: execution.success },
    latency_ms: execution.latency_ms 
  });

  // ─────────────────────────────────────────────────────────
  // STAGE 7: VERIFY
  // ─────────────────────────────────────────────────────────
  pipeline.stages[6].status = 'active';
  store.setPipeline({ ...pipeline });
  store.setStatus('verifying');
  await sleep(10);
  pipeline.stages[6].status = 'complete';
  pipeline.stages[6].latency_ms = 10;
  store.setPipeline({ ...pipeline });
  store.addEvent({ id: uuid(), type: 'VerificationComplete', timestamp: Date.now(), data: { success: true }, latency_ms: 10 });

  const totalLatency = Date.now() - startTime;
  respondWithResult(text, execution, totalLatency, 2, false, 'laya_direct');
}

// ============================================================
// HELPERS
// ============================================================

function respondWithResult(
  text: string, 
  execution: ToolExecution, 
  totalLatency: number, 
  layaCalls: number, 
  qwenCalled: boolean,
  route: 'fast_path' | 'laya_direct' | 'direct_tool' | 'qwen' = 'laya_direct'
) {
  const store = useAgentStore.getState();
  const response = formatToolResponse(execution);
  
  store.addMessage({
    id: uuid(),
    role: 'agent',
    content: response,
    timestamp: Date.now(),
    metadata: {
      route,
      tool: execution.tool_name,
      latency_ms: totalLatency,
      laya_calls: layaCalls,
      qwen_called: qwenCalled,
      confidence: 0.93,
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
    laya_avg_latency: Math.round((store.metrics.laya_avg_latency * store.metrics.total_requests + 35) / (store.metrics.total_requests + 1)),
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
    case 'system.list_apps': {
      const apps = result.apps as string[];
      return `📱 Found ${apps.length} applications:\n\n${apps.map((app, i) => `  ${i + 1}. ${app}`).join('\n')}`;
    }
    case 'system.open_app':
      return `✓ Opened ${result.app_name} (PID: ${result.pid})`;
    case 'system.close_app':
      return `✓ Closed ${result.app_name}`;
    case 'browser.search':
      return `🔍 Searched for "${result.query}". Found ${(result.results as unknown[]).length} results.`;
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

function generateQwenResponse(text: string): string {
  const lower = text.toLowerCase();
  if (/why.*slow|performance/.test(lower)) {
    return "After analyzing your system, the slowdown appears to be caused by high CPU utilization from background processes. I recommend checking the top processes and considering restarting the affected services.";
  }
  if (/compare|analyze/.test(lower)) {
    return "I've analyzed the available options. Based on the criteria you specified, here's my recommendation with a detailed comparison of the trade-offs involved.";
  }
  return "I've processed your complex request and here's a comprehensive analysis based on the available information and context.";
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
  if (/^(check|get|show|list)\s+(cpu|memory|disk|apps)/.test(lower)) {
    return { shouldAct: true, action: 'monitor' };
  }
  
  return { shouldAct: false };
}
