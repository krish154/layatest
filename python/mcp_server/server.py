"""
MCP (Model Context Protocol) Server
====================================
A modular MCP server that exposes tools for the Hybrid AI Agent.
Tools are registered dynamically and can be added without restarting.

Usage:
    pip install mcp fastapi uvicorn
    python mcp_server/server.py

The server exposes:
    - /mcp/tools          - List available tools
    - /mcp/execute        - Execute a tool
    - /mcp/register       - Register a new tool
    - /health             - Health check
"""

import os
import sys
import json
import asyncio
import importlib
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime

# ============================================================
# Try to import FastAPI, fall back to simple HTTP server
# ============================================================
try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False
    print("FastAPI not installed. Using built-in http.server fallback.")
    print("Install with: pip install fastapi uvicorn")


# ============================================================
# Tool Definition
# ============================================================
@dataclass
class ToolDefinition:
    name: str
    domain: str
    description: str
    risk: str  # low, medium, high, critical
    input_schema: Dict[str, Any] = field(default_factory=dict)
    output_schema: Dict[str, Any] = field(default_factory=dict)
    provider: str = "native"
    enabled: bool = True


@dataclass
class ToolResult:
    tool_name: str
    success: bool
    result: Any
    error: Optional[str] = None
    latency_ms: float = 0.0


# ============================================================
# Tool Registry
# ============================================================
class ToolRegistry:
    """Central registry for all tools. Supports dynamic registration."""
    
    def __init__(self):
        self._tools: Dict[str, ToolDefinition] = {}
        self._handlers: Dict[str, callable] = {}
    
    def register(self, definition: ToolDefinition, handler: callable):
        """Register a new tool with its handler function."""
        self._tools[definition.name] = definition
        self._handlers[definition.name] = handler
        print(f"[MCP] Registered tool: {definition.name} ({definition.domain})")
    
    def unregister(self, name: str):
        """Remove a tool from the registry."""
        if name in self._tools:
            del self._tools[name]
            del self._handlers[name]
            print(f"[MCP] Unregistered tool: {name}")
    
    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        return self._tools.get(name)
    
    def list_tools(self, domain: Optional[str] = None) -> List[ToolDefinition]:
        tools = list(self._tools.values())
        if domain:
            tools = [t for t in tools if t.domain == domain]
        return [t for t in tools if t.enabled]
    
    def list_domains(self) -> List[str]:
        return list(set(t.domain for t in self._tools.values()))
    
    async def execute(self, name: str, arguments: Dict[str, Any]) -> ToolResult:
        """Execute a tool by name with given arguments."""
        start = datetime.now()
        
        tool = self._tools.get(name)
        if not tool:
            return ToolResult(tool_name=name, success=False, result=None, error=f"Tool not found: {name}")
        
        if not tool.enabled:
            return ToolResult(tool_name=name, success=False, result=None, error=f"Tool disabled: {name}")
        
        handler = self._handlers.get(name)
        if not handler:
            return ToolResult(tool_name=name, success=False, result=None, error=f"No handler for: {name}")
        
        try:
            if asyncio.iscoroutinefunction(handler):
                result = await handler(**arguments)
            else:
                result = handler(**arguments)
            
            latency = (datetime.now() - start).total_seconds() * 1000
            return ToolResult(tool_name=name, success=True, result=result, latency_ms=latency)
        except Exception as e:
            latency = (datetime.now() - start).total_seconds() * 1000
            return ToolResult(tool_name=name, success=False, result=None, error=str(e), latency_ms=latency)


# ============================================================
# Built-in Tool Handlers
# ============================================================

def system_list_apps(**kwargs) -> Dict:
    """List installed/running applications."""
    import subprocess
    try:
        if sys.platform == "darwin":
            result = subprocess.run(["ls", "/Applications"], capture_output=True, text=True)
            apps = [a for a in result.stdout.strip().split("\n") if a.endswith(".app")]
            apps = [a.replace(".app", "") for a in apps]
        elif sys.platform == "win32":
            # Windows: list from common locations
            import os
            paths = [
                os.environ.get("PROGRAMFILES", "C:\\Program Files"),
                os.environ.get("PROGRAMFILES(X86)", "C:\\Program Files (x86)"),
            ]
            apps = []
            for p in paths:
                if os.path.exists(p):
                    apps.extend([d for d in os.listdir(p) if os.path.isdir(os.path.join(p, d))])
        else:
            # Linux: list desktop files
            result = subprocess.run(["ls", "/usr/share/applications/"], capture_output=True, text=True)
            apps = [a.replace(".desktop", "") for a in result.stdout.strip().split("\n") if a]
        
        return {"apps": apps[:50], "count": len(apps)}
    except Exception as e:
        return {"apps": [], "error": str(e)}


