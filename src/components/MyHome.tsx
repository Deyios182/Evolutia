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
  const [isCallActive, setIsCallActive] = useState(false);
  const [isNitzSpeaking, setIsNitzSpeaking] = useState(false);
  const synth = window?.speechSynthesis;

  const chatBottomRef = useRef<HTMLDivElement>(null);

  const playVoice = (text: string) => {
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    let pitch = 1.0;
    let rate = 1.0;
    const dominantName = getDominant().name;

    if (playerProgress.phase === 1) {
      pitch = 1.5; rate = 1.2;
    } else if (dominantName === 'Ira') {
      pitch = 0.9; rate = 1.4;
    } else if (dominantName === 'Tristeza' || dominantName === 'Miedo') {
      pitch = 0.6; rate = 0.8;
    } else if (dominantName === 'Alegría' || dominantName === 'Amor') {
      pitch = 1.2; rate = 1.1;
    }

    utterance.pitch = pitch;
    utterance.rate = rate;
    
    const voices = synth.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith('es'));
    if (esVoice) utterance.voice = esVoice;

    utterance.onstart = () => setIsNitzSpeaking(true);
    utterance.onend = () => setIsNitzSpeaking(false);
    
    synth.speak(utterance);
  };

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

      const badWords = ['tonto', 'mierda', 'estúpido', 'idiota', 'maldito', 'puta', 'cabrón', 'imbécil', 'feo'];
      const isInsult = badWords.some(w => userText.toLowerCase().includes(w));
      
      let extraIraText = '';
      if (isInsult) {
        onUpdateEmotions(prev => ({
          ...prev,
          Ira: Math.min(100, prev.Ira + 15)
        }));
        extraIraText = "¡No me hables así! Siento cómo la ira me consume por dentro.";
      }

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
      const textToSpeak = isInsult ? extraIraText : (data.text || '*emite destellos indescifrables*');

      const newResponseMsg: ChatMessage = {
        id: `n_${Date.now()}`,
        sender: playerProgress.avatar.name || 'Nitz de Origen',
        avatarUrl: '',
        text: textToSpeak,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isNitz: true,
      };

      setMessages((prev) => [...prev, newResponseMsg]);

      if (isCallActive) {
        playVoice(textToSpeak);
      }
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
    <div className="w-full max-w-6xl mx-auto space-y-6 md:p-2 relative">
      <AnimatePresence>
        {isCallActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
          >
            <div className="w-full max-w-sm bg-[#121424] border border-tertiary/40 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-tertiary/5 animate-pulse pointer-events-none" />
              
              <div className="w-24 h-24 rounded-full border-2 border-tertiary/50 bg-[#1b1e32] flex items-center justify-center relative shadow-[0_0_30px_rgba(222,193,172,0.2)]">
                <span className="text-4xl animate-bounce">🐾</span>
                {isNitzSpeaking && (
                  <div className="absolute inset-0 rounded-full border-2 border-tertiary animate-ping opacity-75" />
                )}
              </div>

              <div className="text-center space-y-1 z-10">
                <h3 className="text-xl font-bold text-white">{playerProgress.avatar.name || 'Nitz'}</h3>
                <p className="text-xs text-tertiary font-mono">Conexión Astral Establecida</p>
              </div>

              {/* Waveform Visualization */}
              <div className="flex items-center gap-1 h-8 z-10">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={isNitzSpeaking ? {
                      height: ['10%', '100%', '30%', '80%', '20%'],
                      transition: { repeat: Infinity, duration: 0.5 + Math.random() * 0.5, ease: 'easeInOut' }
                    } : { height: '10%' }}
                    className="w-1.5 bg-emerald-400 rounded-full"
                  />
                ))}
              </div>

              <form 
                onSubmit={handleSendMessage}
                className="w-full mt-2 flex gap-2 z-10"
              >
                <input 
                  type="text" 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Háblale a Nitz..."
                  className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-2 text-xs text-white"
                />
                <button type="submit" disabled={isTyping || !inputText.trim()} className="bg-tertiary hover:bg-white text-black px-3 rounded text-xs font-bold transition-all disabled:opacity-50">Enviar</button>
              </form>

              <div className="w-full pt-4 border-t border-white/10 flex justify-center gap-6 z-10">
                <button 
                  onClick={() => {
                    synth?.cancel();
                    setIsCallActive(false);
                  }}
                  className="bg-red-600 hover:bg-red-500 w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all"
                  title="Colgar Llamada"
                >
                  <Trash className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          <div className="flex items-center gap-2">
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
            <button 
              onClick={() => setIsCallActive(true)}
              className="bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-400/30 text-[10px] px-3 py-1 rounded-md transition-all font-bold tracking-widest"
            >
              📞 Llamada Astral
            </button>
          </div>
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
