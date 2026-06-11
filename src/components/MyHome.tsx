import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Sparkles, Send, Award, Trash, Heart } from 'lucide-react';
import { AvatarCustomization, ChatMessage, EmotionVector, EmotionName } from '../types';
import { NitzCanvas, EMOTION_COLORS } from './NitzCanvas';
import { CarePanel } from './CarePanel';

interface MyHomeProps {
  playerProgress: {
    username: string;
    avatar: AvatarCustomization;
    phase: number;
    emotions: EmotionVector;
    gold: number;
    exp: number;
  };
  onUpdateEmotions: (updater: (prev: EmotionVector) => EmotionVector) => void;
  onEvolve: () => void;
  onSpendGold: (amount: number, expGained: number) => boolean;
}

export const MyHome: React.FC<MyHomeProps> = ({
  playerProgress,
  onUpdateEmotions,
  onEvolve,
  onSpendGold,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      sender: 'Nitz de Origen',
      avatarUrl: '',
      text: '*wiggles un poco, flotando suavemente rodeado de mis gemas* ¡Hola hacedor místico! Siento nuestro vínculo resonando cálidamente. ¿Qué tónico místico me darás hoy?',
      timestamp: '15:00',
      isNitz: true,
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Scroller update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const getDominant = (): { name: EmotionName; value: number } => {
    let maxName: EmotionName = 'Alegría';
    let maxValue = -1;
    (Object.keys(playerProgress.emotions) as EmotionName[]).forEach((key) => {
      if (playerProgress.emotions[key] > maxValue) {
        maxValue = playerProgress.emotions[key];
        maxName = key;
      }
    });
    return { name: maxName, value: maxValue };
  };

  const { name: dominantName } = getDominant();
  const playerColorHexStr = EMOTION_COLORS[dominantName].toString(16).padStart(6, '0');

  // Trigger petting feedback from canvas click
  const handlePetAction = () => {
    // Award exp and boost serenity on direct click
    onSpendGold(0, 5);
    onUpdateEmotions((prev) => ({
      ...prev,
      Serenidad: Math.min(100, prev.Serenidad + 4),
      Confianza: Math.min(100, prev.Confianza + 2),
    }));

    // Trigger sweet random petting message
    const petQuotes = [
      `*mis ojos se achican formando tiernas herraduras y doy un salto* ¡Siento tus caricias purificadoras recorrer mis escamas místicas! +5 EXP`,
      `*glowing warm con un suave resplandor* Gracias por el mimo, Guardián... Mi aura rutilante se estabiliza con tu tacto virtuoso.`,
      `*mi cola oscila en ondas serpenteantes de serenidad* El silencio de la cabaña es reconfortante... +5 EXP`,
    ];
    const textMsg = petQuotes[Math.floor(Math.random() * petQuotes.length)];
    
    setMessages((prev) => [
      ...prev,
      {
        id: `pet_${Date.now()}`,
        sender: playerProgress.avatar.name || 'Nitz',
        avatarUrl: '',
        text: textMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isNitz: true,
      }
    ]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userText = inputText;
    setInputText('');

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'Tú',
      avatarUrl: '',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      // Send chat payload to standard secure Express route /api/nitz/chat
      const response = await fetch('/api/nitz/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          currentDominant: dominantName,
          name: playerProgress.avatar.name || 'Nitz de Origen',
          phase: playerProgress.phase,
          accessory: playerProgress.avatar.accessory
        }),
      });

      if (!response.ok) {
        throw new Error('La intercomunicación astral falló.');
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `n_${Date.now()}`,
          sender: playerProgress.avatar.name || 'Nitz de Origen',
          avatarUrl: '',
          text: data.text || '*emite destellos indescifrables*',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isNitz: true,
        },
      ]);
    } catch (err) {
      console.error(err);
      // Fallback
      setMessages((prev) => [
        ...prev,
        {
          id: `n_err_${Date.now()}`,
          sender: playerProgress.avatar.name || 'Nitz de Origen',
          avatarUrl: '',
          text: '*se inclina un poco tímido, brillando tenuemente* La resonancia del bosque es inestable justo ahora... Siento tus buenas intenciones, pero necesito alimentarme de tónicos o caricias.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isNitz: true,
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 md:p-2">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Side: 3D Render & Interactive Sandbox Stage */}
        <div className="lg:col-span-5 flex flex-col justify-between h-[540px] bg-gradient-to-b from-[#111326] to-[#080914] rounded-xl border border-white/10 relative overflow-hidden shadow-2xl p-6 group">
          {/* Volumetric atmosphere backlights */}
          <div 
            className="absolute inset-0 opacity-15 blur-[90px] pointer-events-none transition-all duration-700" 
            style={{ 
              background: `radial-gradient(circle_at_center, #${playerColorHexStr}, transparent 70%)` 
            }}
          />

          {/* Core HUD attributes */}
          <div className="relative z-10 flex items-center justify-between pointer-events-none">
            <div className="space-y-1">
              <span className="text-[10px] text-tertiary font-mono uppercase tracking-wider block">Cabaña de Crianza</span>
              <h2 className="text-xl font-bold font-headline-lg text-white">{playerProgress.avatar.name || 'Nitz de Origen'}</h2>
            </div>
            <div className="flex gap-2">
              <span className="text-[10px] bg-white/5 border border-white/10 text-white font-mono rounded px-2.5 py-1">
                GOLD: {playerProgress.gold}g
              </span>
              <span className="text-[10px] bg-white/5 border border-white/10 text-white font-mono rounded px-2.5 py-1">
                EXP: {playerProgress.exp}
              </span>
            </div>
          </div>

          {/* Interactive Canvas container */}
          <div className="w-full flex-1 flex items-center justify-center relative">
            <NitzCanvas 
              emotions={playerProgress.emotions}
              phase={playerProgress.phase}
              accessory={playerProgress.avatar.accessory}
              clothing={playerProgress.avatar.clothing}
              colorTheme={playerProgress.avatar.colorTheme}
              onPet={handlePetAction}
            />
          </div>

          <div className="relative z-10 text-center pointer-events-none">
            <p className="text-[10px] text-[#919097] uppercase tracking-widest font-mono">
              SISTEMA DE HAPtic INTEGRADO &nbsp;•&nbsp; CLIC EN NITZ PARA ACARICIAR
            </p>
          </div>
        </div>

        {/* Right Side: Care Panel metrics and controls */}
        <div className="lg:col-span-7 flex flex-col justify-between h-[540px]">
          <CarePanel 
            emotions={playerProgress.emotions}
            phase={playerProgress.phase}
            onUpdateEmotions={onUpdateEmotions}
            onEvolve={onEvolve}
            gold={playerProgress.gold}
            exp={playerProgress.exp}
            onSpendGold={onSpendGold}
          />
        </div>

      </div>

      {/* Underneath: Generative AI dialog console */}
      <div className="w-full glass-panel bg-[#121424] border border-white/10 rounded-xl overflow-hidden shadow-xl flex flex-col h-[320px]">
        <div className="bg-[#1b1e32] border-b border-white/5 py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#dec1ac] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">Sintonizador Telepático Nitz (Gemini AI)</span>
          </div>
          <span 
            className="text-[10px] border px-2 py-0.5 rounded uppercase font-mono tracking-widest"
            style={{ 
              borderColor: `#${playerColorHexStr}44`,
              backgroundColor: `#${playerColorHexStr}11`,
              color: `#${playerColorHexStr}`
            }}
          >
            Estado: {dominantName}
          </span>
        </div>

        {/* Messaging Box */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs text-[#c4c5da] custom-scrollbar flex flex-col">
          {messages.map((m) => {
            const isMe = m.sender === 'Tú';
            return (
              <div 
                key={m.id} 
                className={`max-w-[85%] p-3 rounded-lg border leading-relaxed ${
                  isMe 
                    ? 'self-end bg-[#1d1f39] text-white border-white/5 shadow-inner' 
                    : 'self-start bg-[#16182c]/65 text-[#eaeafb] border-white/5'
                }`}
                style={!isMe ? { borderLeft: `2.5px solid #${playerColorHexStr}` } : {}}
              >
                {!isMe && (
                  <span className="text-[10px] font-bold block mb-1 text-tertiary">
                    {m.sender}
                  </span>
                )}
                {m.text}
              </div>
            );
          })}

          {isTyping && (
            <div className="self-start bg-[#16182c]/65 text-[#eaeafb] p-3 rounded-lg border border-white/5 border-l-2 flex items-center gap-1.5" style={{ borderLeftColor: `#${playerColorHexStr}` }}>
              <span className="text-[10px] font-bold text-tertiary mr-1">Canalizando resonancia...</span>
              <span className="w-1.5 h-1.5 bg-tertiary rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-1.5 h-1.5 bg-tertiary rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="w-1.5 h-1.5 bg-tertiary rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Input submission Form */}
        <form onSubmit={handleSendMessage} className="p-3 bg-[#111324] border-t border-white/5 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Susurra un mensaje o pregúntale a Nitz sobre su historia..."
            className="flex-1 bg-[#1c1e32] border border-white/10 p-3.5 rounded text-xs text-[#e0e0fa] placeholder-[#919097] outline-none focus:border-tertiary focus:bg-[#20223a] transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className="p-3.5 bg-[#c4c5da] hover:bg-white text-black disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all active:scale-95 shadow-md flex items-center justify-center font-bold"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        </form>
      </div>

    </div>
  );
};
