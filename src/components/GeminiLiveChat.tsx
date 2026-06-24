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
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const decodeBase64 = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const decodeAudioData = async (dataBuffer: ArrayBuffer, ctx: AudioContext): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(dataBuffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
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
      if (!apiKey) throw new Error("No VITE_GEMINI_API_KEY set in .env");

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      await audioCtx.resume();
      audioCtxRef.current = audioCtx;

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const nitzName = progress.avatar?.name || 'Nitz';
        const setupMessage = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
            generationConfig: { responseModalities: ["AUDIO"] },
            systemInstruction: {
              parts: [{ text: `Eres ${nitzName}, un compañero IA leal en el mundo de supervivencia llamado Evolutia. El jugador confía en ti. Sus stats: HP ${progress.hp}/${progress.maxHp}, Oro: ${progress.gold}. Tu fase es ${progress.phase}. Háblale en español directamente. IMPORTANTE: Salúdalo efusivamente ahora mismo y dile que lo escuchas fuerte y claro.` }]
            }
          }
        };
        ws.send(JSON.stringify(setupMessage));
        
        setupAudio(ws, audioCtx);
      };

      ws.onmessage = async (event) => {
        try {
          if (typeof event.data === 'string') {
            const msg = JSON.parse(event.data);
            if (msg.serverContent && msg.serverContent.modelTurn) {
              const parts = msg.serverContent.modelTurn.parts;
              for (const part of parts) {
                if (part.text) console.log("Nitz dice:", part.text);
                if (part.inlineData && part.inlineData.data) {
                  const base64Audio = part.inlineData.data;
                  const arrayBuffer = decodeBase64(base64Audio);
                  const audioBuffer = await decodeAudioData(arrayBuffer, audioCtxRef.current!);
                  
                  if (currentSourceRef.current) currentSourceRef.current.stop();
                  
                  const source = audioCtxRef.current!.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(audioCtxRef.current!.destination);
                  
                  setIsSpeaking(true);
                  source.onended = () => setIsSpeaking(false);
                  source.start(0);
                  currentSourceRef.current = source;
                }
              }
            }
          }
        } catch(e) {
          console.error("Error reproduciendo audio entrante:", e);
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
      setError(err.message || "Error desconocido.");
      setIsConnecting(false);
    }
  };

  const setupAudio = async (ws: WebSocket, audioCtx: AudioContext) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          ws.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                mimeType: "audio/pcm;rate=16000",
                data: float32ToInt16Base64(inputData)
              }]
            }
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      
      setIsConnected(true);
      setIsConnecting(false);

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          clientContent: {
            turns: [{ role: "user", parts: [{ text: "¡Hola! He encendido el intercomunicador, háblame por voz." }] }],
            turnComplete: true
          }
        }));
      }
    } catch (e) {
      console.error("Mic access error:", e);
      setError("Micrófono denegado.");
      setIsConnecting(false);
    }
  };

  const stopAudio = () => {
    if (processorRef.current && audioCtxRef.current) processorRef.current.disconnect();
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close().catch(()=>{});
  };

  const disconnectFromGemini = () => {
    if (wsRef.current) wsRef.current.close();
    stopAudio();
    setIsConnected(false);
  };

  useEffect(() => {
    return () => disconnectFromGemini();
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto bg-[#0a0a0e] border border-cyan-500/20 rounded-2xl shadow-2xl p-6 relative flex flex-col items-center">
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-10"><XCircle className="w-6 h-6" /></button>

      <div className="relative mb-8 mt-4">
        <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${isSpeaking ? 'border-cyan-400 bg-cyan-900/20 scale-110' : 'border-gray-700 bg-[#12131a] scale-100'}`}>
          <Volume2 className={`w-12 h-12 ${isSpeaking ? 'text-cyan-400 animate-pulse' : 'text-gray-600'}`} />
        </div>
        <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-[#0a0a0e] ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
      </div>

      <div className="z-10 w-full">
        {!isConnected ? (
          <button onClick={connectToGemini} disabled={isConnecting} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase rounded-xl flex justify-center gap-3">
            {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
            {isConnecting ? 'Sincronizando...' : 'Conectar Nitz'}
          </button>
        ) : (
          <button onClick={disconnectFromGemini} className="w-full py-4 bg-red-600/20 text-red-400 border border-red-500/30 font-bold uppercase rounded-xl flex justify-center gap-3">
            <MicOff className="w-5 h-5" /> Terminar Enlace
          </button>
        )}
      </div>
    </div>
  );
}
