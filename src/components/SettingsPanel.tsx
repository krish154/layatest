import { useState } from 'react';
import { Settings, Server, Brain, Zap, Save, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { useAgentStore } from '../store/agentStore';

export default function SettingsPanel() {
  const { modelConfigs, updateModelConfig } = useAgentStore();
  const [saved, setSaved] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testConnection = async (id: string, endpoint: string) => {
    // Simulate connection test
    setTestResults(prev => ({ ...prev, [id]: false }));
    setTimeout(() => {
      setTestResults(prev => ({ ...prev, [id]: Math.random() > 0.3 }));
    }, 1000);
  };

  return (
    <div className="bg-gray-950/50 rounded-2xl border border-gray-800/50 backdrop-blur-sm h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Configuration</h3>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
            saved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20'
          }`}
        >
          {saved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* Model Configs */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {modelConfigs.map((model) => (
          <div key={model.id} className="p-3 rounded-xl bg-gray-800/30 border border-gray-700/30">
            <div className="flex items-center gap-2 mb-3">
              {model.type === 'decision' ? (
                <Zap className="w-4 h-4 text-amber-400" />
              ) : (
                <Brain className="w-4 h-4 text-purple-400" />
              )}
              <span className="text-sm font-medium text-white">{model.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                model.type === 'decision' ? 'bg-amber-500/10 text-amber-300' : 'bg-purple-500/10 text-purple-300'
              }`}>
                {model.type}
              </span>
            </div>

            {/* Endpoint */}
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Endpoint (llama.cpp server)</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={model.endpoint}
                    onChange={(e) => updateModelConfig(model.id, { endpoint: e.target.value })}
                    className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                  <button
                    onClick={() => testConnection(model.id, model.endpoint)}
                    className="px-2 py-1.5 rounded-lg bg-gray-700/50 text-gray-400 hover:text-white transition-all"
                  >
                    {testResults[model.id] === undefined ? (
                      <Wifi className="w-3.5 h-3.5" />
                    ) : testResults[model.id] ? (
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Max Tokens</label>
                  <input
                    type="number"
                    value={model.max_tokens}
                    onChange={(e) => updateModelConfig(model.id, { max_tokens: parseInt(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    value={model.temperature}
                    onChange={(e) => updateModelConfig(model.id, { temperature: parseFloat(e.target.value) })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Confidence Thresholds */}
        <div className="p-3 rounded-xl bg-gray-800/30 border border-gray-700/30">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">Routing Policy</span>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">High Confidence Threshold (direct execute)</label>
              <input type="range" min="0.5" max="1" step="0.05" defaultValue="0.85" className="w-full accent-violet-500" />
              <div className="flex justify-between text-[9px] text-gray-600">
                <span>0.5</span><span>0.85</span><span>1.0</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Escalation Threshold (→ Qwen)</label>
              <input type="range" min="0.3" max="0.8" step="0.05" defaultValue="0.65" className="w-full accent-purple-500" />
              <div className="flex justify-between text-[9px] text-gray-600">
                <span>0.3</span><span>0.65</span><span>0.8</span>
              </div>
            </div>
          </div>
        </div>

        {/* MCP Server Config */}
        <div className="p-3 rounded-xl bg-gray-800/30 border border-gray-700/30">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">MCP Server</span>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">MCP Endpoint</label>
              <input
                type="text"
                defaultValue="http://localhost:3001/mcp"
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Backend API</label>
              <input
                type="text"
                defaultValue="http://localhost:3000/api"
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
