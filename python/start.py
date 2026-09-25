#!/usr/bin/env python3
"""
Quick Start Script for Hybrid AI Agent
========================================
Starts all required services:
1. MCP Server (tools)
2. Backend API (orchestrator)

Usage:
    python start.py
    python start.py --mcp-only
    python start.py --api-only
"""

import os
import sys
import subprocess
import argparse
import time


def check_dependencies():
    """Check if required Python packages are installed."""
    missing = []
    
    try:
        import fastapi
    except ImportError:
        missing.append("fastapi")
    
    try:
        import uvicorn
    except ImportError:
        missing.append("uvicorn")
    
    try:
        import httpx
    except ImportError:
        missing.append("httpx")
    
    if missing:
        print(f"\n❌ Missing dependencies: {', '.join(missing)}")
        print(f"   Install with: pip install {' '.join(missing)}")
        print(f"   Or install all: pip install -r requirements.txt\n")
        return False
    
    return True


def check_optional_deps():
    """Check optional dependencies and report status."""
    optional = {
        "playwright": "Browser automation",
        "psutil": "System monitoring",
        "edge_tts": "Text-to-speech",
        "whisper": "Speech-to-text (high quality)",
        "vosk": "Speech-to-text (fast)",
        "langgraph": "Complex task orchestration",
    }
    
    print("\n📦 Optional Dependencies:")
    for pkg, desc in optional.items():
        try:
            __import__(pkg)
            print(f"   ✅ {desc} ({pkg})")
        except ImportError:
            print(f"   ⚠️  {desc} ({pkg}) - not installed")


def start_mcp_server(port=3001):
    """Start the MCP tool server."""
    print(f"\n🔧 Starting MCP Server on port {port}...")
    env = os.environ.copy()
    env["MCP_PORT"] = str(port)
    
    process = subprocess.Popen(
        [sys.executable, "-m", "mcp_server.server"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        env=env,
    )
    return process


def start_api_server(port=3000, laya_endpoint="http://localhost:8080/v1", qwen_endpoint="http://localhost:8081/v1"):
    """Start the backend API server."""
    print(f"\n🧠 Starting Backend API on port {port}...")
    print(f"   Laya: {laya_endpoint}")
    print(f"   Qwen: {qwen_endpoint}")
    
    env = os.environ.copy()
    env["API_PORT"] = str(port)
    env["LAYA_ENDPOINT"] = laya_endpoint
    env["QWEN_ENDPOINT"] = qwen_endpoint
    env["MCP_ENDPOINT"] = f"http://localhost:{3001}"
    
    process = subprocess.Popen(
        [sys.executable, "-m", "backend.api_server"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        env=env,
    )
    return process


def main():
    parser = argparse.ArgumentParser(description="Hybrid AI Agent - Start Script")
    parser.add_argument("--mcp-only", action="store_true", help="Start only MCP server")
    parser.add_argument("--api-only", action="store_true", help="Start only API server")
    parser.add_argument("--mcp-port", type=int, default=3001, help="MCP server port")
    parser.add_argument("--api-port", type=int, default=3000, help="API server port")
    parser.add_argument("--laya", type=str, default="http://localhost:8080/v1", help="Laya endpoint")
    parser.add_argument("--qwen", type=str, default="http://localhost:8081/v1", help="Qwen endpoint")
    
    args = parser.parse_args()
    
    print("""
╔══════════════════════════════════════════════╗
║     Hybrid AI Agent - Laya + Qwen + MCP     ║
╚══════════════════════════════════════════════╝
    """)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    check_optional_deps()
    
    processes = []
    
    try:
        if not args.api_only:
            mcp = start_mcp_server(args.mcp_port)
            processes.append(("MCP Server", mcp))
            time.sleep(1)  # Wait for MCP to start
        
        if not args.mcp_only:
            api = start_api_server(args.api_port, args.laya, args.qwen)
            processes.append(("API Server", api))
        
        print(f"\n✅ All services started!")
        print(f"\n📡 Endpoints:")
        if not args.api_only:
            print(f"   MCP:     http://localhost:{args.mcp_port}")
        if not args.mcp_only:
            print(f"   API:     http://localhost:{args.api_port}")
            print(f"   Health:  http://localhost:{args.api_port}/health")
        
        print(f"\n🖥️  Frontend: Run 'npm run dev' in the project root")
        print(f"\nPress Ctrl+C to stop all services.\n")
        
        # Wait for processes
        while True:
            for name, proc in processes:
                if proc.poll() is not None:
                    print(f"⚠️  {name} exited with code {proc.returncode}")
            time.sleep(1)
    
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping services...")
        for name, proc in processes:
            proc.terminate()
            proc.wait()
            print(f"   ✓ {name} stopped")
        print("\n✅ All services stopped.\n")


if __name__ == "__main__":
    main()
