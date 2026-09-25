"""
MCP Server - Tool Plugins
==========================
Example plugins that can be added to the MCP server.
Each plugin is self-contained and registers its own tools.

To add a new plugin:
1. Create a new file in this directory
2. Define tool handlers
3. Call registry.register() for each tool
4. Import the plugin in server.py
"""

from typing import Dict, Any
from dataclasses import dataclass


# ============================================================
# Example: Git Tools Plugin
# ============================================================
def git_status(**kwargs) -> Dict:
    """Get git repository status."""
    import subprocess
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, cwd=kwargs.get("path", ".")
        )
        lines = result.stdout.strip().split("\n") if result.stdout.strip() else []
        return {
            "status": "clean" if not lines else "dirty",
            "changes": [{"status": l[:2].strip(), "file": l[3:]} for l in lines],
            "count": len(lines),
        }
    except Exception as e:
        return {"error": str(e)}


def git_log(count: int = 5, **kwargs) -> Dict:
    """Get recent git commits."""
    import subprocess
    try:
        result = subprocess.run(
            ["git", "log", f"-{count}", "--oneline", "--no-decorate"],
            capture_output=True, text=True, cwd=kwargs.get("path", ".")
        )
        commits = result.stdout.strip().split("\n") if result.stdout.strip() else []
        return {"commits": commits, "count": len(commits)}
    except Exception as e:
        return {"error": str(e)}


def git_branch(**kwargs) -> Dict:
    """Get current git branch."""
    import subprocess
    try:
        result = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True, text=True, cwd=kwargs.get("path", ".")
        )
        return {"branch": result.stdout.strip()}
    except Exception as e:
        return {"error": str(e)}


# ============================================================
# Example: Database Tools Plugin
# ============================================================
def database_query(query: str = "", db_type: str = "sqlite", **kwargs) -> Dict:
    """Execute a database query (read-only by default)."""
    if not query:
        return {"error": "No query provided"}
    
    # Safety: only allow SELECT queries
    if not query.strip().upper().startswith("SELECT"):
        return {"error": "Only SELECT queries are allowed for safety"}
    
    try:
        import sqlite3
        db_path = kwargs.get("db_path", ":memory:")
        conn = sqlite3.connect(db_path)
        cursor = conn.execute(query)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.close()
        return {"rows": rows, "count": len(rows), "columns": columns}
    except Exception as e:
        return {"error": str(e)}


# ============================================================
# Example: Network Tools Plugin
# ============================================================
def network_ping(host: str = "localhost", **kwargs) -> Dict:
    """Ping a host."""
    import subprocess
    import sys
    try:
        param = "-n" if sys.platform == "win32" else "-c"
        result = subprocess.run(
            ["ping", param, "1", host],
            capture_output=True, text=True, timeout=5
        )
        success = result.returncode == 0
        return {"host": host, "reachable": success}
    except subprocess.TimeoutExpired:
        return {"host": host, "reachable": False, "error": "timeout"}
    except Exception as e:
        return {"error": str(e)}


def network_ports(host: str = "localhost", ports: str = "80,443,3000,8080", **kwargs) -> Dict:
    """Check if ports are open on a host."""
    import socket
    port_list = [int(p.strip()) for p in ports.split(",")]
    results = {}
    for port in port_list:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex((host, port))
            results[str(port)] = "open" if result == 0 else "closed"
            sock.close()
        except Exception:
            results[str(port)] = "error"
    return {"host": host, "ports": results}


# ============================================================
# Example: Smart Home Plugin (placeholder)
# ============================================================
def home_light_on(room: str = "living_room", **kwargs) -> Dict:
    """Turn on lights in a room."""
    # Placeholder - integrate with Home Assistant, Hue, etc.
    return {"success": True, "room": room, "action": "light_on", "note": "placeholder - connect to actual API"}


def home_light_off(room: str = "living_room", **kwargs) -> Dict:
    """Turn off lights in a room."""
    return {"success": True, "room": room, "action": "light_off", "note": "placeholder"}


def home_temperature(room: str = "living_room", **kwargs) -> Dict:
    """Get room temperature."""
    import random
    return {"room": room, "temperature_c": round(20 + random.random() * 5, 1), "note": "placeholder"}


# ============================================================
# Plugin Registration Helper
# ============================================================
def register_git_tools(registry):
    """Register all git tools."""
    from server import ToolDefinition
    registry.register(
        ToolDefinition("git.status", "git", "Get git repository status", "low"),
        git_status
    )
    registry.register(
        ToolDefinition("git.log", "git", "Get recent commits", "low",
                       input_schema={"count": "int"}),
        git_log
    )
    registry.register(
        ToolDefinition("git.branch", "git", "Get current branch", "low"),
        git_branch
    )


def register_network_tools(registry):
    """Register all network tools."""
    from server import ToolDefinition
    registry.register(
        ToolDefinition("network.ping", "network", "Ping a host", "low",
                       input_schema={"host": "string"}),
        network_ping
    )
    registry.register(
        ToolDefinition("network.ports", "network", "Check open ports", "low",
                       input_schema={"host": "string", "ports": "string"}),
        network_ports
    )


def register_home_tools(registry):
    """Register smart home tools."""
    from server import ToolDefinition
    registry.register(
        ToolDefinition("home.light_on", "smart_home", "Turn on lights", "low",
                       input_schema={"room": "string"}),
        home_light_on
    )
    registry.register(
        ToolDefinition("home.light_off", "smart_home", "Turn off lights", "low",
                       input_schema={"room": "string"}),
        home_light_off
    )
    registry.register(
        ToolDefinition("home.temperature", "smart_home", "Get temperature", "low",
                       input_schema={"room": "string"}),
        home_temperature
    )
