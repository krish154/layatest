import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MousePointer, Eye, Zap, Target, Globe, RefreshCw, ChevronRight } from 'lucide-react';

// ============================================================
// Laya UI Element Decision Engine
// ============================================================
// This component simulates Laya making fast decisions about
// which UI elements to interact with on a page.

interface UIElement {
  id: string;
  type: 'button' | 'link' | 'input' | 'text' | 'image' | 'icon';
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
  action: string;
}

interface LayaUIDecision {
  target: UIElement | null;
  action: string;
  confidence: number;
  latency_ms: number;
  reasoning: string;
}

// Simulated page elements
const MOCK_PAGE_ELEMENTS: UIElement[] = [
  { id: 'btn-search', type: 'button', text: 'Search', bbox: { x: 350, y: 120, width: 80, height: 32 }, confidence: 0, action: '' },
  { id: 'btn-login', type: 'button', text: 'Sign In', bbox: { x: 600, y: 20, width: 70, height: 28 }, confidence: 0, action: '' },
  { id: 'input-search', type: 'input', text: 'Search Google', bbox: { x: 150, y: 120, width: 200, height: 32 }, confidence: 0, action: '' },
  { id: 'link-youtube', type: 'link', text: 'YouTube', bbox: { x: 100, y: 200, width: 60, height: 20 }, confidence: 0, action: '' },
  { id: 'link-gmail', type: 'link', text: 'Gmail', bbox: { x: 500, y: 20, width: 40, height: 20 }, confidence: 0, action: '' },
  { id: 'btn-play', type: 'button', text: '▶ Play', bbox: { x: 250, y: 300, width: 60, height: 40 }, confidence: 0, action: '' },
  { id: 'btn-pause', type: 'button', text: '⏸ Pause', bbox: { x: 320, y: 300, width: 60, height: 40 }, confidence: 0, action: '' },
  { id: 'icon-settings', type: 'icon', text: '⚙', bbox: { x: 680, y: 20, width: 24, height: 24 }, confidence: 0, action: '' },
  { id: 'input-email', type: 'input', text: 'Email address', bbox: { x: 200, y: 250, width: 200, height: 32 }, confidence: 0, action: '' },
  { id: 'btn-submit', type: 'button', text: 'Submit', bbox: { x: 300, y: 350, width: 100, height: 36 }, confidence: 0, action: '' },
];

// Laya decision engine for UI elements
function layaDecide(intent: string, elements: UIElement[]): LayaUIDecision {
  const start = performance.now();
  const lower = intent.toLowerCase();
  
  let target: UIElement | null = null;
  let action = '';
  let reasoning = '';
  
  // Fast pattern matching (simulating Laya's System-1)
  if (/search|find|look|google/.test(lower)) {
    target = elements.find(e => e.id === 'input-search') || elements.find(e => e.type === 'input') || null;
    action = 'type';
    reasoning = 'Search intent → input field';
  } else if (/click|press|tap/.test(lower) && /search/.test(lower)) {
    target = elements.find(e => e.id === 'btn-search') || null;
    action = 'click';
    reasoning = 'Click search → button';
  } else if (/play|start|resume/.test(lower)) {
    target = elements.find(e => e.id === 'btn-play') || null;
    action = 'click';
    reasoning = 'Play intent → play button';
  } else if (/pause|stop/.test(lower)) {
    target = elements.find(e => e.id === 'btn-pause') || null;
    action = 'click';
    reasoning = 'Pause intent → pause button';
  } else if (/sign|login|auth/.test(lower)) {
    target = elements.find(e => e.id === 'btn-login') || null;
    action = 'click';
    reasoning = 'Login intent → sign in button';
  } else if (/email|mail/.test(lower)) {
    target = elements.find(e => e.id === 'link-gmail') || elements.find(e => e.id === 'input-email') || null;
    action = target?.type === 'link' ? 'click' : 'type';
    reasoning = 'Email intent → link or input';
  } else if (/submit|send|enter/.test(lower)) {
    target = elements.find(e => e.id === 'btn-submit') || null;
    action = 'click';
    reasoning = 'Submit intent → submit button';
  } else if (/open|navigate|go/.test(lower) && /youtube/.test(lower)) {
    target = elements.find(e => e.id === 'link-youtube') || null;
    action = 'click';
    reasoning = 'YouTube intent → link';
  } else if (/settings|config|gear/.test(lower)) {
    target = elements.find(e => e.id === 'icon-settings') || null;
    action = 'click';
    reasoning = 'Settings intent → gear icon';
  }
  
  // Assign confidence based on match quality
  const confidence = target ? 0.85 + Math.random() * 0.15 : 0;
  
  return {
    target,
    action,
    confidence,
    latency_ms: Math.round(performance.now() - start + 5 + Math.random() * 15),
    reasoning: target ? reasoning : 'No matching element found',
  };
}

