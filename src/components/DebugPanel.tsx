import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Clock, Zap, Brain, CheckCircle2, ArrowRight, Target } from 'lucide-react';
import { useAgentStore } from '../store/agentStore';

export default function DebugPanel() {
  const { events, metrics } = useAgentStore();

  // Get the most recent request's events
  const recentEvents = events.slice(-20).reverse();

  const getEventIcon = (type: string) => {
    if (type.includes('LayaCall1')) return <Brain className="w-4 h-4 text-amber-400" />;
    if (type.includes('LayaCall2')) return <Brain className="w-4 h-4 text-orange-400" />;
    if (type.includes('Fetch') || type.includes('Tools')) return <Target className="w-4 h-4 text-cyan-400" />;
    if (type.includes('Tool') || type.includes('Execute')) return <Zap className="w-4 h-4 text-emerald-400" />;
    if (type.includes('Fast')) return <Zap className="w-4 h-4 text-yellow-400" />;
    if (type.includes('Qwen')) return <Brain className="w-4 h-4 text-purple-400" />;
    if (type.includes('Verif')) return <CheckCircle2 className="w-4 h-4 text-teal-400" />;
    if (type.includes('Request') || type.includes('Input')) return <Activity className="w-4 h-4 text-blue-400" />;
    return <Activity className="w-4 h-4 text-gray-400" />;
  };

  const getEventColor = (type: string) => {
    if (type.includes('LayaCall1')) return 'border-amber-500/30 bg-amber-500/5';
    if (type.includes('LayaCall2')) return 'border-orange-500/30 bg-orange-500/5';
    if (type.includes('Fetch') || type.includes('Tools')) return 'border-cyan-500/30 bg-cyan-500/5';
    if (type.includes('Tool') || type.includes('Execute')) return 'border-emerald-500/30 bg-emerald-500/5';
    if (type.includes('Fast')) return 'border-yellow-500/30 bg-yellow-500/5';
    if (type.includes('Qwen')) return 'border-purple-500/30 bg-purple-500/5';
    if (type.includes('Verif')) return 'border-teal-500/30 bg-teal-500/5';
    if (type.includes('Request') || type.includes('Input')) return 'border-blue-500/30 bg-blue-500/5';
    return 'border-gray-700/30 bg-gray-800/30';
  };

  const formatEventData = (type: string, data: Record<string, unknown>) => {
    // Show only the important info, not all data
    if (type.includes('LayaCall1')) {
      return {
        question: data.question || 'Can Laya handle this?',
        answer: data.can_handle ? 'YES' : 'NO',
        confidence: data.confidence ? `${(Number(data.confidence) * 100).toFixed(0)}%` : '-',
      };
    }
    if (type.includes('LayaCall2')) {
      return {
        question: 'Which tool to use?',
        selected: data.selected_tool || '-',
        confidence: data.confidence ? `${(Number(data.confidence) * 100).toFixed(0)}%` : '-',
      };
    }
    if (type.includes('Fetch') || type.includes('Tools')) {
      return {
        source: data.source || 'MCP Server',
        count: data.count || 0,
        domains: Array.isArray(data.domains) ? data.domains.join(', ') : '-',
      };
    }
    if (type.includes('Tool') || type.includes('Execute')) {
      return {
        tool: data.tool || '-',
        success: data.success ? '✓' : '✗',
      };
    }
    if (type.includes('Fast')) {
      return {
        tool: data.tool || '-',
        note: 'Bypassed all models',
      };
    }
    if (type.includes('Qwen')) {
      return {
        reason: data.reason || 'Complex task',
      };
    }
    if (type.includes('Verif')) {
      return {
        success: data.success ? '✓ Passed' : '✗ Failed',
      };
    }
    if (type.includes('Request') || type.includes('Input')) {
      return {
        text: data.text || '-',
        modality: data.modality || 'text',
      };
    }
    return data;
  };

  return (
    <div className="bg-gray-950/50 rounded-2xl border border-gray-800/50 backdrop-blur-sm h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Debug Trace</h3>
          </div>
          <div className="text-[10px] text-gray-500 font-mono">
            {metrics.total_requests} requests
          </div>
        </div>
      </div>

      {/* Event Stream */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        <AnimatePresence>
          {recentEvents.map((event, index) => {
            const eventData = formatEventData(event.type, event.data);
            
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-xl border p-3 ${getEventColor(event.type)}`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-0.5">
                    {getEventIcon(event.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-white">
                        {event.type.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      {event.latency_ms !== undefined && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Clock className="w-3 h-3" />
                          {event.latency_ms}ms
                        </div>
                      )}
                    </div>

                    {/* Data */}
                    <div className="space-y-1">
                      {Object.entries(eventData).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2">
                          <span className="text-[10px] text-gray-500 uppercase min-w-[60px]">
                            {key}:
                          </span>
                          <span className="text-[11px] text-gray-300 break-all">
                            {String(value)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Timestamp */}
                    <div className="mt-1.5 text-[9px] text-gray-600 font-mono">
                      {new Date(event.timestamp).toLocaleTimeString('en-US', { 
                        hour12: false, 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit',
                        fractionalSecondDigits: 3
                      } as any)}
                    </div>
                  </div>
                </div>

                {/* Arrow to next */}
                {index < recentEvents.length - 1 && (
                  <div className="flex justify-center mt-2">
                    <ArrowRight className="w-3 h-3 text-gray-700 rotate-90" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {recentEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Activity className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No events yet</p>
            <p className="text-xs text-gray-600 mt-1">Send a request to see the trace</p>
          </div>
        )}
      </div>

      {/* Summary */}
      {recentEvents.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-800/50 bg-gray-900/30">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-amber-400">
                {recentEvents.filter(e => e.type.includes('Laya')).length}
              </div>
              <div className="text-[9px] text-gray-500">Laya Calls</div>
            </div>
            <div>
              <div className="text-lg font-bold text-emerald-400">
                {recentEvents.filter(e => e.type.includes('Tool')).length}
              </div>
              <div className="text-[9px] text-gray-500">Tools Used</div>
            </div>
            <div>
              <div className="text-lg font-bold text-cyan-400">
                {recentEvents.reduce((sum, e) => sum + (e.latency_ms || 0), 0)}ms
              </div>
              <div className="text-[9px] text-gray-500">Total Time</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
