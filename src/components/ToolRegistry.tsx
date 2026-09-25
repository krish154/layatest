import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wrench, ToggleLeft, ToggleRight, Search, Plus, Trash2, Globe, Monitor, HardDrive, Music, FolderOpen } from 'lucide-react';
import { useAgentStore } from '../store/agentStore';

const domainIcons: Record<string, React.ReactNode> = {
  system: <Monitor className="w-3.5 h-3.5" />,
  monitoring: <HardDrive className="w-3.5 h-3.5" />,
  browser: <Globe className="w-3.5 h-3.5" />,
  audio: <Music className="w-3.5 h-3.5" />,
  filesystem: <FolderOpen className="w-3.5 h-3.5" />,
};

const domainColors: Record<string, string> = {
  system: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  monitoring: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  browser: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  audio: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  filesystem: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

const riskColors: Record<string, string> = {
  low: 'text-emerald-400 bg-emerald-500/10',
  medium: 'text-amber-400 bg-amber-500/10',
  high: 'text-red-400 bg-red-500/10',
  critical: 'text-red-500 bg-red-500/20',
};

export default function ToolRegistry() {
  const { tools, toggleTool, removeTool, addTool } = useAgentStore();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newTool, setNewTool] = useState({ name: '', domain: 'system', description: '', risk: 'low' as const });

  const domains = [...new Set(tools.map(t => t.domain))];
  const filtered = tools.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.domain.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!newTool.name) return;
    addTool({
      name: newTool.name,
      domain: newTool.domain,
      description: newTool.description,
      risk: newTool.risk,
      input_schema: {},
      output_schema: {},
      provider: 'custom',
      enabled: true,
    });
    setShowAdd(false);
    setNewTool({ name: '', domain: 'system', description: '', risk: 'low' });
  };

  return (
    <div className="bg-gray-950/50 rounded-2xl border border-gray-800/50 backdrop-blur-sm h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Tool Registry</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{tools.length}</span>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Add Tool Form */}
      {showAdd && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-5 py-3 border-b border-gray-800/50 bg-gray-900/50"
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="tool.name"
              value={newTool.name}
              onChange={e => setNewTool({ ...newTool, name: e.target.value })}
              className="col-span-2 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
            <select
              value={newTool.domain}
              onChange={e => setNewTool({ ...newTool, domain: e.target.value })}
              className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="system">system</option>
              <option value="monitoring">monitoring</option>
              <option value="browser">browser</option>
              <option value="audio">audio</option>
              <option value="filesystem">filesystem</option>
              <option value="mcp">mcp</option>
            </select>
            <select
              value={newTool.risk}
              onChange={e => setNewTool({ ...newTool, risk: e.target.value as any })}
              className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="low">low risk</option>
              <option value="medium">medium risk</option>
              <option value="high">high risk</option>
            </select>
            <input
              placeholder="Description"
              value={newTool.description}
              onChange={e => setNewTool({ ...newTool, description: e.target.value })}
              className="col-span-2 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
            <button
              onClick={handleAdd}
              className="col-span-2 bg-violet-600 text-white text-xs py-1.5 rounded-lg hover:bg-violet-500 transition-all"
            >
              Register Tool
            </button>
          </div>
        </motion.div>
      )}

      {/* Search */}
      <div className="px-5 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            placeholder="Search tools..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700/30 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
          />
        </div>
      </div>

      {/* Domain Filter */}
      <div className="px-5 pb-2 flex gap-1 flex-wrap">
        {domains.map(d => (
          <button
            key={d}
            onClick={() => setSearch(d)}
            className="px-2 py-0.5 rounded text-[10px] border border-gray-700/30 text-gray-400 hover:text-white hover:border-gray-600 transition-all"
          >
            {d}
          </button>
        ))}
      </div>

      {/* Tool List */}
      <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-1.5">
        {filtered.map((tool) => (
          <motion.div
            key={tool.name}
            layout
            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
              tool.enabled ? 'border-gray-700/30 bg-gray-800/20' : 'border-gray-800/30 bg-gray-900/30 opacity-50'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${domainColors[tool.domain] || 'text-gray-400 bg-gray-500/10 border-gray-500/20'}`}>
              {domainIcons[tool.domain] || <Wrench className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-white truncate">{tool.name}</span>
                <span className={`text-[9px] px-1 py-0.5 rounded ${riskColors[tool.risk]}`}>{tool.risk}</span>
              </div>
              <p className="text-[10px] text-gray-500 truncate">{tool.description}</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-gray-600">{tool.provider}</span>
              <button
                onClick={() => toggleTool(tool.name)}
                className="p-1 rounded hover:bg-gray-700/50 transition-all"
              >
                {tool.enabled ? (
                  <ToggleRight className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-4 h-4 text-gray-600" />
                )}
              </button>
              <button
                onClick={() => removeTool(tool.name)}
                className="p-1 rounded hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
