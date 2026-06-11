import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Play, Award, Zap, RefreshCw, Trophy, Music } from 'lucide-react';

interface GamePulse {
  id: number;
  x: number; // percentage
  y: number; // percentage
  size: number;
  scale: number;
  speed: number;
  targetScale: number;
  points: number;
}

interface MinigameProps {
  onReward: (gold: number, exp: number) => void;
  onEmotionBoost: (emotion: string, amount: number) => void;
}

export const Minigame: React.FC<MinigameProps> = ({ onReward, onEmotionBoost }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [combo, setCombo] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [pulses, setPulses] = useState<GamePulse[]>([]);
  const [feedback, setFeedback] = useState<{ text: string; color: string; id: number } | null>(null);
  const [goldEarned, setGoldEarned] = useState<number>(0);
  const [expEarned, setExpEarned] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);

  const requestRef = useRef<number | null>(null);
  const pulseIdCounter = useRef<number>(0);

  // Main game loop when playing
  useEffect(() => {
    if (!isPlaying || timeLeft <= 0) return;

    // Countdown Timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Spawn pulse interval
    const spawnInterval = setInterval(() => {
      const newPulse: GamePulse = {
        id: ++pulseIdCounter.current,
        x: 15 + Math.random() * 70, // stay clear of margins
        y: 20 + Math.random() * 60,
        size: 80,
        scale: 2.2, // starts expanded
        speed: 0.016 + Math.random() * 0.012,
        targetScale: 0.6, // threshold for 'Perfect' alignment
        points: 100,
      };
      setPulses((prev) => [...prev, newPulse]);
    }, 900);

    return () => {
      clearInterval(timer);
      clearInterval(spawnInterval);
    };
  }, [isPlaying, timeLeft]);

  // Handle pulse shrinking animation
  useEffect(() => {
    if (!isPlaying) return;

    const updatePulses = () => {
      setPulses((prev) => {
        // Filter out pulses that shrunk past target
        return prev
          .map((p) => ({
            ...p,
            scale: p.scale - p.speed,
          }))
          .filter((p) => {
            if (p.scale < 0.35) {
              // Missed pulse
              triggerFeedback('¡Sintonía Perdida!', 'text-red-500');
              setCombo(0);
              setMultiplier(1);
              return false;
            }
            return true;
          });
      });
      requestRef.current = requestAnimationFrame(updatePulses);
    };

    requestRef.current = requestAnimationFrame(updatePulses);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying]);

  const startGame = () => {
    setIsPlaying(true);
    setScore(0);
    setCombo(0);
    setMultiplier(1);
    setTimeLeft(30);
    setPulses([]);
    setGameOver(false);
    setGoldEarned(0);
    setExpEarned(0);
  };

  const endGame = () => {
    setIsPlaying(false);
    setGameOver(true);
    const finalGold = Math.floor(score * 0.15) + 10;
    const finalExp = Math.floor(score * 0.2) + 15;
    setGoldEarned(finalGold);
    setExpEarned(finalExp);
    onReward(finalGold, finalExp);
    
    // Dynamically update emotions
    onEmotionBoost('Alegría', 10);
    onEmotionBoost('Confianza', 5);
  };

  const triggerFeedback = (text: string, color: string) => {
    setFeedback({ text, color, id: Date.now() });
  };

  const handlePulseClick = (pulse: GamePulse, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Math checks for how close the ring is to targetScale (0.6)
    const distance = Math.abs(pulse.scale - pulse.targetScale);
    let hitPoints = 0;
    let rank = '';
    let textColor = '';

    if (distance < 0.15) {
      rank = '¡SINTONÍA PERFECTA!';
      hitPoints = 150;
      textColor = 'text-green-400 text-glow-green';
      setCombo((prev) => prev + 1);
      onEmotionBoost('Serenidad', 3);
    } else if (distance < 0.35) {
      rank = '¡GRAN RESONANCIA!';
      hitPoints = 85;
      textColor = 'text-sky-400';
      setCombo((prev) => prev + 1);
      onEmotionBoost('Confianza', 1);
    } else {
      rank = 'Sintonía Débil';
      hitPoints = 40;
      textColor = 'text-yellow-500';
      setCombo(0);
    }

    // Multiply matching streak combo
    const bonusPoints = hitPoints * multiplier;
    setScore((prev) => prev + bonusPoints);
    
    // Grow Multiplier based on combo
    if (combo > 0 && combo % 4 === 0) {
      setMultiplier((prev) => Math.min(prev + 1, 5));
      triggerFeedback(`¡MULTIPLICADOR x${multiplier + 1}!`, 'text-purple-400');
    } else {
      triggerFeedback(rank, textColor);
    }

    // Remove pulse
    setPulses((prev) => prev.filter((p) => p.id !== pulse.id));
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Overview header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <Music className="w-8 h-8 text-[#dec1ac] animate-bounce" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-headline-lg text-white">Sintonía de Almas</h1>
            <p className="text-xs text-[#919097] uppercase tracking-wider">Golpea las esferas de resonancia en el tempo adecuado</p>
          </div>
        </div>
        <div className="text-xs font-mono text-on-surface-variant bg-white/5 px-3 py-1.5 rounded-full">
          Estrecha vínculos &nbsp;•&nbsp; Gana Oro &amp; EXP
        </div>
      </div>

      {/* Main interactive screen board */}
      <div className="relative w-full h-[450px] bg-[#0c0d1b] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col items-center justify-center">
        {/* Background stars */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-black to-black pointer-events-none" />
        
        {/* Cinematic Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

        <AnimatePresence>
          {!isPlaying && !gameOver && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="z-10 text-center space-y-6 max-w-lg p-6"
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-tertiary to-[#c4c5da] flex items-center justify-center text-black shadow-lg">
                <Play className="w-10 h-10 ml-1.5" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white font-headline-lg">Ritmo de Esencia Mística</h2>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Las ondas de alma de tu Nitz se dispersan. Golpea las esferas concéntricas exactamente cuando el círculo móvil de color se posicione sobre el núcleo interior gris perla.
                </p>
              </div>
              <button 
                onClick={startGame}
                className="btn-glow px-10 py-3.5 bg-gradient-to-r from-tertiary to-[#c4c5da] text-black font-bold rounded-full transition-all active:scale-95 flex items-center gap-2 mx-auto"
              >
                Sintonizar Frecuencia
                <Zap className="w-4 h-4 fill-black" />
              </button>
            </motion.div>
          )}

          {isPlaying && (
            <div className="absolute inset-0 z-10 w-full h-full cursor-crosshair">
              {/* HUD / Indicators */}
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#919097] uppercase tracking-wider">Puntuación</span>
                  <div className="text-2xl font-bold font-mono text-white text-glow-silver">{score}</div>
                </div>

                <div className="flex gap-4">
                  <div className="text-center bg-black/40 border border-white/5 py-1 px-3 rounded">
                    <span className="text-[9px] text-[#919097] block uppercase font-mono">COMBO</span>
                    <span className="text-sm font-bold text-tertiary">{combo}</span>
                  </div>
                  <div className="text-center bg-black/40 border border-white/5 py-1 px-3 rounded">
                    <span className="text-[9px] text-[#919097] block uppercase font-mono">MULT.</span>
                    <span className="text-sm font-bold text-purple-400">x{multiplier}</span>
                  </div>
                  <div className="text-center bg-black/40 border border-white/5 py-1 px-3 rounded">
                    <span className="text-[9px] text-[#919097] block uppercase font-mono">TIEMPO</span>
                    <span className="text-sm font-bold text-[#ffd700]">{timeLeft}s</span>
                  </div>
                </div>
              </div>

              {/* Combo Feedback Sparkles overlay */}
              {feedback && (
                <div className="absolute top-24 left-1/2 transform -translate-x-1/2 pointer-events-none z-20">
                  <motion.div 
                    key={feedback.id}
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`font-headline-lg font-bold text-base tracking-widest ${feedback.color}`}
                  >
                    {feedback.text}
                  </motion.div>
                </div>
              )}

              {/* Spawning Pulses */}
              <AnimatePresence>
                {pulses.map((pulse) => {
                  return (
                    <motion.div
                      key={pulse.id}
                      style={{
                        position: 'absolute',
                        left: `${pulse.x}%`,
                        top: `${pulse.y}%`,
                        width: `${pulse.size}px`,
                        height: `${pulse.size}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="relative flex items-center justify-center cursor-pointer group"
                      onClick={(e) => handlePulseClick(pulse, e)}
                    >
                      {/* Target Ring (Static) */}
                      <div className="absolute w-[44px] h-[44px] rounded-full bg-white/10 border-2 border-white/30 backdrop-blur-sm pointer-events-none flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-white/75 shadow-[0_0_8px_white]" />
                      </div>

                      {/* Shrinking Ring */}
                      <div 
                        className="absolute rounded-full border-2 border-tertiary animate-pulse"
                        style={{
                          width: `${pulse.size * pulse.scale}px`,
                          height: `${pulse.size * pulse.scale}px`,
                          borderColor: pulse.scale < 0.8 ? '#00e1d9' : '#dec1ac',
                        }}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {gameOver && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="z-10 text-center space-y-6 max-w-md p-6 bg-surface-container-low/95 rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-500">
                <Trophy className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white font-headline-lg">Sintonía Completada</h2>
                <p className="text-xs text-[#919097]">Has canalizado la frecuencia mística con maestría.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-white/2 rounded-lg border border-white/5 text-left">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-[#919097] uppercase">Puntaje Final</span>
                  <div className="text-lg font-bold font-mono text-white">{score} Pts</div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-[#919097] uppercase">Recompensas</span>
                  <div className="text-sm font-semibold text-tertiary flex items-center gap-1">
                    <span>+{goldEarned} Oro</span>
                    <span className="text-white/40">•</span>
                    <span>+{expEarned} EXP</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={startGame}
                  className="flex-1 btn-glow py-3 bg-[#c4c5da] hover:bg-white text-black font-semibold rounded-full text-xs uppercase tracking-wider transition-all"
                >
                  Volver a Jugar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
