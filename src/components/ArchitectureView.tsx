import { motion } from 'framer-motion';
import { Brain, Zap, Shield, Eye, Hand, Cpu, ArrowDown, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { useAgentStore } from '../store/agentStore';

export default function ArchitectureView() {
  const { status, pipeline, layaDecision, routeDecision } = useAgentStore();

  const getNodeColor = (isActive: boolean, isComplete: boolean) => {
    if (isActive) return 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/20';
    if (isComplete) return 'border-emerald-500/50 bg-emerald-500/5';
    return 'border-gray-700/50 bg-gray-800/30';
  };

  const isActive = (name: string) => pipeline?.stages.some(s => s.name === name && s.status === 'active') ?? false;
  const isComplete = (name: string) => pipeline?.stages.some(s => s.name === name && s.status === 'complete') ?? false;

  return (
    <div className="bg-gray-950/50 rounded-2xl border border-gray-800/50 backdrop-blur-sm p-5 h-full overflow-auto">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Cpu className="w-4 h-4 text-violet-400" />
        Architecture Flow
      </h3>

      <div className="space-y-3">
        {/* User Input */}
        <ArchNode
          icon={<span className="text-lg">👤</span>}
          label="User Input"
          sublabel="Text / Voice / Vision"
          active={status !== 'idle'}
          complete={isComplete('Input')}
        />
        <FlowArrow />

        {/* Input Pipeline */}
        <ArchNode
          icon={<span className="text-lg">📥</span>}
          label="Input Pipeline"
          sublabel="Normalize → Modality → Metadata"
          active={isActive('Input')}
          complete={isComplete('Input')}
        />
        <FlowArrow />

        {/* Fast Path */}
        <ArchNode
          icon={<Zap className="w-4 h-4 text-yellow-400" />}
          label="Fast Path"
          sublabel="Deterministic rules"
          active={isActive('Fast Path')}
          complete={isComplete('Fast Path')}
        />
        <FlowArrow />

        {/* LAYA CALL #1 — "Can you handle this?" */}
        <div className={`rounded-xl border p-3 transition-all ${getNodeColor(isActive('Laya #1'), isComplete('Laya #1'))}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">Laya Call #1</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">System-1</span>
                {layaDecision && (
                  <span className="text-[10px] text-gray-500">{layaDecision.latency_ms}ms</span>
                )}
              </div>
              <p className="text-xs text-gray-500">"Can you handle this request?"</p>
            </div>
            {layaDecision && (
              <div className="text-right">
                <div className={`text-[10px] font-medium ${layaDecision.tool_required ? 'text-emerald-400' : 'text-purple-400'}`}>
                  {layaDecision.tool_required ? '✓ YES' : '✗ NO → Qwen'}
                </div>
                <div className="text-[10px] text-gray-500">Conf: {(layaDecision.confidence * 100).toFixed(0)}%</div>
              </div>
            )}
          </div>
        </div>

        {/* Branch: YES path (Laya handles) vs NO path (Qwen) */}
        <div className="flex items-center gap-2 px-4">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-[10px] text-gray-600">LAYA SAYS: {layaDecision?.tool_required ? '✓ YES' : '?'}</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Laya Direct Path - Two calls: #1 can handle? #2 pick tool */}
          <div className={`rounded-xl border p-3 transition-all ${
            (routeDecision?.path ?? '') === 'laya_direct' ? 'border-amber-500/50 bg-amber-500/5' : 'border-gray-700/30 bg-gray-800/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">Laya Handles (2 calls)</span>
            </div>
            <div className="space-y-1.5">
              <MiniNode label="Fetch Tools" sublabel="Python → ALL tools" active={isActive('Fetch Tools')} complete={isComplete('Fetch Tools')} />
              <MiniNode label="Laya #2" sublabel="Pick 1 tool from ALL" active={isActive('Laya #2')} complete={isComplete('Laya #2')} />
              <MiniNode label="Execute" sublabel="Run selected tool" active={isActive('Execute')} complete={isComplete('Execute')} />
              <MiniNode label="Verify" sublabel="Check result" active={isActive('Verify')} complete={isComplete('Verify')} />
            </div>
          </div>

          {/* Complex Path */}
          <div className={`rounded-xl border p-3 transition-all ${
            routeDecision?.requires_qwen ? 'border-purple-500/50 bg-purple-500/5' : 'border-gray-700/30 bg-gray-800/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-medium text-purple-400">Complex Path</span>
            </div>
            <div className="space-y-1.5">
              <MiniNode label="Qwen 30B" sublabel="Plan & reason" active={false} />
              <MiniNode label="Multi-tool" sublabel="Orchestrate" active={false} />
              <MiniNode label="Synthesize" sublabel="Final answer" active={false} />
            </div>
          </div>
        </div>

        {/* Policy */}
        <FlowArrow />
        <ArchNode
          icon={<Shield className="w-4 h-4 text-red-400" />}
          label="Policy Engine"
          sublabel="Authorize • Validate • Risk check"
          active={false}
          complete={false}
        />
        <FlowArrow />

        {/* Tool Gateway */}
        <ArchNode
          icon={<Hand className="w-4 h-4 text-blue-400" />}
          label="Tool Gateway"
          sublabel="MCP • Browser • Native • API"
          active={isActive('Execute')}
          complete={isComplete('Execute')}
        />
        <FlowArrow />

        {/* Observer + Verifier */}
        <ArchNode
          icon={<Eye className="w-4 h-4 text-cyan-400" />}
          label="Observer → Verifier"
          sublabel="Collect state → Validate result"
          active={isActive('Verify')}
          complete={isComplete('Verify')}
        />
      </div>

      {/* Golden Rules */}
      <div className="mt-4 p-3 rounded-xl bg-gray-800/30 border border-gray-700/30">
        <p className="text-[10px] text-gray-500 font-medium mb-1.5">ROUTING MODES</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <p className="text-[10px] text-gray-400"><span className="text-yellow-300">Fast Path</span> — Deterministic, 0 model calls</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <p className="text-[10px] text-gray-400"><span className="text-amber-300">Laya Direct</span> — 1 Laya call, handles routing + execution</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <p className="text-[10px] text-gray-400"><span className="text-emerald-300">Simple Path</span> — 2 Laya calls (classify + select)</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <p className="text-[10px] text-gray-400"><span className="text-purple-300">Qwen</span> — Complex reasoning, planning</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchNode({ icon, label, sublabel, active, complete }: {
  icon: React.ReactNode; label: string; sublabel: string; active: boolean; complete: boolean;
}) {
  return (
    <motion.div
      animate={active ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 1, repeat: Infinity }}
      className={`rounded-xl border p-3 transition-all ${
        active ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10' :
        complete ? 'border-emerald-500/50 bg-emerald-500/5' :
        'border-gray-700/50 bg-gray-800/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <span className="text-xs font-medium text-white">{label}</span>
          <p className="text-[10px] text-gray-500">{sublabel}</p>
        </div>
        {complete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
      </div>
    </motion.div>
  );
}

function MiniNode({ label, sublabel, active, complete }: { label: string; sublabel: string; active: boolean; complete?: boolean }) {
  return (
    <div className={`px-2 py-1.5 rounded-lg border transition-all ${
      complete ? 'border-emerald-500/50 bg-emerald-500/10' :
      active ? 'border-violet-500/50 bg-violet-500/10' : 'border-gray-700/30 bg-gray-800/20'
    }`}>
      <span className={`text-[10px] font-medium ${complete ? 'text-emerald-300' : active ? 'text-violet-300' : 'text-gray-400'}`}>{label}</span>
      <span className="text-[10px] text-gray-600 ml-1">• {sublabel}</span>
      {complete && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 inline ml-1" />}
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center">
      <ArrowDown className="w-3 h-3 text-gray-700" />
    </div>
  );
}

function DecisionBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
      value ? 'bg-amber-500/10 text-amber-300' : 'bg-gray-800/50 text-gray-600'
    }`}>
      {value ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
      {label}
    </div>
  );
}
