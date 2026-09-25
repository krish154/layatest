import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Volume2, VolumeX, Sparkles, Zap, Brain, Cpu } from 'lucide-react';
import { useAgentStore } from '../store/agentStore';
import { processRequest } from '../services/agent';
import { createVoiceEngine, speak, stopSpeaking } from '../services/voice';
import VoiceWaveform from './VoiceWaveform';
import type { VoiceState } from '../types';

export default function ChatInterface() {
  const [input, setInput] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    isSpeaking: false,
    confidence: 0,
  });
  const [autoSpeak, setAutoSpeak] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { conversation, status, metrics, pipeline, addMessage } = useAgentStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Auto-speak new agent messages
  useEffect(() => {
    if (autoSpeak && conversation.length > 0) {
      const lastMsg = conversation[conversation.length - 1];
      if (lastMsg.role === 'agent') {
        setVoiceState(prev => ({ ...prev, isSpeaking: true }));
        speak(lastMsg.content, () => {
          setVoiceState(prev => ({ ...prev, isSpeaking: false }));
        });
      }
    }
  }, [conversation, autoSpeak]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== 'idle') return;
    
    const text = input.trim();
    setInput('');
    
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    });

    await processRequest(text);
  };

  // Voice engine setup
  const voiceEngineRef = useRef<ReturnType<typeof createVoiceEngine> | null>(null);
  
  useEffect(() => {
    voiceEngineRef.current = createVoiceEngine({
      onTranscript: (transcript, isFinal) => {
        if (isFinal) {
          setVoiceState(prev => ({ ...prev, transcript: '', interimTranscript: '' }));
          if (transcript.trim()) {
            addMessage({
              id: crypto.randomUUID(),
              role: 'user',
              content: transcript.trim(),
              timestamp: Date.now(),
            });
            processRequest(transcript.trim());
          }
        } else {
          setVoiceState(prev => ({ ...prev, interimTranscript: transcript }));
        }
      },
      onPartialDecision: (decision) => {
        // Partial decision received - could trigger early action
        console.log('Partial decision:', decision);
      },
      onError: (error) => {
        console.error('Voice error:', error);
        setVoiceState(prev => ({ ...prev, isListening: false }));
      },
      onStatusChange: (listening) => {
        setVoiceState(prev => ({ ...prev, isListening: listening }));
      },
    });
  }, []);

  const toggleVoice = () => {
    if (voiceState.isListening) {
      voiceEngineRef.current?.stopListening();
    } else {
      voiceEngineRef.current?.startListening();
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'idle': return 'text-emerald-400';
      case 'listening': return 'text-blue-400';
      case 'thinking': return 'text-amber-400';
      case 'executing': return 'text-purple-400';
      case 'verifying': return 'text-cyan-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'thinking': return <Brain className="w-4 h-4 animate-pulse" />;
      case 'executing': return <Zap className="w-4 h-4 animate-pulse" />;
      case 'listening': return <Mic className="w-4 h-4 animate-pulse" />;
      default: return <Cpu className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950/50 rounded-2xl border border-gray-800/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-950 ${
              status === 'idle' ? 'bg-emerald-400' : status === 'thinking' ? 'bg-amber-400 animate-pulse' : 'bg-blue-400 animate-pulse'
            }`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Agent</h3>
            <div className="flex items-center gap-1.5">
              {getStatusIcon()}
              <span className={`text-xs ${getStatusColor()} capitalize`}>{status}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`p-2 rounded-lg transition-all ${autoSpeak ? 'bg-violet-500/20 text-violet-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="Auto-speak responses"
          >
            {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <div className="text-xs text-gray-500 font-mono">
            {metrics.total_requests} reqs • {metrics.laya_calls_total} laya • {metrics.qwen_calls_total} qwen
          </div>
        </div>
      </div>

      {/* Pipeline Visualization */}
      {pipeline && (
        <div className="px-5 py-2 border-b border-gray-800/30">
          <div className="flex items-center gap-1">
            {pipeline.stages.map((stage, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  stage.status === 'active' ? 'bg-violet-500/30 text-violet-300 animate-pulse' :
                  stage.status === 'complete' ? 'bg-emerald-500/20 text-emerald-400' :
                  'bg-gray-800/50 text-gray-600'
                }`}>
                  {stage.name}
                  {stage.latency_ms && <span className="ml-1 opacity-60">{stage.latency_ms}ms</span>}
                </div>
                {i < pipeline.stages.length - 1 && (
                  <div className={`w-3 h-px ${stage.status === 'complete' ? 'bg-emerald-500/50' : 'bg-gray-800'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        <AnimatePresence>
          {conversation.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user' 
                  ? 'bg-violet-600 text-white rounded-br-md' 
                  : msg.role === 'tool'
                  ? 'bg-gray-800/80 border border-gray-700/50 text-gray-300 font-mono text-xs rounded-bl-md'
                  : 'bg-gray-800/60 text-gray-100 rounded-bl-md'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.metadata && (
                  <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-white/10">
                    {msg.metadata.route && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                        {msg.metadata.route}
                      </span>
                    )}
                    {msg.metadata.tool && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                        {msg.metadata.tool}
                      </span>
                    )}
                    {msg.metadata.latency_ms && (
                      <span className="text-[10px] text-white/40">
                        {msg.metadata.latency_ms}ms
                      </span>
                    )}
                    {msg.metadata.laya_calls !== undefined && (
                      <span className="text-[10px] text-amber-400/60">
                        L×{msg.metadata.laya_calls}
                      </span>
                    )}
                    {msg.metadata.qwen_called && (
                      <span className="text-[10px] text-purple-400/60">Qwen</span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Voice interim transcript */}
        {voiceState.interimTranscript && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-end"
          >
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-blue-600/30 border border-blue-500/30 text-blue-200 rounded-br-md">
              <p className="text-sm italic">{voiceState.interimTranscript}...</p>
            </div>
          </motion.div>
        )}

        {conversation.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-violet-400" />
            </div>
            <p className="text-sm font-medium text-gray-400">Modular AI Agent</p>
            <p className="text-xs text-gray-600 mt-1">Laya System-1 + Qwen System-2</p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {['Check CPU', 'Open Chrome', 'List apps', 'Search Google for AI'].map(cmd => (
                <button
                  key={cmd}
                  onClick={() => { setInput(cmd); inputRef.current?.focus(); }}
                  className="px-3 py-1.5 rounded-lg bg-gray-800/50 text-xs text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-gray-800/50">
        {/* Voice Waveform */}
        {voiceState.isListening && (
          <div className="mb-2">
            <VoiceWaveform isActive={voiceState.isListening} volume={0.7} />
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleVoice}
            className={`p-2.5 rounded-xl transition-all ${
              voiceState.isListening 
                ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/30 animate-pulse' 
                : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            {voiceState.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={voiceState.isListening ? 'Listening...' : 'Type a command or speak...'}
            className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
            disabled={status !== 'idle'}
          />
          <button
            type="submit"
            disabled={!input.trim() || status !== 'idle'}
            className="p-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 disabled:hover:bg-violet-600 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