def system_open_app(app_name: str = "", **kwargs) -> Dict:
    """Open an application by name."""
    import subprocess
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", "-a", app_name])
        elif sys.platform == "win32":
            subprocess.Popen(["start", app_name], shell=True)
        else:
            subprocess.Popen([app_name.lower()])
        return {"success": True, "app_name": app_name, "message": f"Opened {app_name}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def system_close_app(app_name: str = "", **kwargs) -> Dict:
    """Close an application by name."""
    import subprocess
    try:
        if sys.platform == "darwin":
            subprocess.run(["osascript", "-e", f'quit app "{app_name}"'], capture_output=True)
        elif sys.platform == "win32":
            subprocess.run(["taskkill", "/IM", f"{app_name}.exe", "/F"], capture_output=True)
        else:
            subprocess.run(["pkill", "-f", app_name], capture_output=True)
        return {"success": True, "app_name": app_name}
    except Exception as e:
        return {"success": False, "error": str(e)}


def monitoring_cpu(**kwargs) -> Dict:
    """Get CPU usage."""
    try:
        import psutil
        cpu_percent = psutil.cpu_percent(interval=0.5)
        cpu_count = psutil.cpu_count()
        freq = psutil.cpu_freq()
        return {
            "usage_pct": cpu_percent,
            "cores": cpu_count,
            "avg_freq_mhz": round(freq.current, 1) if freq else 0,
        }
    except ImportError:
        import os
        # Fallback: read from /proc/stat on Linux
        if sys.platform == "linux":
            with open("/proc/stat") as f:
                line = f.readline()
            parts = line.split()
            total = sum(int(x) for x in parts[1:])
            idle = int(parts[4])
            usage = round((1 - idle / total) * 100, 1)
            return {"usage_pct": usage, "cores": os.cpu_count(), "note": "fallback"}
        return {"usage_pct": 0, "error": "psutil not installed"}


def monitoring_memory(**kwargs) -> Dict:
    """Get memory usage."""
    try:
        import psutil
        mem = psutil.virtual_memory()
        return {
            "usage_pct": mem.percent,
            "total_gb": round(mem.total / (1024**3), 1),
            "used_gb": round(mem.used / (1024**3), 1),
            "free_gb": round(mem.available / (1024**3), 1),
        }
    except ImportError:
        return {"usage_pct": 0, "error": "psutil not installed. Run: pip install psutil"}


def monitoring_disk(**kwargs) -> Dict:
    """Get disk usage."""
    try:
        import psutil
        disk = psutil.disk_usage("/")
        return {
            "usage_pct": disk.percent,
            "total_gb": round(disk.total / (1024**3), 1),
            "free_gb": round(disk.free / (1024**3), 1),
            "used_gb": round(disk.used / (1024**3), 1),
        }
    except ImportError:
        import shutil
        total, used, free = shutil.disk_usage("/")
        return {
            "usage_pct": round(used / total * 100, 1),
            "total_gb": round(total / (1024**3), 1),
            "free_gb": round(free / (1024**3), 1),
        }


def system_processes(**kwargs) -> Dict:
    """List running processes."""
    try:
        import psutil
        procs = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                info = proc.info
                procs.append({
                    "pid": info['pid'],
                    "name": info['name'],
                    "cpu_pct": round(info['cpu_percent'] or 0, 1),
                    "mem_pct": round(info['memory_percent'] or 0, 1),
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        procs.sort(key=lambda x: x['cpu_pct'], reverse=True)
        return {"processes": procs[:20], "total": len(procs)}
    except ImportError:
        return {"processes": [], "error": "psutil not installed"}


# ============================================================
# Initialize Registry with Built-in Tools
# ============================================================
def create_registry() -> ToolRegistry:
    registry = ToolRegistry()
    
    # System tools
    registry.register(
        ToolDefinition("system.list_apps", "system", "List installed applications", "low"),
        system_list_apps
    )
    registry.register(
        ToolDefinition("system.open_app", "system", "Open an application", "low",
                       input_schema={"app_name": "string"}),
        system_open_app
    )
    registry.register(
        ToolDefinition("system.close_app", "system", "Close an application", "medium",
                       input_schema={"app_name": "string"}),
        system_close_app
    )
    registry.register(
        ToolDefinition("system.processes", "system", "List running processes", "low"),
        system_processes
    )
    
    # Monitoring tools
    registry.register(
        ToolDefinition("monitoring.cpu", "monitoring", "Get CPU usage", "low"),
        monitoring_cpu
    )
    registry.register(
        ToolDefinition("monitoring.memory", "monitoring", "Get memory usage", "low"),
        monitoring_memory
    )
    registry.register(
        ToolDefinition("monitoring.disk", "monitoring", "Get disk usage", "low"),
        monitoring_disk
    )
    
    return registry


# ============================================================
# Server Setup
# ============================================================
registry = create_registry()

if HAS_FASTAPI:
    app = FastAPI(title="MCP Server", version="0.1.0")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    @app.get("/health")
    async def health():
        return {"status": "ok", "tools": len(registry._tools), "domains": registry.list_domains()}
    
    @app.get("/mcp/tools")
    async def list_tools(domain: Optional[str] = None):
        tools = registry.list_tools(domain)
        return {"tools": [asdict(t) for t in tools], "count": len(tools)}
    
    @app.get("/mcp/domains")
    async def list_domains():
        return {"domains": registry.list_domains()}
    
    @app.post("/mcp/execute")
    async def execute_tool(request: dict):
        name = request.get("name")
        arguments = request.get("arguments", {})
        
        if not name:
            raise HTTPException(status_code=400, detail="Tool name required")
        
        result = await registry.execute(name, arguments)
        return asdict(result)
    
    @app.post("/mcp/register")
    async def register_tool(request: dict):
        """Register a new tool dynamically."""
        name = request.get("name")
        domain = request.get("domain", "custom")
        description = request.get("description", "")
        risk = request.get("risk", "low")
        
        if not name:
            raise HTTPException(status_code=400, detail="Tool name required")
        
        definition = ToolDefinition(name=name, domain=domain, description=description, risk=risk)
        # Note: handler must be registered separately or via plugin
        registry._tools[name] = definition
        return {"status": "registered", "tool": asdict(definition)}
    
    def run_server():
        port = int(os.environ.get("MCP_PORT", "3001"))
        print(f"\n{'='*50}")
        print(f"  MCP Server starting on http://localhost:{port}")
        print(f"  Tools registered: {len(registry._tools)}")
        print(f"  Domains: {', '.join(registry.list_domains())}")
        print(f"{'='*50}\n")
        uvicorn.run(app, host="0.0.0.0", port=port)

else:
    # Fallback: simple HTTP server
    from http.server import HTTPServer, BaseHTTPRequestHandler
    
    class MCPHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/health":
                self._respond(200, {"status": "ok", "tools": len(registry._tools)})
            elif self.path == "/mcp/tools":
                tools = registry.list_tools()
                self._respond(200, {"tools": [asdict(t) for t in tools]})
            else:
                self._respond(404, {"error": "Not found"})
        
        def do_POST(self):
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}
            
            if self.path == "/mcp/execute":
                name = body.get("name")
                args = body.get("arguments", {})
                result = asyncio.get_event_loop().run_until_complete(registry.execute(name, args))
                self._respond(200, asdict(result))
            else:
                self._respond(404, {"error": "Not found"})
        
        def _respond(self, status: int, data: dict):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())
    
    def run_server():
        port = int(os.environ.get("MCP_PORT", "3001"))
        server = HTTPServer(("0.0.0.0", port), MCPHandler)
        print(f"MCP Server (fallback) running on http://localhost:{port}")
        server.serve_forever()


# ============================================================
# Register Additional Tool Providers
# ============================================================
def register_all_tools():
    """Register all available tool providers."""
    
    # Browser tools (if playwright available)
    try:
        from browser_module.browser_automation import register_browser_tools
        register_browser_tools(registry)
    except ImportError:
        print("[MCP] Browser module not available (install playwright)")
    
    # Audio tools
    try:
        from audio_pipeline.audio_pipeline import register_audio_tools
        register_audio_tools(registry)
    except ImportError:
        print("[MCP] Audio module not available")
    
    # Plugin tools
    try:
        from tools.plugins import register_git_tools, register_network_tools, register_home_tools
        register_git_tools(registry)
        register_network_tools(registry)
        register_home_tools(registry)
    except ImportError:
        print("[MCP] Plugin tools not available")


# Register all tools on startup
register_all_tools()


if __name__ == "__main__":
    run_server()
