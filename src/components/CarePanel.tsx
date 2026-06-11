import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Soup, Heart, Leaf, HelpCircle, Trophy, RefreshCw, Star } from 'lucide-react';
import { EmotionName, EmotionVector } from '../types';
import { EMOTION_COLORS } from './NitzCanvas';

interface CarePanelProps {
  emotions: EmotionVector;
  phase: number;
  onUpdateEmotions: (updater: (prev: EmotionVector) => EmotionVector) => void;
  onEvolve: () => void;
  gold: number;
  exp: number;
  onSpendGold: (amount: number, expGained: number) => boolean;
}

export const CarePanel: React.FC<CarePanelProps> = ({
  emotions,
  phase,
  onUpdateEmotions,
  onEvolve,
  gold,
  exp,
  onSpendGold,
}) => {
  const [activeTab, setActiveTab] = useState<'tonicos' | 'actividades'>('tonicos');
  const [evolutionExplosion, setEvolutionExplosion] = useState(false);

  // Math calculated dominant
  const getDominant = (): { name: EmotionName; value: number } => {
    let maxName: EmotionName = 'Alegría';
    let maxValue = -1;
    (Object.keys(emotions) as EmotionName[]).forEach((key) => {
      if (emotions[key] > maxValue) {
        maxValue = emotions[key];
        maxName = key;
      }
    });
    return { name: maxName, value: maxValue };
  };

  const { name: dominantName, value: dominantVal } = getDominant();
  const domColorHexStr = EMOTION_COLORS[dominantName].toString(16).padStart(6, '0');

  // Multi-choice elements: 9 emotional tónicos with prices
  const TONICOS = [
    { name: 'Rocío de Alegría', cost: 15, emotion: 'Alegría', plus: 20, minus: 'Tristeza' },
    { name: 'Esencia de Amor', cost: 15, emotion: 'Amor', plus: 20, minus: 'Miedo' },
    { name: 'Brebaje de Sorpresa', cost: 15, emotion: 'Sorpresa', plus: 20, minus: 'Serenidad' },
    { name: 'Poción de Orgullo', cost: 20, emotion: 'Orgullo', plus: 20, minus: 'Confianza' },
    { name: 'Semilla de Serenidad', cost: 15, emotion: 'Serenidad', plus: 20, minus: 'Ira' },
    { name: 'Amuleto de Confianza', cost: 15, emotion: 'Confianza', plus: 20, minus: 'Miedo' },
    { name: 'Tónico de Ira', cost: 15, emotion: 'Ira', plus: 20, minus: 'Serenidad' },
    { name: 'Lágrimas de Tristeza', cost: 15, emotion: 'Tristeza', plus: 20, minus: 'Alegría' },
    { name: 'Néctar de Miedo', cost: 15, emotion: 'Miedo', plus: 20, minus: 'Confianza' },
  ];

  // Activities mapping (no cost, cooldown/action model)
  const ACTIVIDADES = [
    { name: 'Acariciar de forma tierna', expBonus: 10, plus: 'Serenidad', amount: 8, plus2: 'Confianza', amount2: 5 },
    { name: 'Cantar Melodía del Origen', expBonus: 12, plus: 'Amor', amount: 8, plus2: 'Alegría', amount2: 6 },
    { name: 'Jugar en el Prado de Viento', expBonus: 15, plus: 'Sorpresa', amount: 8, plus2: 'Alegría', amount2: 6 },
    { name: 'Narrar Crónica Imperial', expBonus: 14, plus: 'Orgullo', amount: 8, plus2: 'Confianza', amount2: 5 },
  ];

  const handleUseTonico = (tonico: typeof TONICOS[0]) => {
    // Attempt spend gold
    const success = onSpendGold(tonico.cost, 15);
    if (!success) {
      alert('¡Oro insuficiente! Participa en el minijuego "Sintonía de Almas" para conseguir más tazas de oro primordial.');
      return;
    }

    onUpdateEmotions((prev) => {
      const next = { ...prev };
      
      // Add plus
      const targetNamePlus = tonico.emotion as EmotionName;
      next[targetNamePlus] = Math.min(100, next[targetNamePlus] + tonico.plus);

      // Subtract minus
      const targetNameMinus = tonico.minus as EmotionName;
      next[targetNameMinus] = Math.max(0, next[targetNameMinus] - 10);

      return next;
    });
  };

  const handleDoActivity = (act: typeof ACTIVIDADES[0]) => {
    // Activities feed free EXP and update emotions
    onSpendGold(0, act.expBonus);

    onUpdateEmotions((prev) => {
      const next = { ...prev };
      
      const p1 = act.plus as EmotionName;
      const p2 = act.plus2 as EmotionName;

      next[p1] = Math.min(100, next[p1] + act.amount);
      if (p2) {
        next[p2] = Math.min(100, next[p2] + act.amount2);
      }

      return next;
    });
  };

  const triggerEvolutionVisual = () => {
    if (phase >= 5) {
      alert('¡Fase Máxima Alcanzada! Tu Nitz es ahora un Trascendente guardián divino sagrado.');
      return;
    }

    // Check EXP threshold for testing
    if (exp < phase * 40) {
      const forceEvolve = window.confirm(
        `Tu EXP (${exp}) es menor al umbral requerido (${phase * 40}). ¿Deseas canalizar la energía primordial de todas formas para probar la Evolución de fase ${phase} a ${phase + 1}?`
      );
      if (!forceEvolve) return;
    }

    setEvolutionExplosion(true);
    onEvolve();
    
    setTimeout(() => {
      setEvolutionExplosion(false);
    }, 2500);
  };

  return (
    <div className="w-full space-y-6">
      {/* 3D Evolution Sparkle Feedback Banner */}
      {evolutionExplosion && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="p-4 bg-gradient-to-r from-yellow-500/20 via-purple-500/20 to-yellow-500/20 border border-yellow-500/40 rounded-xl text-center space-y-2 relative overflow-hidden shadow-2xl z-20"
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-500 animate-spin">
            <Star className="w-6 h-6 fill-yellow-500" />
          </div>
          <h3 className="font-bold font-headline-lg text-white text-lg">¡RESONANCIA DESATADA: EVOLUCIÓN COMPLETA!</h3>
          <p className="text-xs text-[#c4c5da]">El ADN de tu Nitz mutó a Fase {phase}. Nuevos ornamentos físicos desbloqueados en el Atrio 3D.</p>
        </motion.div>
      )}

      {/* Dashboard Grid split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Column Left: Live status overview */}
        <div className="glass-panel bg-[#15172b]/90 p-5 rounded-xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div>
              <span className="text-[10px] text-[#919097] uppercase tracking-wider font-mono">Resonancia del Alma</span>
              <h3 className="font-bold font-headline-lg text-white">Dominancia: {dominantName}</h3>
            </div>
            <div 
              className="w-4 h-4 rounded-full shadow-[0_0_12px_currentColor] animate-pulse"
              style={{ color: `#${domColorHexStr}` }}
            />
          </div>

          {/* Detailed 9 Emotions meters */}
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(emotions) as EmotionName[]).map((key) => {
              const val = emotions[key];
              const hexStr = EMOTION_COLORS[key].toString(16).padStart(6, '0');
              const isDominant = key === dominantName;

              return (
                <div 
                  key={key} 
                  className={`p-2.5 rounded border transition-all ${
                    isDominant 
                      ? 'bg-[#1e143c] border-tertiary shadow-md scale-102' 
                      : 'bg-white/2 border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between pointer-events-none mb-1">
                    <span 
                      className="text-[10px] uppercase font-bold tracking-wider"
                      style={{ color: isDominant ? '#dec1ac' : `#${hexStr}` }}
                    >
                      {key}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-white">{val}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-1 md:h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-500"
                      style={{ 
                        width: `${val}%`,
                        backgroundColor: `#${hexStr}`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Guide */}
          <div className="p-3 bg-white/2 rounded border border-white/5 text-[11px] text-on-surface-variant flex gap-2">
            <HelpCircle className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
            <p>
              Consolida la Dominancia de cualquier emoción alimentándolo con sus tónicos respectivos. Una vez superado el 65% de dominancia, la forma de tu Nitz se transformará en su respectivo Códice Archetype.
            </p>
          </div>
        </div>

        {/* Column Right: Action dock (tabs: tónicos or actividades) */}
        <div className="glass-panel bg-[#15172b]/95 border border-white/10 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex border-b border-white/5 mb-4">
              <button
                onClick={() => setActiveTab('tonicos')}
                className={`flex-1 py-2 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
                  activeTab === 'tonicos' ? 'border-tertiary text-tertiary' : 'border-transparent text-[#919097] hover:text-white'
                }`}
              >
                Tónicos Espirituales
              </button>
              <button
                onClick={() => setActiveTab('actividades')}
                className={`flex-1 py-2 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
                  activeTab === 'actividades' ? 'border-tertiary text-tertiary' : 'border-transparent text-[#919097] hover:text-white'
                }`}
              >
                Caricias &amp; Actividades
              </button>
            </div>

            {/* Render Tabs content */}
            {activeTab === 'tonicos' ? (
              <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[220px] pr-1 custom-scrollbar">
                {TONICOS.map((tonico) => {
                  const hexStr = EMOTION_COLORS[tonico.emotion as EmotionName].toString(16).padStart(6, '0');
                  return (
                    <button
                      key={tonico.name}
                      onClick={() => handleUseTonico(tonico)}
                      className="p-3 bg-white/2 hover:bg-white/5 border border-white/5 rounded-lg text-left transition-all active:scale-95 flex flex-col justify-between h-24"
                    >
                      <div className="pointer-events-none">
                        <span 
                          className="text-[9px] font-bold block uppercase"
                          style={{ color: `#${hexStr}` }}
                        >
                          +{tonico.emotion}
                        </span>
                        <h4 className="text-xs font-semibold text-white leading-tight truncate-multiline mt-0.5">{tonico.name}</h4>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 w-full">
                        <span className="text-[10px] font-semibold text-yellow-500 font-mono">{tonico.cost}g</span>
                        <Soup className="w-3.5 h-3.5 opacity-60" style={{ color: `#${hexStr}` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1 custom-scrollbar">
                {ACTIVIDADES.map((act) => {
                  return (
                    <button
                      key={act.name}
                      onClick={() => handleDoActivity(act)}
                      className="w-full p-3 bg-white/2 hover:bg-white/5 border border-white/5 rounded-lg text-left transition-all active:scale-98 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="text-sm font-semibold text-white">{act.name}</h4>
                        <span className="text-[10px] text-tertiary font-mono uppercase">
                          +{act.amount} {act.plus} &nbsp;•&nbsp; +{act.amount2} {act.plus2}
                        </span>
                      </div>
                      <span className="text-[10px] bg-sky-950/40 text-sky-400 border border-sky-900/30 px-2 py-0.5 rounded font-mono">
                        +{act.expBonus} exp
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trigger Evolution controller */}
          <div className="border-t border-white/5 mt-4 pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-on-surface-variant font-mono block">RITO DE EVOLUCIÓN MÍSTICO</span>
              <div className="text-sm font-bold text-white uppercase font-headline-lg flex items-center gap-1.5">
                <span>Estado de Crecimiento: </span>
                <span className="text-tertiary font-mono">Fase {phase} / 5</span>
              </div>
              <span className="text-[10px] text-[#919097] block font-mono">Umbral de EXP para nivel superior: {exp} / {phase * 40}</span>
            </div>

            <button
              onClick={triggerEvolutionVisual}
              className="w-full md:w-auto btn-glow px-6 py-3.5 bg-gradient-to-r from-[#ffd700] to-tertiary text-black font-bold text-xs uppercase tracking-widest rounded-full transition-all active:scale-95 flex items-center gap-2 justify-center shadow-lg"
            >
              <Trophy className="w-4 h-4" />
              <span>Evolucionar Nitz</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
