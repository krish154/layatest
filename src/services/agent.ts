/**
 * Agent Client - Thin wrapper that calls the Python backend
 * 
 * All agent logic (Laya calls, tool selection, execution) happens in Python.
 * This file just makes HTTP requests and handles responses.
 */

import { v4 as uuid } from 'uuid';
import type { NormalizedRequest, PipelineState, ToolDefinition } from '../types';
import { useAgentStore } from '../store/agentStore';

// Backend URL - change this to your Python backend
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ============================================================
// API Client
// ============================================================

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================
// Backend API Methods
// ============================================================

export interface ProcessRequestResponse {
  path: 'fast_path' | 'laya_direct' | 'qwen';
  laya_call_1?: {
    can_handle: boolean;
    reason: string;
    confidence: number;
    latency_ms: number;
  };
  tools_fetched?: {
    count: number;
    domains: string[];
    latency_ms: number;
  };
  laya_call_2?: {
    selected_tool: string;
    tool_arguments: Record<string, unknown>;
    confidence: number;
    latency_ms: number;
  };
  execution?: {
    tool_name: string;
    result: unknown;
    success: boolean;
    latency_ms: number;
  };
  qwen_response?: string;
  total_latency_ms: number;
  events: Array<{
    type: string;
    timestamp: number;
    data: Record<string, unknown>;
    latency_ms?: number;
  }>;
}

