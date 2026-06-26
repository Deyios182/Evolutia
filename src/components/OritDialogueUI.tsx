import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerProgress, OritQuest, EmotionName, CabinState } from '../types';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface DialogueNode {
  id: string;
  text: string;
  speaker: 'orit' | 'system';
  choices?: { label: string; next: string }[];
  next?: string;
  triggerQuestId?: string;
  isEnd?: boolean;
}

interface OritDialogueUIProps {
  progress: PlayerProgress;
  onSaveProgress: (p: PlayerProgress) => void;
  onClose: (action?: 'open_cabin_system') => void;
  dominantEmotion: EmotionName;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const EMOTION_LABELS: Record<EmotionName, string> = {
  Ira: 'Ira intensa',
  Miedo: 'Miedo profundo',
  Tristeza: 'Tristeza latente',
  Alegría: 'Alegría radiante',
  Confianza: 'Confianza firme',
  Sorpresa: 'Sorpresa curiosa',
  Amor: 'Amor cálido',
  Orgullo: 'Orgullo ardiente',
  Serenidad: 'Serenidad serena',
};

// ─────────────────────────────────────────────────────────────────
// Quest definitions
// ─────────────────────────────────────────────────────────────────
export const ORIT_QUESTS: Record<string, OritQuest> = {
  q1_gather_wood: {
    id: 'q1_gather_wood',
    title: 'Los Primeros Tablones',
    description: 'Sal al vecindario y recoge madera común para reparar las vigas de la cabaña.',
    status: 'active',
    requirements: { wood_common: 10 },
    reward: { gold: 50, exp: 80, unlockUpgradeId: 'forge_basic' },
  },
  q2_gather_stone: {
    id: 'q2_gather_stone',
    title: 'Cimientos Sólidos',
    description: 'La cabaña necesita refuerzos de piedra. Consigue piedra común del exterior.',
    status: 'active',
    requirements: { stone_common: 8 },
    reward: { gold: 60, exp: 100, unlockUpgradeId: 'refiner_basic' },
  },
};

// ─────────────────────────────────────────────────────────────────
// Dialogue tree builders
// ─────────────────────────────────────────────────────────────────
function buildFirstMeetDialogue(dominantEmotion: EmotionName, nitzName: string): DialogueNode[] {
  const emotionLabel = EMOTION_LABELS[dominantEmotion] || 'algo especial';
  return [
    {
      id: 'start',
      speaker: 'orit',
      text: `¡Ey! ¿Eres tú? ¡Por fin despiertas, Guardián!`,
      next: 'cabin_intro',
    },
    {
      id: 'cabin_intro',
      speaker: 'orit',
      text: `Esta cabaña... antes era un santuario. Ahora está algo olvidada. Pero podemos restaurarla juntos.`,
      choices: [
        { label: '¿Qué eres tú exactamente?', next: 'what_are_you' },
        { label: '¡Vamos a empezar!', next: 'nitz_comment' },
      ],
    },
    {
      id: 'what_are_you',
      speaker: 'orit',
      text: `Soy Orit, un Nitz Mentor. He guiado a muchos Guardianes antes que tú. Mi esencia reside en este lugar.`,
      next: 'what_are_you_2',
    },
    {
      id: 'what_are_you_2',
      speaker: 'orit',
      text: `Y ese Nitz que llevas contigo... ${nitzName}... siento su ${emotionLabel} muy fuerte hoy. Cuídalo bien.`,
      next: 'nitz_comment',
    },
    {
      id: 'nitz_comment',
      speaker: 'orit',
      text: `Vuestro vínculo emocional determinará todo en este mundo. Mientras ${nitzName} crezca, tú también lo harás.`,
      next: 'mission_intro',
    },
    {
      id: 'mission_intro',
      speaker: 'orit',
      text: `Pero primero lo primero. Para reparar las vigas del techo necesitamos madera. ¿Puedes conseguir algo del exterior?`,
      next: 'mission_accept',
    },
    {
      id: 'mission_accept',
      speaker: 'system',
      text: `📋 MISIÓN ACTIVADA — "Los Primeros Tablones"\nRecolecta 10 madera común en el vecindario.\nRecompensa: +50 🪙 · +80 EXP · Desbloquea Forja Básica`,
      triggerQuestId: 'q1_gather_wood',
      isEnd: true,
    },
  ];
}

function buildReturnDialogue(progress: PlayerProgress, dominantEmotion: EmotionName): DialogueNode[] {
  const cabinLevel = progress.cabin?.level || 1;
  const nitzName = progress.avatar.name || 'tu Nitz';
  const activeQuest = progress.cabin?.activeQuests?.[0];
  const emotionLabel = EMOTION_LABELS[dominantEmotion] || 'algo especial';

  return [
    {
      id: 'greeting',
      speaker: 'orit',
      text: activeQuest && activeQuest.status === 'active'
        ? `¿Cómo va la misión "${activeQuest.title}"? ${nitzName} también está esperando que avancemos.`
        : cabinLevel >= 2
        ? `¡La cabaña ya tiene vida propia! Siento la ${emotionLabel} de ${nitzName} hoy. Sigue mejorando este lugar.`
        : `¡Guardián! ¿Necesitas algo? La cabaña aún puede mejorar mucho. ¡No te detengas ahora!`,
      choices: [
        { label: '🛠️ Gestionar Cabaña', next: 'open_cabin_system' },
        { label: 'Adiós, Orit', next: 'exit' },
      ],
    },
    {
      id: 'open_cabin_system',
      speaker: 'system',
      text: 'Abriendo el Panel de Gestión de la Cabaña...',
      isEnd: true,
    },
    {
      id: 'exit',
      speaker: 'orit',
      text: '¡Que la luz estelar guíe tu camino!',
      isEnd: true,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────
// Helpers for cabin state
// ─────────────────────────────────────────────────────────────────
function getOrInitCabin(progress: PlayerProgress): CabinState {
  return progress.cabin ?? {
    level: 1,
    upgrades: [],
    activeQuests: [],
    completedQuestIds: [],
    oritMet: false,
    oritDialogueIndex: 0,
  };
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────
export function OritDialogueUI({ progress, onSaveProgress, onClose, dominantEmotion }: OritDialogueUIProps) {
  const isFirstMeet = !progress.cabin?.oritMet;
  const nitzName = progress.avatar.name || 'Nitz';

  const dialogueTree: DialogueNode[] = isFirstMeet
    ? buildFirstMeetDialogue(dominantEmotion, nitzName)
    : buildReturnDialogue(progress, dominantEmotion);

  const [currentNodeId, setCurrentNodeId] = useState<string>(dialogueTree[0]?.id || 'start');
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const fullTextRef = useRef('');
  const typeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentNode = dialogueTree.find(n => n.id === currentNodeId) ?? dialogueTree[0];

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Typewriter
  const startTypewriter = useCallback((text: string) => {
    fullTextRef.current = text;
    setDisplayedText('');
    setIsTyping(true);
    let idx = 0;
    if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
    typeIntervalRef.current = setInterval(() => {
      idx++;
      setDisplayedText(text.slice(0, idx));
      if (idx >= text.length) {
        clearInterval(typeIntervalRef.current!);
        setIsTyping(false);
      }
    }, 28);
  }, []);

  useEffect(() => {
    if (currentNode) startTypewriter(currentNode.text);
    return () => {
      if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
    };
  }, [currentNodeId, startTypewriter]);

  // Skip or advance on click
  const skipOrAdvance = () => {
    if (isTyping) {
      if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
      setDisplayedText(fullTextRef.current);
      setIsTyping(false);
      return;
    }
    if (currentNode?.next && !currentNode?.choices && !currentNode?.isEnd) {
      advanceTo(currentNode.next);
    }
  };

  const advanceTo = (nextId: string) => {
    const nextNode = dialogueTree.find(n => n.id === nextId);
    if (!nextNode) return;

    if (nextNode.triggerQuestId) {
      activateQuest(nextNode.triggerQuestId);
    }

    if (nextId === 'open_cabin_system') {
      setCurrentNodeId(nextId);
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose('open_cabin_system'), 300);
      }, 1000);
      return;
    }

    if (nextNode.isEnd) {
      setCurrentNodeId(nextId);
      setTimeout(() => handleClose(), nextNode.triggerQuestId ? 3500 : 2000);
      return;
    }
    setCurrentNodeId(nextId);
  };

  const activateQuest = (questId: string) => {
    const questTemplate = ORIT_QUESTS[questId];
    if (!questTemplate) return;

    const cabin = getOrInitCabin(progress);
    const alreadyActive = cabin.activeQuests.some(q => q.id === questId);
    const alreadyDone = cabin.completedQuestIds.includes(questId);
    if (alreadyActive || alreadyDone) return;

    const updatedCabin: CabinState = {
      ...cabin,
      oritMet: true,
      activeQuests: [...cabin.activeQuests, { ...questTemplate, status: 'active' }],
    };

    const updatedProg: PlayerProgress = { ...progress, cabin: updatedCabin };
    onSaveProgress(updatedProg);

    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      updateDoc(userRef, { cabin: updatedCabin }).catch(err =>
        console.error('Error updating cabin quest in DB:', err)
      );
    }
  };

  const handleClose = () => {
    // Ensure oritMet is true
    if (isFirstMeet) {
      const cabin = getOrInitCabin(progress);
      if (!cabin.oritMet) {
        const updatedCabin: CabinState = { ...cabin, oritMet: true };
        const updatedProg: PlayerProgress = { ...progress, cabin: updatedCabin };
        onSaveProgress(updatedProg);
        if (auth.currentUser) {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          updateDoc(userRef, { cabin: updatedCabin }).catch(() => {});
        }
      }
    }
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const speakerLabel = currentNode?.speaker === 'orit' ? '🌟 ORIT — Nitz Mentor' : '📋 SISTEMA';
  const isSystem = currentNode?.speaker === 'system';

  const accentColor = isSystem ? 'rgba(251,191,36,0.7)' : 'rgba(167,139,250,0.7)';
  const bgGradient = isSystem
    ? 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(0,0,0,0.88) 100%)'
    : 'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,15,60,0.92) 100%)';
  const borderColor = isSystem ? 'rgba(251,191,36,0.30)' : 'rgba(139,92,246,0.22)';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Soft bottom vignette */}
          <div className="absolute bottom-0 left-0 right-0 h-72 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none" />

