"""
Audio Pipeline Module
======================
Open-source audio pipeline for the Hybrid AI Agent.

Input:  Microphone → Speech-to-Text → NormalizedRequest
Output: AgentResponse → Text-to-Speech → Speaker

Uses:
- Whisper (OpenAI) or Vosk for STT
- edge-tts for TTS (free, high quality)
- PyAudio for microphone capture

Streaming: Partial transcripts trigger early Laya decisions
before the user finishes speaking.
"""

import asyncio
import io
import os
import tempfile
import json
from typing import Optional, Callable, Dict, Any
from dataclasses import dataclass

# ============================================================
# STT (Speech-to-Text) Backends
# ============================================================

class STTBackend:
    """Abstract STT backend."""
    async def transcribe(self, audio_data: bytes, sample_rate: int = 16000) -> str:
        raise NotImplementedError
    
    async def transcribe_streaming(self, audio_chunk: bytes) -> Dict:
        """Returns {"text": "...", "is_final": bool, "confidence": float}"""
        raise NotImplementedError


class WhisperSTT(STTBackend):
    """OpenAI Whisper for high-quality transcription."""
    
    def __init__(self, model_size: str = "base"):
        self.model_size = model_size
        self._model = None
    
    def _load_model(self):
        if self._model is None:
            try:
                import whisper
                self._model = whisper.load_model(self.model_size)
            except ImportError:
                raise RuntimeError("Whisper not installed. Run: pip install openai-whisper")
    
    async def transcribe(self, audio_data: bytes, sample_rate: int = 16000) -> str:
        self._load_model()
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_data)
            temp_path = f.name
        
        try:
            result = self._model.transcribe(temp_path)
            return result["text"].strip()
        finally:
            os.unlink(temp_path)


class VoskSTT(STTBackend):
    """Vosk for offline, fast transcription."""
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path
        self._model = None
        self._recognizer = None
    
    def _load_model(self):
        if self._model is None:
            try:
                from vosk import Model, KaldiRecognizer
                self._model = Model(self.model_path or "vosk-model-small-en-us-0.15")
                self._recognizer = KaldiRecognizer(self._model, 16000)
            except ImportError:
                raise RuntimeError("Vosk not installed. Run: pip install vosk")
    
    async def transcribe(self, audio_data: bytes, sample_rate: int = 16000) -> str:
        self._load_model()
        import json as json_module
        
        if self._recognizer.AcceptWaveform(audio_data):
            result = json_module.loads(self._recognizer.Result())
            return result.get("text", "").strip()
        else:
            partial = json_module.loads(self._recognizer.PartialResult())
            return partial.get("partial", "").strip()
    
    async def transcribe_streaming(self, audio_chunk: bytes) -> Dict:
        self._load_model()
        import json as json_module
        
        if self._recognizer.AcceptWaveform(audio_chunk):
            result = json_module.loads(self._recognizer.Result())
            return {"text": result.get("text", "").strip(), "is_final": True, "confidence": 0.9}
        else:
            partial = json_module.loads(self._recognizer.PartialResult())
            return {"text": partial.get("partial", "").strip(), "is_final": False, "confidence": 0.5}


class WebSpeechSTT(STTBackend):
    """
    Web Speech API bridge - uses browser's built-in speech recognition.
    The frontend handles the actual recognition; this just provides the interface.
    """
    
    async def transcribe(self, audio_data: bytes, sample_rate: int = 16000) -> str:
        return ""  # Handled by frontend
    
    async def transcribe_streaming(self, audio_chunk: bytes) -> Dict:
        return {"text": "", "is_final": False, "confidence": 0}


# ============================================================
# TTS (Text-to-Speech) Backends
# ============================================================

class TTSBackend:
    """Abstract TTS backend."""
    async def synthesize(self, text: str) -> bytes:
        raise NotImplementedError


class EdgeTTS(TTSBackend):
    """Microsoft Edge TTS - free, high quality."""
    
    def __init__(self, voice: str = "en-US-AriaNeural"):
        self.voice = voice
    
    async def synthesize(self, text: str) -> bytes:
        try:
            import edge_tts
            
            communicate = edge_tts.Communicate(text, self.voice)
            audio_data = io.BytesIO()
            
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.write(chunk["data"])
            
            return audio_data.getvalue()
        except ImportError:
            raise RuntimeError("edge-tts not installed. Run: pip install edge-tts")