export async function processRequestViaBackend(text: string): Promise<ProcessRequestResponse> {
  return apiCall<ProcessRequestResponse>('/api/process', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function fetchToolsFromBackend(): Promise<{ tools: ToolDefinition[]; count: number }> {
  return apiCall('/api/tools');
}

export async function checkBackendHealth(): Promise<{ status: string; laya_endpoint: string; qwen_endpoint: string }> {
  return apiCall('/health');
}

// ============================================================
// Frontend Orchestrator - Calls backend, updates UI
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

  const pipeline: PipelineState = {
    stages: [
      { name: 'Input', status: 'active' },
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

  try {
    const result = await processRequestViaBackend(text);

    updatePipelineFromResult(pipeline, result);
    store.setPipeline({ ...pipeline });

    if (result.laya_call_1) {
      store.setLayaDecision({
        tool_required: result.laya_call_1.can_handle,
        browser_required: false,
        reasoning_required: !result.laya_call_1.can_handle,
        risk: 'low',
        multi_step: false,
        intent: result.laya_call_1.can_handle ? 'laya_handleable' : 'needs_qwen',
        confidence: result.laya_call_1.confidence,
        domain: result.laya_call_2?.selected_tool.split('.')[0] || null,
        tool: result.laya_call_2?.selected_tool || null,
        latency_ms: result.laya_call_1.latency_ms,
      });
    }

    result.events.forEach(event => {
      store.addEvent({
        id: uuid(),
        type: event.type,
        timestamp: event.timestamp,
        data: { ...event.data },
        latency_ms: event.latency_ms,
      });
    });

    const responseContent = formatResponse(result);
    const layaCalls = result.laya_call_1 ? (result.laya_call_2 ? 2 : 1) : 0;

    store.addMessage({
      id: uuid(),
      role: 'agent',
      content: responseContent,
      timestamp: Date.now(),
      meta {
        route: result.path,
        tool: result.execution?.tool_name || result.laya_call_2?.selected_tool,
        latency_ms: result.total_latency_ms,
        laya_calls: layaCalls,
        qwen_called: result.path === 'qwen',
        confidence: result.laya_call_2?.confidence || result.laya_call_1?.confidence || 0,
      },
    });

    if (result.execution?.result) {
      store.addMessage({
        id: uuid(),
        role: 'tool',
        content: JSON.stringify(result.execution.result, null, 2),
        timestamp: Date.now(),
        meta { tool: result.execution.tool_name },
      });
    }

    store.updateMetrics({
      total_requests: store.metrics.total_requests + 1,
      laya_calls_total: store.metrics.laya_calls_total + layaCalls,
      qwen_calls_total: store.metrics.qwen_calls_total + (result.path === 'qwen' ? 1 : 0),
      avg_e2e_latency: Math.round(
        (store.metrics.avg_e2e_latency * store.metrics.total_requests + result.total_latency_ms) /
        (store.metrics.total_requests + 1)
      ),
    });

  } catch (error) {
    store.addMessage({
      id: uuid(),
      role: 'agent',
      content: `⚠️ Backend not available. Make sure Python backend is running on ${BACKEND_URL}\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nStarting demo mode with simulated responses...`,
      timestamp: Date.now(),
      meta { route: 'error' },
    });

    // Fallback to demo mode
    await simulateDemoMode(text, store);
  }

  store.setStatus('idle');
  store.setPipeline(null);
}

// ============================================================
// Demo Mode - Simulates backend when not available
// ============================================================

async function simulateDemoMode(text: string, store: any): Promise<void> {
  await new Promise(r => setTimeout(r, 100));
  
  const lower = text.toLowerCase();
  let tool = '';
  let result: any = {};
  
  if (/list.*app|show.*app|installed/.test(lower)) {
    tool = 'system.list_apps';
    result = { apps: ['Chrome', 'VS Code', 'Terminal', 'Spotify', 'Slack', 'Discord', 'Figma', 'Docker', 'Notion', 'Obsidian'] };
  } else if (/cpu/.test(lower)) {
    tool = 'monitoring.cpu';
    result = { usage_pct: 45, cores: 8, avg_freq_ghz: 3.2 };
  } else if (/memory|ram/.test(lower)) {
    tool = 'monitoring.memory';
    result = { usage_pct: 62, total_gb: 16, used_gb: 10, free_gb: 6 };
  } else if (/disk/.test(lower)) {
    tool = 'monitoring.disk';
    result = { usage_pct: 58, total_gb: 512, free_gb: 215 };
  } else {
    tool = 'system.list_apps';
    result = { apps: ['Chrome', 'VS Code', 'Terminal'] };
  }
  
  const responseContent = formatDemoResponse(tool, result);
  
  store.addMessage({
    id: uuid(),
    role: 'agent',
    content: responseContent,
    timestamp: Date.now(),
    meta {
      route: 'laya_direct',
      tool,
      latency_ms: 120,
      laya_calls: 2,
      qwen_called: false,
      confidence: 0.94,
    },
  });
  
  store.addMessage({
    id: uuid(),
    role: 'tool',
    content: JSON.stringify(result, null, 2),
    timestamp: Date.now(),
    meta { tool },
  });
  
  store.updateMetrics({
    total_requests: store.metrics.total_requests + 1,
    laya_calls_total: store.metrics.laya_calls_total + 2,
    avg_e2e_latency: 120,
  });
}

function formatDemoResponse(tool: string, result: any): string {
  switch (tool) {
    case 'system.list_apps':
      return `📱 Found ${result.apps.length} applications:\n\n${result.apps.map((app: string, i: number) => `  ${i + 1}. ${app}`).join('\n')}`;
    case 'monitoring.cpu':
      return `CPU Usage: ${result.usage_pct}% across ${result.cores} cores @ ${result.avg_freq_ghz} GHz`;
    case 'monitoring.memory':
      return `Memory: ${result.usage_pct}% used (${result.used_gb}GB / ${result.total_gb}GB), ${result.free_gb}GB free`;
    case 'monitoring.disk':
      return `Disk: ${result.usage_pct}% used, ${result.free_gb}GB free of ${result.total_gb}GB`;
    default:
      return 'Executed successfully.';
  }
}

// ============================================================
// Helpers
// ============================================================

function updatePipelineFromResult(pipeline: PipelineState, result: ProcessRequestResponse): void {
  pipeline.stages[0].status = 'complete';
  pipeline.stages[0].latency_ms = 5;

  if (result.path === 'fast_path') {
    pipeline.stages[1].status = 'complete';
    pipeline.stages[1].latency_ms = 0;
    pipeline.stages[2].status = 'complete';
    pipeline.stages[2].latency_ms = 0;
    pipeline.stages[3].status = 'complete';
    pipeline.stages[3].latency_ms = 0;
    pipeline.stages[4].status = 'complete';
    pipeline.stages[4].latency_ms = result.execution?.latency_ms || 0;
    pipeline.stages[5].status = 'complete';
    pipeline.stages[5].latency_ms = 10;
  } else if (result.path === 'laya_direct') {
    if (result.laya_call_1) {
      pipeline.stages[1].status = 'complete';
      pipeline.stages[1].latency_ms = result.laya_call_1.latency_ms;
    }
    if (result.tools_fetched) {
      pipeline.stages[2].status = 'complete';
      pipeline.stages[2].latency_ms = result.tools_fetched.latency_ms;
    }
    if (result.laya_call_2) {
      pipeline.stages[3].status = 'complete';
      pipeline.stages[3].latency_ms = result.laya_call_2.latency_ms;
    }
    if (result.execution) {
      pipeline.stages[4].status = 'complete';
      pipeline.stages[4].latency_ms = result.execution.latency_ms;
    }
    pipeline.stages[5].status = 'complete';
    pipeline.stages[5].latency_ms = 10;
  } else if (result.path === 'qwen') {
    if (result.laya_call_1) {
      pipeline.stages[1].status = 'complete';
      pipeline.stages[1].latency_ms = result.laya_call_1.latency_ms;
    }
    pipeline.stages[2].status = 'complete';
    pipeline.stages[2].latency_ms = 0;
    pipeline.stages[3].status = 'complete';
    pipeline.stages[3].latency_ms = 0;
    pipeline.stages[4].status = 'complete';
    pipeline.stages[4].latency_ms = 0;
    pipeline.stages[5].status = 'complete';
    pipeline.stages[5].latency_ms = 0;
  }
}

function formatResponse(result: ProcessRequestResponse): string {
  if (result.path === 'qwen' && result.qwen_response) {
    return result.qwen_response;
  }

  if (result.execution) {
    const execResult = result.execution.result as Record<string, unknown>;
    
    switch (result.execution.tool_name) {
      case 'system.list_apps': {
        const apps = execResult.apps as string[];
        return `📱 Found ${apps.length} applications:\n\n${apps.map((app, i) => `  ${i + 1}. ${app}`).join('\n')}`;
      }
      case 'monitoring.cpu':
        return `CPU Usage: ${execResult.usage_pct}% across ${execResult.cores} cores @ ${execResult.avg_freq_ghz} GHz`;
      case 'monitoring.memory':
        return `Memory: ${execResult.usage_pct}% used (${execResult.used_gb}GB / ${execResult.total_gb}GB), ${execResult.free_gb}GB free`;
      case 'monitoring.disk':
        return `Disk: ${execResult.usage_pct}% used, ${execResult.free_gb}GB free of ${execResult.total_gb}GB`;
      case 'system.open_app':
        return `✓ Opened ${execResult.app_name} (PID: ${execResult.pid})`;
      case 'system.close_app':
        return `✓ Closed ${execResult.app_name}`;
      case 'browser.search':
        return `🔍 Searched for "${execResult.query}". Found ${(execResult.results as unknown[]).length} results.`;
      case 'audio.play':
        return `♪ Now playing: ${execResult.source}`;
      case 'audio.pause':
        return `⏸ Media paused`;
      default:
        return `Executed ${result.execution.tool_name} successfully.`;
    }
  }

  return 'Request processed.';
}

export async function processPartialVoice(transcript: string): Promise<{ shouldAct: boolean; action?: string }> {
  const lower = transcript.toLowerCase();
  
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
