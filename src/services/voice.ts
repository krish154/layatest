import { processPartialVoice } from './agent';

export interface VoiceEngine {
  startListening: () => void;
  stopListening: () => void;
  isSupported: () => boolean;
}

type VoiceCallback = {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onPartialDecision: (decision: { shouldAct: boolean; action?: string }) => void;
  onError: (error: string) => void;
  onStatusChange: (listening: boolean) => void;
};

export function createVoiceEngine(callbacks: VoiceCallback): VoiceEngine {
  let recognition: any = null;
  let isListening = false;

  const isSupported = () => {
    return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
  };

  const startListening = () => {
    if (!isSupported()) {
      callbacks.onError('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = async (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        callbacks.onTranscript(interimTranscript, false);
        
        // Stream partial decisions - check if we should act before sentence completes
        const decision = await processPartialVoice(interimTranscript);
        if (decision.shouldAct) {
          callbacks.onPartialDecision(decision);
        }
      }

      if (finalTranscript) {
        callbacks.onTranscript(finalTranscript, true);
      }
    };

    recognition.onerror = (event: any) => {
      callbacks.onError(`Speech recognition error: ${event.error}`);
      isListening = false;
      callbacks.onStatusChange(false);
    };

    recognition.onend = () => {
      if (isListening) {
        // Auto-restart if we're supposed to be listening
        try {
          recognition.start();
        } catch (e) {
          isListening = false;
          callbacks.onStatusChange(false);
        }
      }
    };

    try {
      recognition.start();
      isListening = true;
      callbacks.onStatusChange(true);
    } catch (e) {
      callbacks.onError('Failed to start speech recognition');
    }
  };

  const stopListening = () => {
    isListening = false;
    if (recognition) {
      recognition.stop();
      recognition = null;
    }
    callbacks.onStatusChange(false);
  };

  return { startListening, stopListening, isSupported };
}

// Text-to-Speech
export function speak(text: string, onEnd?: () => void): void {
  if (!('speechSynthesis' in window)) return;
  
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.1;
  utterance.pitch = 1.0;
  utterance.volume = 0.9;
  
  // Try to use a good voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) 
    || voices.find(v => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;
  
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
