"""
Backend API Server for Hybrid AI Agent
=======================================
This is the main backend that connects:
- Laya (System-1) via llama.cpp endpoint
- Qwen (System-2) via llama.cpp endpoint  
- MCP Server for tool execution
- Browser automation (Playwright)

Usage:
    pip install fastapi uvicorn httpx playwright
    playwright install chromium
    python backend/api_server.py

Environment variables:
    LAYA_ENDPOINT   - Laya model endpoint (default: http://localhost:8080/v1)
    QWEN_ENDPOINT   - Qwen model endpoint (default: http://localhost:8081/v1)
    MCP_ENDPOINT    - MCP server endpoint (default: http://localhost:3001)
"""

import os
import json
import time
import asyncio
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
    import httpx
    HAS_DEPS = True
except ImportError:
    HAS_DEPS = False
    print("Missing dependencies. Install with:")
    print("  pip install fastapi uvicorn httpx")


# ============================================================
# Configuration
# ============================================================
@dataclass
class Config:
    laya_endpoint: str = os.environ.get("LAYA_ENDPOINT", "http://localhost:8080/v1")
    qwen_endpoint: str = os.environ.get("QWEN_ENDPOINT", "http://localhost:8081/v1")
    mcp_endpoint: str = os.environ.get("MCP_ENDPOINT", "http://localhost:3001")
    laya_max_tokens: int = 256
    laya_temperature: float = 0.1
    qwen_max_tokens: int = 4096
    qwen_temperature: float = 0.7
    confidence_threshold: float = 0.85
    escalation_threshold: float = 0.65


config = Config()


# ============================================================
# Model Clients (llama.cpp compatible)
# ============================================================
class LlamaCppClient:
    """Client for llama.cpp server (OpenAI-compatible API)."""
    
    def __init__(self, endpoint: str, max_tokens: int = 256, temperature: float = 0.1):
        self.endpoint = endpoint
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.client = httpx.AsyncClient(timeout=30.0) if HAS_DEPS else None
    
    async def complete(self, prompt: str, system: str = "", max_tokens: Optional[int] = None) -> str:
        """Send a completion request to llama.cpp server."""
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = await self.client.post(
                f"{self.endpoint}/chat/completions",
                json={
                    "messages": messages,
                    "max_tokens": max_tokens or self.max_tokens,
                    "temperature": self.temperature,
                    "stream": False,
                }
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"[Model] Error: {e}")
            return f"Error: {str(e)}"
    
    async def complete_json(self, prompt: str, system: str = "") -> Dict:
        """Get a JSON response from the model."""
        raw = await self.complete(prompt, system)
        try:
            # Try to extract JSON from response
            if "{" in raw:
                start = raw.index("{")
                end = raw.rindex("}") + 1
                return json.loads(raw[start:end])
        except (json.JSONDecodeError, ValueError):
            pass
        return {"raw": raw, "error": "Could not parse JSON"}


# ============================================================
# Laya System-1 Engine
# ============================================================
class LayaEngine:
    """System-1 fast decision engine using Laya 421M."""
    
    INITIAL_CLASSIFICATION_PROMPT = """Analyze this user request and make fast routing decisions.

User request: "{text}"

Respond with ONLY a JSON object (no markdown, no explanation):
{{
    "tool_required": true/false,
    "browser_required": true/false,
    "reasoning_required": true/false,
    "risk": "low/medium/high/critical",
    "multi_step": true/false,
    "intent": "brief intent description",
    "confidence": 0.0-1.0,
    "domain": "system/monitoring/browser/audio/filesystem/null"
}}"""

    TOOL_SELECTION_PROMPT = """Select the best tool for this request.

User request: "{text}"
Available tools in domain '{domain}':
{tool_list}

Respond with ONLY a JSON object:
{{
    "tool": "exact tool name",
    "arguments": {{}},
    "confidence": 0.0-1.0
}}"""

    def __init__(self, client: LlamaCppClient):
        self.client = client
    
    async def classify(self, text: str) -> Dict:
        """Initial classification - determines routing."""
        prompt = self.INITIAL_CLASSIFICATION_PROMPT.format(text=text)
        start = time.time()
        result = await self.client.complete_json(prompt)
        result["latency_ms"] = round((time.time() - start) * 1000)
        return result
    
    async def select_tool(self, text: str, domain: str, tools: List[Dict]) -> Dict:
        """Select specific tool from domain."""
        tool_list = "\n".join([f"- {t['name']}: {t['description']}" for t in tools])
        prompt = self.TOOL_SELECTION_PROMPT.format(text=text, domain=domain, tool_list=tool_list)
        start = time.time()
        result = await self.client.complete_json(prompt)
        result["latency_ms"] = round((time.time() - start) * 1000)
        return result