          {/* Dialogue bar */}
          <motion.div
            className="relative pointer-events-auto mx-4 mb-5 rounded-2xl border backdrop-blur-xl overflow-hidden"
            style={{
              background: bgGradient,
              borderColor,
              boxShadow: `0 0 32px ${isSystem ? 'rgba(251,191,36,0.1)' : 'rgba(139,92,246,0.1)'}, 0 8px 32px rgba(0,0,0,0.7)`,
            }}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Top accent line */}
            <div
              className="h-px w-full"
              style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
            />

            <div className="p-4 pt-3">
              {/* Speaker row */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2.5">
                  {!isSystem && (
                    <div
                      className="relative w-9 h-9 rounded-full border flex items-center justify-center text-base shrink-0"
                      style={{
                        background: 'radial-gradient(circle at 35% 35%, #ffffff18, #f59e0b33 50%, #000000bb 100%)',
                        borderColor: 'rgba(251,191,36,0.35)',
                        boxShadow: '0 0 14px rgba(251,191,36,0.3)',
                      }}
                    >
                      🌟
                      {/* Pulse ring */}
                      <span
                        className="absolute inset-0 rounded-full animate-ping opacity-20"
                        style={{ border: '1px solid rgba(251,191,36,0.5)' }}
                      />
                    </div>
                  )}
                  <span
                    className="text-[11px] font-bold tracking-[0.2em] uppercase"
                    style={{ color: isSystem ? '#fbbf24' : '#c4b5fd' }}
                  >
                    {speakerLabel}
                  </span>
                </div>
                <button
                  onClick={handleClose}
                  className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors px-2 py-0.5 rounded border border-white/10 hover:border-white/25 leading-none"
                >
                  ESC
                </button>
              </div>

              {/* Dialogue text */}
              <div
                className="text-sm leading-relaxed min-h-[52px] cursor-pointer select-none whitespace-pre-line"
                style={{ color: isSystem ? '#fef3c7' : '#e2e8f0' }}
                onClick={skipOrAdvance}
              >
                {displayedText}
                {isTyping && (
                  <span className="inline-block w-[2px] h-3.5 ml-0.5 bg-current animate-pulse align-middle rounded-full" />
                )}
              </div>

              {/* Choices / continue */}
              {!isTyping && (
                <div className="mt-3">
                  {currentNode?.choices && currentNode.choices.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {currentNode.choices.map(choice => (
                        <button
                          key={choice.next}
                          onClick={() => advanceTo(choice.next)}
                          className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 hover:scale-[1.03] active:scale-95"
                          style={{
                            background: 'rgba(139,92,246,0.12)',
                            borderColor: 'rgba(139,92,246,0.35)',
                            color: '#c4b5fd',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.28)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,92,246,0.12)'; }}
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  ) : !currentNode?.isEnd ? (
                    <button
                      onClick={skipOrAdvance}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      <span>Continuar</span>
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                      >
                        ▶
                      </motion.span>
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
