import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Volume2, XCircle } from 'lucide-react';
import { PlayerProgress } from '../types';

interface GeminiLiveChatProps {
  progress: PlayerProgress;
  onClose: () => void;
}

export function GeminiLiveChat({ progress, onClose }: GeminiLiveChatProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Audio playback queue
  const playQueue = useRef<Float32Array[]>([]);
  const isPlaying = useRef(false);

  // PCM Conversion Helpers
  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const convertInt16ToFloat32 = (int16Array: Int16Array) => {
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    return float32Array;
  };

  const float32ToInt16Base64 = (float32Array: Float32Array) => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      let val = float32Array[i];
      val = Math.max(-1, Math.min(1, val));
      int16Array[i] = val < 0 ? val * 0x8000 : val * 0x7FFF;
    }
    const buffer = int16Array.buffer;
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const connectToGemini = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("No VITE_GEMINI_API_KEY set in .env");
      }

      // 1. Create AudioContext synchronously on user click to bypass Chrome Autoplay Policy
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      await audioCtx.resume(); // Force start
      audioCtxRef.current = audioCtx;

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send Initial Setup
        const nitzName = progress.avatar?.name || 'Nitz';
        const setupMessage = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
            systemInstruction: {
              parts: [{
                text: `Eres ${nitzName}, un compañero IA leal en el mundo de supervivencia llamado Evolutia. Eres astuto, místico y directo. El jugador es un explorador humano que confía en ti. Los stats del jugador son: HP ${progress.hp}/${progress.maxHp}, Oro: ${progress.gold}. Tu personalidad depende de tu fase (Fase ${progress.phase}) y de tu color primario que ahora refleja que eres un aliado de supervivencia. Háblale en español directamente. No describas tus acciones entre asteriscos.`
              }]
            }
          }
        };
        ws.send(JSON.stringify(setupMessage));
        
        // Setup Audio after WebSocket connects
        setupAudio(ws, audioCtx);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          
          if (msg.serverContent && msg.serverContent.modelTurn) {
            const parts = msg.serverContent.modelTurn.parts;
            for (const part of parts) {
              if (part.inlineData && part.inlineData.data) {
                // Audio data received (PCM 24kHz)
                const base64Audio = part.inlineData.data;
                const arrayBuffer = base64ToArrayBuffer(base64Audio);
                const int16Array = new Int16Array(arrayBuffer);
                const float32Array = convertInt16ToFloat32(int16Array);
                
                playQueue.current.push(float32Array);
                if (!isPlaying.current) {
                  playNextAudio();
                }
              }
            }
          }
        }
      };

      ws.onerror = (e) => {
        console.error("Gemini WebSocket Error:", e);
        setError("Error de conexión al servidor de Gemini.");
        setIsConnecting(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        stopAudio();
      };
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error desconocido al inicializar Gemini.");
      setIsConnecting(false);
    }
  };

  const playNextAudio = () => {
    if (playQueue.current.length === 0 || !audioCtxRef.current) {
      isPlaying.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlaying.current = true;
    setIsSpeaking(true);
    const audioData = playQueue.current.shift()!;
    const ctx = audioCtxRef.current;
    
    // Gemini outputs 24kHz PCM
    const buffer = ctx.createBuffer(1, audioData.length, 24000);
    buffer.copyToChannel(audioData, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    source.onended = () => {
      playNextAudio();
    };
    source.start();
  };

  const setupAudio = async (ws: WebSocket, audioCtx: AudioContext) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const source = audioCtx.createMediaStreamSource(stream);
      // Deprecated but widely supported without serving external worklet files
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const base64PCM = float32ToInt16Base64(inputData);
          
          ws.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                mimeType: "audio/pcm;rate=16000",
                data: base64PCM
              }]
            }
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      
      setIsConnected(true);
      setIsConnecting(false);

      // Force Nitz to say hello first
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          clientContent: {
            turns: [{
              role: "user",
              parts: [{ text: "¡Enlace neuronal establecido! Por favor, salúdame brevemente por voz para confirmar la conexión." }]
            }],
            turnComplete: true
          }
        }));
      }

    } catch (e) {
      console.error("Microphone access error:", e);
      setError("Permisos de micrófono denegados.");
      setIsConnecting(false);
    }
  };

  const stopAudio = () => {
    if (processorRef.current && audioCtxRef.current) {
      processorRef.current.disconnect();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
  };

  const disconnectFromGemini = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    stopAudio();
    setIsConnected(false);
  };

  useEffect(() => {
    return () => {
      disconnectFromGemini();
    };
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto bg-[#0a0a0e] border border-cyan-500/20 rounded-2xl shadow-2xl p-6 relative overflow-hidden flex flex-col items-center">
      
      {/* Decorative BG */}
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/10 to-transparent pointer-events-none" />
      <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

      <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10">
        <XCircle className="w-6 h-6" />
      </button>

      <div className="relative mb-8 mt-4">
        <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${isSpeaking ? 'border-cyan-400 bg-cyan-900/20 shadow-[0_0_50px_rgba(34,211,238,0.4)] scale-110' : 'border-gray-700 bg-[#12131a] scale-100'}`}>
          <Volume2 className={`w-12 h-12 ${isSpeaking ? 'text-cyan-400 animate-pulse' : 'text-gray-600'}`} />
        </div>
        
        {/* Connection status dot */}
        <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-[#0a0a0e] ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
      </div>

      <div className="text-center z-10 w-full mb-8">
        <h2 className="text-2xl font-bold font-headline-md tracking-wider text-white mb-2">Conexión Neural</h2>
        <p className="text-sm text-cyan-400/70 font-mono h-8">
          {error ? <span className="text-red-400">{error}</span> : 
           isConnecting ? 'Sincronizando con satélites Gemini...' : 
           isConnected ? 'Canal Bidireccional Establecido. Habla ahora.' : 
           'Compañero IA en estado de hibernación.'}
        </p>
      </div>

      <div className="z-10 w-full">
        {!isConnected ? (
          <button 
            onClick={connectToGemini}
            disabled={isConnecting}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white font-bold tracking-widest uppercase rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
            {isConnecting ? 'Conectando...' : 'Iniciar Transmisión'}
          </button>
        ) : (
          <button 
            onClick={disconnectFromGemini}
            className="w-full py-4 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 font-bold tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            <MicOff className="w-5 h-5" /> Terminar Enlace
          </button>
        )}
      </div>

    </div>
  );
}
