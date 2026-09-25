import { motion } from 'framer-motion';
import { Activity, Clock, Zap, Brain, Target, TrendingUp } from 'lucide-react';
import { useAgentStore } from '../store/agentStore';

export default function MetricsPanel() {
  const { metrics, events, layaDecision } = useAgentStore();

  const metricCards = [
    { label: 'Total Requests', value: metrics.total_requests, icon: <Activity className="w-4 h-4" />, color: 'text-violet-400' },
    { label: 'Laya Avg Latency', value: `${metrics.laya_avg_latency}ms`, icon: <Clock className="w-4 h-4" />, color: 'text-amber-400' },
    { label: 'Laya Calls', value: metrics.laya_calls_total, icon: <Zap className="w-4 h-4" />, color: 'text-yellow-400' },
    { label: 'Qwen Calls', value: metrics.qwen_calls_total, icon: <Brain className="w-4 h-4" />, color: 'text-purple-400' },
    { label: 'Direct Exec %', value: `${metrics.direct_execution_pct}%`, icon: <Target className="w-4 h-4" />, color: 'text-emerald-400' },
    { label: 'Avg E2E Latency', value: `${metrics.avg_e2e_latency}ms`, icon: <TrendingUp className="w-4 h-4" />, color: 'text-cyan-400' },
  ];

  const recentEvents = events.slice(-8).reverse();

  return (
    <div className="bg-gray-950/50 rounded-2xl border border-gray-800/50 backdrop-blur-sm h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Observability</h3>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="px-5 py-3 grid grid-cols-3 gap-2">
        {metricCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="p-2.5 rounded-xl bg-gray-800/30 border border-gray-700/30"
          >
            <div className={`${card.color} mb-1`}>{card.icon}</div>
            <div className="text-lg font-bold text-white">{card.value}</div>
            <div className="text-[10px] text-gray-500">{card.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Performance Bars */}
      <div className="px-5 py-2 space-y-2">
        <PerfBar label="Qwen Invocation Rate" value={metrics.qwen_invocation_pct} color="bg-purple-500" target="< 20%" />
        <PerfBar label="Tool Success Rate" value={metrics.tool_success_pct} color="bg-emerald-500" target="> 95%" />
        <PerfBar label="Direct Execution" value={metrics.direct_execution_pct} color="bg-cyan-500" target="> 60%" />
      </div>

      {/* Laya Decision */}
      {layaDecision && (
        <div className="px-5 py-2">
          <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <p className="text-[10px] text-amber-400 font-medium mb-1">Last Laya Decision</p>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-[10px] text-gray-400">Intent: <span className="text-white">{layaDecision.intent}</span></span>
              <span className="text-[10px] text-gray-400">Domain: <span className="text-white">{layaDecision.domain || '-'}</span></span>
              <span className="text-[10px] text-gray-400">Confidence: <span className="text-white">{(layaDecision.confidence * 100).toFixed(0)}%</span></span>
              <span className="text-[10px] text-gray-400">Latency: <span className="text-white">{layaDecision.latency_ms}ms</span></span>
            </div>
          </div>
        </div>
      )}

      {/* Event Log */}
      <div className="flex-1 px-5 pb-3 overflow-hidden flex flex-col">
        <p className="text-[10px] text-gray-500 font-medium mb-1.5">Event Stream</p>
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {recentEvents.map((event) => (
            <div key={event.id} className="flex items-center gap-2 py-0.5">
              <span className="text-[9px] text-gray-600 font-mono w-14">
                {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${getEventColor(event.type)}`}>
                {event.type}
              </span>
              {event.latency_ms && (
                <span className="text-[9px] text-gray-600">{event.latency_ms}ms</span>
              )}
            </div>
          ))}
          {recentEvents.length === 0 && (
            <p className="text-[10px] text-gray-600 italic">No events yet...</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PerfBar({ label, value, color, target }: { label: string; value: number; color: string; target: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-gray-400">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white font-medium">{value}%</span>
          <span className="text-[9px] text-gray-600">{target}</span>
        </div>
      </div>
      <div className="h-1 rounded-full bg-gray-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

function getEventColor(type: string): string {
  if (type.includes('Request') || type.includes('Input')) return 'bg-blue-500/10 text-blue-400';
  if (type.includes('Laya') || type.includes('Fast')) return 'bg-amber-500/10 text-amber-400';
  if (type.includes('Tool') || type.includes('Execute')) return 'bg-emerald-500/10 text-emerald-400';
  if (type.includes('Qwen')) return 'bg-purple-500/10 text-purple-400';
  if (type.includes('Verif')) return 'bg-cyan-500/10 text-cyan-400';
  if (type.includes('Error') || type.includes('Fail')) return 'bg-red-500/10 text-red-400';
  return 'bg-gray-500/10 text-gray-400';
}
