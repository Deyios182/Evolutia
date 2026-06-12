import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Volume2, XCircle } from 'lucide-react';
import { PlayerProgress } from '../types';
import { GoogleGenAI } from '@google/genai';

interface GeminiLiveChatProps {
  progress: PlayerProgress;
  onClose: () => void;
}

export function GeminiLiveChat({ progress, onClose }: GeminiLiveChatProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const liveSessionRef = useRef<any>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const decodeBase64 = (base64: string): Uint8Array => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
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
      if (!apiKey) throw new Error("No VITE_GEMINI_API_KEY en tu .env");

      // 1. Iniciar Audio Síncrono
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      await audioCtx.resume();
      audioCtxRef.current = audioCtx;

      // 2. Pedir Micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 3. Conectar SDK Oficial
      const ai = new GoogleGenAI({ apiKey });
      const session = await ai.models.generateContentLive({
        model: "gemini-2.0-flash-exp",
        config: {
          responseModalities: ["AUDIO"],
          systemInstruction: {
            parts: [{
              text: `Eres ${progress.avatar?.name || 'Nitz'}, un compañero IA leal en el mundo de supervivencia Evolutia. El jugador confía en ti. Sus stats: HP ${progress.hp}/${progress.maxHp}, Oro: ${progress.gold}. Fase ${progress.phase}. Háblale en español directamente. Salúdalo efusivamente ahora mismo para confirmar que me escuchas.`
            }]
          }
        }
      });
      
      liveSessionRef.current = session;

      // 4. Escuchar Respuestas
      session.on('content', async (content: any) => {
        const parts = content.modelTurn?.parts || [];
        for (const part of parts) {
          if (part.text) console.log("Nitz dice:", part.text);
          if (part.inlineData && part.inlineData.data) {
             const bytes = decodeBase64(part.inlineData.data);
             const audioBuffer = await decodeAudioData(bytes, audioCtx);
             
             if (currentSourceRef.current) currentSourceRef.current.stop();
             
             const source = audioCtx.createBufferSource();
             source.buffer = audioBuffer;
             source.connect(audioCtx.destination);
             
             setIsSpeaking(true);
             source.onended = () => setIsSpeaking(false);
             source.start(0);
             currentSourceRef.current = source;
          }
        }
      });

      session.on('close', () => disconnectFromGemini());

      // 5. Iniciar Envío de Audio
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (liveSessionRef.current) {
          const inputData = e.inputBuffer.getChannelData(0);
          liveSessionRef.current.sendRealtimeInput([{
             mimeType: "audio/pcm;rate=16000",
             data: float32ToInt16Base64(inputData)
          }]);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      
      setIsConnected(true);
      setIsConnecting(false);

      // Enviar saludo
      liveSessionRef.current.sendRealtimeInput([{ text: "¡Hola! He encendido el intercomunicador, háblame por voz." }]);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al inicializar.");
      setIsConnecting(false);
    }
  };

  const disconnectFromGemini = () => {
    if (liveSessionRef.current && typeof liveSessionRef.current.close === 'function') {
      try { liveSessionRef.current.close(); } catch(e){}
    }
    if (processorRef.current && audioCtxRef.current) processorRef.current.disconnect();
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close().catch(()=>{});
    setIsConnected(false);
  };

  useEffect(() => {
    return () => disconnectFromGemini();
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto bg-[#0a0a0e] border border-cyan-500/20 rounded-2xl shadow-2xl p-6 relative overflow-hidden flex flex-col items-center">
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/10 to-transparent pointer-events-none" />
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-10"><XCircle className="w-6 h-6" /></button>

      <div className="relative mb-8 mt-4">
        <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${isSpeaking ? 'border-cyan-400 bg-cyan-900/20 scale-110' : 'border-gray-700 bg-[#12131a] scale-100'}`}>
          <Volume2 className={`w-12 h-12 ${isSpeaking ? 'text-cyan-400 animate-pulse' : 'text-gray-600'}`} />
        </div>
        <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-[#0a0a0e] ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
      </div>

      <div className="z-10 w-full">
        {!isConnected ? (
          <button 
            onClick={connectToGemini} disabled={isConnecting}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase rounded-xl transition-all flex items-center justify-center gap-3"
          >
            {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
            {isConnecting ? 'Sincronizando...' : 'Conectar Nitz'}
          </button>
        ) : (
          <button 
            onClick={disconnectFromGemini}
            className="w-full py-4 bg-red-600/20 text-red-400 border border-red-500/30 font-bold uppercase rounded-xl transition-all flex items-center justify-center gap-3"
          >
            <MicOff className="w-5 h-5" /> Terminar
          </button>
        )}
      </div>
    </div>
  );
}