class GTTSTTS(TTSBackend):
    """Google TTS - simple, offline."""
    
    def __init__(self, lang: str = "en"):
        self.lang = lang
    
    async def synthesize(self, text: str) -> bytes:
        try:
            from gtts import gTTS
            
            tts = gTTS(text=text, lang=self.lang)
            audio_data = io.BytesIO()
            tts.write_to_fp(audio_data)
            return audio_data.getvalue()
        except ImportError:
            raise RuntimeError("gTTS not installed. Run: pip install gtts")


# ============================================================
# Audio Pipeline
# ============================================================

@dataclass
class AudioPipelineConfig:
    stt_backend: str = "web_speech"  # whisper, vosk, web_speech
    tts_backend: str = "edge_tts"    # edge_tts, gtts
    tts_voice: str = "en-US-AriaNeural"
    sample_rate: int = 16000
    auto_speak: bool = True
    streaming: bool = True


class AudioPipeline:
    """
    Complete audio pipeline.
    
    Input flow:  Microphone → STT → NormalizedRequest
    Output flow: AgentResponse → TTS → Speaker
    
    Supports streaming partial transcripts for early decisions.
    """
    
    def __init__(self, config: Optional[AudioPipelineConfig] = None):
        self.config = config or AudioPipelineConfig()
        self.stt = self._create_stt()
        self.tts = self._create_tts()
        self._on_partial: Optional[Callable] = None
        self._on_final: Optional[Callable] = None
    
    def _create_stt(self) -> STTBackend:
        if self.config.stt_backend == "whisper":
            return WhisperSTT()
        elif self.config.stt_backend == "vosk":
            return VoskSTT()
        else:
            return WebSpeechSTT()
    
    def _create_tts(self) -> TTSBackend:
        if self.config.tts_backend == "edge_tts":
            return EdgeTTS(self.config.tts_voice)
        else:
            return GTTSTTS()
    
    def on_partial_transcript(self, callback: Callable):
        """Register callback for partial transcripts."""
        self._on_partial = callback
    
    def on_final_transcript(self, callback: Callable):
        """Register callback for final transcripts."""
        self._on_final = callback
    
    async def process_audio(self, audio_data: bytes) -> str:
        """Transcribe audio to text."""
        return await self.stt.transcribe(audio_data, self.config.sample_rate)
    
    async def speak(self, text: str) -> bytes:
        """Convert text to speech audio."""
        return await self.tts.synthesize(text)
    
    async def process_streaming(self, audio_chunk: bytes) -> Dict:
        """Process streaming audio chunk, return partial/final transcript."""
        result = await self.stt.transcribe_streaming(audio_chunk)
        
        if result["is_final"]:
            if self._on_final:
                await self._on_final(result["text"])
        else:
            if self._on_partial:
                await self._on_partial(result["text"])
        
        return result


# ============================================================
# Audio Tools for MCP
# ============================================================

pipeline: Optional[AudioPipeline] = None


async def audio_play(source: str = "", **kwargs) -> Dict:
    """Play audio/media source."""
    # This would integrate with actual media players
    return {"success": True, "source": source, "status": "playing"}


async def audio_pause(**kwargs) -> Dict:
    """Pause audio/media."""
    return {"success": True, "status": "paused"}


async def audio_speak(text: str = "", **kwargs) -> Dict:
    """Convert text to speech."""
    global pipeline
    
    if not pipeline:
        pipeline = AudioPipeline()
    
    try:
        audio_data = await pipeline.speak(text)
        return {"success": True, "text": text, "audio_size": len(audio_data)}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def audio_transcribe(**kwargs) -> Dict:
    """Transcribe audio (placeholder - actual audio from frontend)."""
    return {"success": True, "text": "", "note": "Use frontend voice input"}


def register_audio_tools(registry):
    """Register audio tools with MCP registry."""
    from server import ToolDefinition
    
    registry.register(
        ToolDefinition("audio.play", "audio", "Play audio/media", "low",
                       input_schema={"source": "string"}),
        audio_play
    )
    registry.register(
        ToolDefinition("audio.pause", "audio", "Pause audio/media", "low"),
        audio_pause
    )
    registry.register(
        ToolDefinition("audio.speak", "audio", "Text-to-speech", "low",
                       input_schema={"text": "string"}),
        audio_speak
    )
    registry.register(
        ToolDefinition("audio.transcribe", "audio", "Speech-to-text", "low"),
        audio_transcribe
    )