# ============================================================
# Qwen System-2 Engine
# ============================================================
class QwenEngine:
    """System-2 reasoning engine using Qwen 30B."""
    
    REASONING_PROMPT = """You are a reasoning engine. Analyze the request and create a plan.

User request: {text}
Available tools: {tools}
Context: {context}

Create a step-by-step plan. For each step, specify if a tool is needed.
Respond with a JSON object:
{{
    "analysis": "brief analysis",
    "plan": [
        {{"step": 1, "action": "description", "tool": "tool_name or null", "args": {{}}}}
    ],
    "estimated_complexity": "low/medium/high"
}}"""

    def __init__(self, client: LlamaCppClient):
        self.client = client
    
    async def reason(self, text: str, tools: List[Dict], context: Dict = None) -> Dict:
        """Generate a reasoning plan."""
        tool_str = json.dumps([{"name": t["name"], "desc": t["description"]} for t in tools[:20]])
        prompt = self.REASONING_PROMPT.format(
            text=text,
            tools=tool_str,
            context=json.dumps(context or {})
        )
        start = time.time()
        result = await self.client.complete_json(prompt)
        result["latency_ms"] = round((time.time() - start) * 1000)
        return result


# ============================================================
# Orchestrator
# ============================================================
class Orchestrator:
    """Main orchestrator connecting Laya, Qwen, and tools."""
    
    def __init__(self):
        self.laya_client = LlamaCppClient(config.laya_endpoint, config.laya_max_tokens, config.laya_temperature)
        self.qwen_client = LlamaCppClient(config.qwen_endpoint, config.qwen_max_tokens, config.qwen_temperature)
        self.laya = LayaEngine(self.laya_client)
        self.qwen = QwenEngine(self.qwen_client)
        self.mcp_client = httpx.AsyncClient(timeout=30.0) if HAS_DEPS else None
    
    async def get_tools(self, domain: Optional[str] = None) -> List[Dict]:
        """Fetch available tools from MCP server."""
        try:
            url = f"{config.mcp_endpoint}/mcp/tools"
            if domain:
                url += f"?domain={domain}"
            response = await self.mcp_client.get(url)
            data = response.json()
            return data.get("tools", [])
        except Exception as e:
            print(f"[Orchestrator] MCP error: {e}")
            return []
    
    async def execute_tool(self, name: str, arguments: Dict) -> Dict:
        """Execute a tool via MCP server."""
        try:
            response = await self.mcp_client.post(
                f"{config.mcp_endpoint}/mcp/execute",
                json={"name": name, "arguments": arguments}
            )
            return response.json()
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def process(self, text: str) -> Dict:
        """Main processing pipeline."""
        start_time = time.time()
        events = []
        
        # Step 1: Laya classification
        events.append({"type": "laya_start", "timestamp": time.time()})
        laya_decision = await self.laya.classify(text)
        events.append({"type": "laya_complete", "data": laya_decision, "timestamp": time.time()})
        
        # Check confidence
        confidence = laya_decision.get("confidence", 0)
        reasoning_required = laya_decision.get("reasoning_required", False)
        multi_step = laya_decision.get("multi_step", False)
        
        # Step 2: Route based on decision
        if reasoning_required or multi_step or confidence < config.escalation_threshold:
            # Complex path - use Qwen
            events.append({"type": "qwen_required", "timestamp": time.time()})
            tools = await self.get_tools()
            qwen_plan = await self.qwen.reason(text, tools)
            events.append({"type": "qwen_complete", "data": qwen_plan, "timestamp": time.time()})
            
            # Execute plan steps
            results = []
            for step in qwen_plan.get("plan", []):
                if step.get("tool"):
                    result = await self.execute_tool(step["tool"], step.get("args", {}))
                    results.append({"step": step["step"], "tool": step["tool"], "result": result})
                    events.append({"type": "tool_executed", "data": {"tool": step["tool"]}, "timestamp": time.time()})
            
            total_latency = round((time.time() - start_time) * 1000)
            return {
                "path": "qwen",
                "laya_decision": laya_decision,
                "qwen_plan": qwen_plan,
                "tool_results": results,
                "total_latency_ms": total_latency,
                "events": events,
            }
        
        elif laya_decision.get("tool_required", False):
            # Simple tool path - Laya selects tool
            domain = laya_decision.get("domain", "system")
            tools = await self.get_tools(domain)
            
            events.append({"type": "laya_tool_select_start", "timestamp": time.time()})
            tool_decision = await self.laya.select_tool(text, domain, tools)
            events.append({"type": "laya_tool_select_complete", "data": tool_decision, "timestamp": time.time()})
            
            tool_name = tool_decision.get("tool", "")
            tool_args = tool_decision.get("arguments", {})
            
            # Execute tool
            result = await self.execute_tool(tool_name, tool_args)
            events.append({"type": "tool_executed", "data": {"tool": tool_name, "result": result}, "timestamp": time.time()})
            
            total_latency = round((time.time() - start_time) * 1000)
            return {
                "path": "direct_tool",
                "laya_decisions": [laya_decision, tool_decision],
                "tool": tool_name,
                "tool_result": result,
                "total_latency_ms": total_latency,
                "events": events,
            }
        
        else:
            # Direct response - no tool needed
            total_latency = round((time.time() - start_time) * 1000)
            return {
                "path": "direct_response",
                "laya_decision": laya_decision,
                "total_latency_ms": total_latency,
                "events": events,
            }