export default function LayaUIDecision() {
  const [elements] = useState<UIElement[]>(MOCK_PAGE_ELEMENTS);
  const [intent, setIntent] = useState('');
  const [decision, setDecision] = useState<LayaUIDecision | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<LayaUIDecision[]>([]);

  const analyze = useCallback(() => {
    if (!intent.trim()) return;
    
    setIsAnalyzing(true);
    
    // Simulate Laya processing time (5-20ms)
    setTimeout(() => {
      const result = layaDecide(intent, elements);
      setDecision(result);
      setHighlightedId(result.target?.id || null);
      setIsAnalyzing(false);
      setHistory(prev => [result, ...prev.slice(0, 9)]);
    }, 10 + Math.random() * 20);
  }, [intent, elements]);

  useEffect(() => {
    if (intent.trim()) {
      const timer = setTimeout(analyze, 300); // Debounce
      return () => clearTimeout(timer);
    }
  }, [intent, analyze]);

  return (
    <div className="bg-gray-950/50 rounded-2xl border border-gray-800/50 backdrop-blur-sm h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Laya UI Engine</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">System-1</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[10px] text-gray-500">Page Analyzer</span>
        </div>
      </div>

      {/* Simulated Browser View */}
      <div className="px-5 py-3">
        <div className="relative rounded-xl border border-gray-700/50 bg-gray-900/80 overflow-hidden" style={{ height: 220 }}>
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border-b border-gray-700/30">
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            </div>
            <div className="flex-1 bg-gray-700/30 rounded px-2 py-0.5 text-[10px] text-gray-400 font-mono">
              https://example.com
            </div>
          </div>

          {/* Page content with elements */}
          <div className="relative p-3" style={{ height: 180 }}>
            {elements.map((el) => (
              <motion.div
                key={el.id}
                animate={{
                  borderColor: highlightedId === el.id ? '#8b5cf6' : 'rgba(75,85,99,0.3)',
                  backgroundColor: highlightedId === el.id ? 'rgba(139,92,246,0.15)' : 'rgba(31,41,55,0.5)',
                  scale: highlightedId === el.id ? 1.05 : 1,
                }}
                className="absolute rounded border px-1.5 py-0.5 flex items-center gap-1 cursor-pointer"
                style={{
                  left: `${(el.bbox.x / 750) * 100}%`,
                  top: `${(el.bbox.y / 400) * 100}%`,
                  minWidth: 40,
                }}
                onClick={() => {
                  setHighlightedId(el.id);
                  setDecision({
                    target: el,
                    action: el.type === 'input' ? 'type' : 'click',
                    confidence: 0.95,
                    latency_ms: 0,
                    reasoning: `Manual selection: ${el.text}`,
                  });
                }}
              >
                {el.type === 'button' && <MousePointer className="w-2.5 h-2.5 text-blue-400" />}
                {el.type === 'link' && <ChevronRight className="w-2.5 h-2.5 text-cyan-400" />}
                {el.type === 'input' && <Target className="w-2.5 h-2.5 text-amber-400" />}
                {el.type === 'icon' && <span className="text-[10px]">⚙</span>}
                <span className="text-[9px] text-gray-300 whitespace-nowrap">{el.text}</span>
              </motion.div>
            ))}

            {/* Decision indicator */}
            <AnimatePresence>
              {decision?.target && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  className="absolute w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center z-10"
                  style={{
                    left: `${(decision.target.bbox.x / 750) * 100}%`,
                    top: `${(decision.target.bbox.y / 400) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <Zap className="w-2.5 h-2.5 text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Intent Input */}
      <div className="px-5 py-2">
        <div className="relative">
          <MousePointer className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="What should Laya click? (e.g., 'click search')"
            className="w-full bg-gray-800/50 border border-gray-700/30 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          {isAnalyzing && (
            <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-violet-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Decision Result */}
      <AnimatePresence>
        {decision && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-5 py-2"
          >
            <div className={`p-2.5 rounded-xl border ${
              decision.target ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-white">
                  {decision.target ? `→ ${decision.action} "${decision.target.text}"` : 'No match'}
                </span>
                <span className="text-[10px] text-gray-400">{decision.latency_ms}ms</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-500">
                  Conf: {(decision.confidence * 100).toFixed(0)}%
                </span>
                <span className="text-[10px] text-gray-500">
                  {decision.reasoning}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decision History */}
      <div className="flex-1 px-5 pb-3 overflow-y-auto">
        <p className="text-[10px] text-gray-500 font-medium mb-1.5">Decision History</p>
        <div className="space-y-0.5">
          {history.map((h, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${h.target ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-[10px] text-gray-400 truncate">
                {h.target ? `${h.action} → ${h.target.text}` : 'No match'}
              </span>
              <span className="text-[9px] text-gray-600 ml-auto">{h.latency_ms}ms</span>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-[10px] text-gray-600 italic">Type an intent to see Laya decide...</p>
          )}
        </div>
      </div>
    </div>
  );
}
