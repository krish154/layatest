# Hybrid AI Agent — Laya + Qwen + MCP

A modular, extensible local AI agent using a dual-model architecture:
- **Laya 421M** — System-1 fast decision engine (reflex)
- **Qwen 30B** — System-2 reasoning engine (brain)
- **MCP** — Tool/capability interface (hands)
- **Pipelines** — Input/output modalities (senses)

## Architecture

```
USER → Input Pipeline → Fast Path → Laya (System-1) → [Tool | Qwen] → Execute → Verify → Response
```

### Key Principles
1. Simple tasks: Laya + tools only (0 Qwen calls, <100ms)
2. Complex tasks: Laya routes to Qwen for reasoning
3. Max 2 Laya calls for tool routing
4. Policy engine is independent of models
5. New tools/modalities = register, don't rewrite

## Quick Start

### Frontend (this app)
```bash
npm install
npm run dev
```

### MCP Server (Python)
```bash
cd python
pip install -r requirements.txt
python mcp_server/server.py
# Runs on http://localhost:3001
```

### Backend API (Python)
```bash
# Start Laya via llama.cpp
./llama-server -m laya-421m.gguf --port 8080

# Start Qwen via llama.cpp  
./llama-server -m qwen-30b.gguf --port 8081

# Start backend
python backend/api_server.py
# Runs on http://localhost:3000
```

### Connecting Models (llama.cpp)

The framework auto-detects llama.cpp server endpoints. Configure via:

```bash
export LAYA_ENDPOINT=http://localhost:8080/v1
export QWEN_ENDPOINT=http://localhost:8081/v1
export MCP_ENDPOINT=http://localhost:3001
```

Or configure in the Settings panel of the UI.

## Project Structure

```
├── src/                    # React frontend
│   ├── App.tsx            # Main dashboard
│   ├── components/        # UI components
│   │   ├── ChatInterface  # Chat + voice input
│   │   ├── ArchitectureView # Live architecture viz
│   │   ├── ToolRegistry   # Tool management
│   │   ├── MetricsPanel   # Observability
│   │   └── SettingsPanel  # Model configuration
│   ├── services/          # Agent engine, voice
│   ├── store/             # Zustand state
│   └── types/             # TypeScript types
│
├── python/
│   ├── mcp_server/        # MCP tool server
│   │   └── server.py      # FastAPI MCP server
│   ├── backend/           # Main backend
│   │   └── api_server.py  # Orchestrator + API
│   └── requirements.txt
│
└── README.md
```

## Adding New Tools

### Option 1: MCP Server (Python)
```python
# In mcp_server/server.py
def my_new_tool(param: str = "", **kwargs) -> Dict:
    return {"result": f"Processed {param}"}

registry.register(
    ToolDefinition("custom.my_tool", "custom", "Does something", "low",
                   input_schema={"param": "string"}),
    my_new_tool
)
```

### Option 2: Frontend (simulated)
Use the Tool Registry panel in the UI to add tools dynamically.

## Voice Chat

The frontend supports real-time voice input via Web Speech API.
As you speak, partial transcripts are analyzed for early action triggering:
- Say "open chrome" → triggers immediately without waiting for full sentence
- Uses Laya-like fast decision on partial input

## Performance Targets

| Metric | Target |
|--------|--------|
| Simple task latency | <200ms |
| Laya calls (simple) | 1-2 |
| Qwen calls (simple) | 0 |
| Direct execution rate | >60% |
| Tool success rate | >95% |

## License

MIT
