import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Layout, Wrench, Activity, Settings, 
  Sparkles, ChevronLeft, ChevronRight, Terminal
} from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import ArchitectureView from './components/ArchitectureView';
import ToolRegistry from './components/ToolRegistry';
import MetricsPanel from './components/MetricsPanel';
import SettingsPanel from './components/SettingsPanel';

type Tab = 'chat' | 'architecture' | 'tools' | 'metrics' | 'settings';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'chat', label: 'Agent Chat', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'architecture', label: 'Architecture', icon: <Layout className="w-4 h-4" /> },
  { id: 'tools', label: 'Tools', icon: <Wrench className="w-4 h-4" /> },
  { id: 'metrics', label: 'Metrics', icon: <Activity className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen w-screen bg-gray-950 text-white flex overflow-hidden">
      {/* Background Gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/3 rounded-full blur-3xl" />
      </div>

      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 220 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 flex flex-col border-r border-gray-800/50 bg-gray-950/80 backdrop-blur-xl"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-800/50">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <h1 className="text-sm font-bold text-white whitespace-nowrap">Hybrid Agent</h1>
                <p className="text-[10px] text-gray-500 whitespace-nowrap">Laya + Qwen + MCP</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <span className="shrink-0">{tab.icon}</span>
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs font-medium whitespace-nowrap"
                  >
                    {tab.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          ))}
        </nav>

        {/* Status Bar */}
        <div className="px-3 py-3 border-t border-gray-800/50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {!sidebarCollapsed && (
              <span className="text-[10px] text-gray-500">System Online</span>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-all z-20"
        >
          {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800/50 bg-gray-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">{tabs.find(t => t.id === activeTab)?.label}</h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-800/50">
              <Terminal className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-gray-400 font-mono">v0.1.0</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/30 border border-gray-700/30">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[10px] text-gray-400">Laya 421M</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/30 border border-gray-700/30">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span className="text-[10px] text-gray-400">Qwen 30B</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/30 border border-gray-700/30">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-gray-400">MCP</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'chat' && (
                <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <ChatInterface />
                  </div>
                  <div className="hidden lg:block">
                    <ArchitectureView />
                  </div>
                </div>
              )}
              {activeTab === 'architecture' && <ArchitectureView />}
              {activeTab === 'tools' && <ToolRegistry />}
              {activeTab === 'metrics' && <MetricsPanel />}
              {activeTab === 'settings' && <SettingsPanel />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