# ============================================================
# FastAPI Server
# ============================================================
if HAS_DEPS:
    app = FastAPI(title="Hybrid AI Agent Backend", version="0.1.0")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    orchestrator = Orchestrator()
    
    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "laya_endpoint": config.laya_endpoint,
            "qwen_endpoint": config.qwen_endpoint,
            "mcp_endpoint": config.mcp_endpoint,
        }
    
    @app.post("/api/process")
    async def process_request(request: dict):
        text = request.get("text", "")
        if not text:
            raise HTTPException(status_code=400, detail="Text required")
        
        result = await orchestrator.process(text)
        return result
    
    @app.get("/api/tools")
    async def get_tools(domain: Optional[str] = None):
        tools = await orchestrator.get_tools(domain)
        return {"tools": tools}
    
    @app.post("/api/execute")
    async def execute_tool(request: dict):
        name = request.get("name")
        arguments = request.get("arguments", {})
        if not name:
            raise HTTPException(status_code=400, detail="Tool name required")
        result = await orchestrator.execute_tool(name, arguments)
        return result
    
    @app.get("/api/config")
    async def get_config():
        return asdict(config)
    
    @app.post("/api/config")
    async def update_config(request: dict):
        for key, value in request.items():
            if hasattr(config, key):
                setattr(config, key, value)
        return asdict(config)
    
    def run():
        port = int(os.environ.get("API_PORT", "3000"))
        print(f"\n{'='*50}")
        print(f"  Backend API: http://localhost:{port}")
        print(f"  Laya: {config.laya_endpoint}")
        print(f"  Qwen: {config.qwen_endpoint}")
        print(f"  MCP:  {config.mcp_endpoint}")
        print(f"{'='*50}\n")
        uvicorn.run(app, host="0.0.0.0", port=port)

else:
    def run():
        print("FastAPI not installed. Cannot start backend.")
        print("Install with: pip install fastapi uvicorn httpx")


if __name__ == "__main__":
    run()
