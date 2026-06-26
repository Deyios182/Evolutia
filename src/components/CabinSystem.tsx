import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerProgress, CabinState, CabinUpgrade, OritQuest, StashSlot } from '../types';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// Cabin level config
// ─────────────────────────────────────────────────────────────────
interface LevelConfig {
  level: number;
  name: string;
  emoji: string;
  desc: string;
  cost: { wood_common?: number; stone_common?: number; metal_common?: number; wood_rare?: number; stone_rare?: number; metal_rare?: number; essence_common?: number };
  unlocks: string[];
}

const CABIN_LEVELS: LevelConfig[] = [
  {
    level: 1,
    name: 'Cabaña Rota',
    emoji: '🏚️',
    desc: 'El punto de partida. Solo lo básico.',
    cost: {},
    unlocks: ['Orit NPC', 'Baúl de almacén', 'Puerta al exterior'],
  },
  {
    level: 2,
    name: 'Refugio Básico',
    emoji: '🏠',
    desc: 'Las vigas están reparadas. Puedes empezar a fabricar.',
    cost: { wood_common: 20, stone_common: 5 },
    unlocks: ['⚒️ Forja Básica', '🔥 Refinería'],
  },
  {
    level: 3,
    name: 'Taller Activo',
    emoji: '🔧',
    desc: 'La cabaña vibra con actividad. Nuevas estaciones disponibles.',
    cost: { wood_common: 15, stone_common: 8, metal_common: 10 },
    unlocks: ['🧵 Tejedora', '🔮 Mesa de Arcanos'],
  },
  {
    level: 4,
    name: 'Santuario',
    emoji: '✨',
    desc: 'Tu hogar se ha convertido en un refugio sagrado.',
    cost: { wood_rare: 10, metal_common: 8, essence_common: 8 },
    unlocks: ['🪞 Espejo de Apariencia', '⚔️ Armero de Pruebas'],
  },
  {
    level: 5,
    name: 'Cabaña Legendaria',
    emoji: '👑',
    desc: 'Un lugar de leyenda. Nada puede superarlo.',
    cost: { wood_rare: 5, metal_common: 5, essence_common: 5 },
    unlocks: ['Decoración premium', 'Mejoras visuales finales'],
  },
];

// ─────────────────────────────────────────────────────────────────
// Helpers
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

function countMaterialInStash(
  stashGrid: (StashSlot | null)[] | undefined,
  category: 'wood' | 'stone' | 'metal' | 'essence',
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
): number {
  if (!stashGrid) return 0;
  let total = 0;
  for (const slot of stashGrid) {
    if (
      slot &&
      slot.type === 'material' &&
      slot.materialCategory === category &&
      slot.materialRarity === rarity
    ) {
      total += slot.quantity ?? 0;
    }
  }
  return total;
}

function canAffordUpgrade(
  cost: LevelConfig['cost'],
  stashGrid: (StashSlot | null)[] | undefined
): boolean {
  const entries = Object.entries(cost) as [string, number][];
  for (const [key, required] of entries) {
    const [cat, rar] = key.split('_') as [
      'wood' | 'stone' | 'metal' | 'essence',
      'common' | 'rare' | 'epic' | 'legendary'
    ];
    const have = countMaterialInStash(stashGrid, cat, rar);
    if (have < required) return false;
  }
  return true;
}

function consumeMaterialsFromStash(
  stashGrid: (StashSlot | null)[],
  cost: LevelConfig['cost']
): (StashSlot | null)[] {
  const newGrid = stashGrid.map(s => (s ? { ...s } : null));
  const entries = Object.entries(cost) as [string, number][];

  for (const [key, required] of entries) {
    let remaining = required;
    const [cat, rar] = key.split('_') as [
      'wood' | 'stone' | 'metal' | 'essence',
      'common' | 'rare' | 'epic' | 'legendary'
    ];

    for (let i = 0; i < newGrid.length && remaining > 0; i++) {
      const slot = newGrid[i];
      if (
        slot &&
        slot.type === 'material' &&
        slot.materialCategory === cat &&
        slot.materialRarity === rar
      ) {
        const take = Math.min(slot.quantity ?? 0, remaining);
        remaining -= take;
        const newQty = (slot.quantity ?? 0) - take;
        if (newQty <= 0) {
          newGrid[i] = null;
        } else {
          newGrid[i] = { ...slot, quantity: newQty };
        }
      }
    }
  }

  return newGrid;
}

const MATERIAL_LABEL: Record<string, string> = {
  wood_common: 'Madera Común',
  wood_rare: 'Madera Rara',
  stone_common: 'Piedra Común',
  stone_rare: 'Piedra Rara',
  metal_common: 'Metal Común',
  metal_rare: 'Metal Raro',
  essence_common: 'Esencia Común',
};

// ─────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────
interface CabinSystemProps {
  progress: PlayerProgress;
  onSaveProgress: (p: PlayerProgress) => void;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────
// Quest progress helpers
// ─────────────────────────────────────────────────────────────────
function getQuestProgress(
  quest: OritQuest,
  stashGrid: (StashSlot | null)[] | undefined
): { key: string; label: string; have: number; need: number }[] {
  return Object.entries(quest.requirements).map(([key, need]) => {
    const [cat, rar] = key.split('_') as [
      'wood' | 'stone' | 'metal' | 'essence',
      'common' | 'rare' | 'epic' | 'legendary'
    ];
    const have = countMaterialInStash(stashGrid, cat, rar);
    return { key, label: MATERIAL_LABEL[key] ?? key, have, need };
  });
}

function isQuestCompletable(quest: OritQuest, stashGrid: (StashSlot | null)[] | undefined): boolean {
  return getQuestProgress(quest, stashGrid).every(p => p.have >= p.need);
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────
export function CabinSystem({ progress, onSaveProgress, onClose }: CabinSystemProps) {
  const cabin = getOrInitCabin(progress);
  const cabinLevel = cabin.level;
  const nextLevelConfig = CABIN_LEVELS.find(c => c.level === cabinLevel + 1);
  const currentConfig = CABIN_LEVELS[cabinLevel - 1];
  const [notification, setNotification] = useState<string | null>(null);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleUpgradeCabin = useCallback(() => {
    if (!nextLevelConfig) {
      notify('🏆 ¡La cabaña ya está al nivel máximo!');
      return;
    }

    if (!canAffordUpgrade(nextLevelConfig.cost, progress.stashGrid)) {
      const missing = Object.entries(nextLevelConfig.cost)
        .map(([k, v]) => {
          const [cat, rar] = k.split('_') as ['wood' | 'stone' | 'metal' | 'essence', 'common' | 'rare' | 'epic' | 'legendary'];
          const have = countMaterialInStash(progress.stashGrid, cat, rar);
          if (have < v) return `${MATERIAL_LABEL[k] ?? k}: necesitas ${v}, tienes ${have}`;
          return null;
        })
        .filter(Boolean)
        .join(' | ');
      notify(`⚠️ Materiales insuficientes: ${missing}`);
      return;
    }

    const newGrid = consumeMaterialsFromStash(
      progress.stashGrid ?? Array(40).fill(null),
      nextLevelConfig.cost
    );

    const newUpgrade: CabinUpgrade = {
      id: `level_${nextLevelConfig.level}`,
      name: nextLevelConfig.name,
      description: nextLevelConfig.desc,
      level: nextLevelConfig.level,
      unlockedAt: new Date().toISOString(),
    };

    const updatedCabin: CabinState = {
      ...cabin,
      level: nextLevelConfig.level,
      upgrades: [...cabin.upgrades, newUpgrade],
    };

    const updatedProg: PlayerProgress = {
      ...progress,
      cabin: updatedCabin,
      stashGrid: newGrid,
    };

    onSaveProgress(updatedProg);

    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      updateDoc(userRef, {
        cabin: updatedCabin,
        stashGrid: newGrid,
      }).catch(err => console.error('Error upgrading cabin in DB:', err));
    }

    notify(`✨ ¡Cabaña mejorada a Nivel ${nextLevelConfig.level}: ${nextLevelConfig.name}!`);
  }, [progress, cabin, nextLevelConfig, onSaveProgress]);

  const handleCompleteQuest = useCallback((quest: OritQuest) => {
    if (!isQuestCompletable(quest, progress.stashGrid)) {
      notify('⚠️ Aún no tienes todos los materiales requeridos.');
      return;
    }

    // Consume materials
    const newGrid = consumeMaterialsFromStash(
      progress.stashGrid ?? Array(40).fill(null),
      quest.requirements
    );

    const updatedActiveQuests = cabin.activeQuests.filter(q => q.id !== quest.id);
    const updatedCompletedIds = [...cabin.completedQuestIds, quest.id];

    // Apply rewards
    const goldReward = quest.reward.gold ?? 0;
    const expReward = quest.reward.exp ?? 0;

    // Unlock upgrade if specified
    let newLevel = cabin.level;
    let newUpgrades = [...cabin.upgrades];
    if (quest.reward.unlockUpgradeId && !cabin.upgrades.some(u => u.id === quest.reward.unlockUpgradeId)) {
      newUpgrades.push({
        id: quest.reward.unlockUpgradeId,
        name: `Mejora: ${quest.reward.unlockUpgradeId}`,
        description: 'Desbloqueada al completar misión de Orit.',
        level: 1,
        unlockedAt: new Date().toISOString(),
      });
      newLevel = Math.max(newLevel, 2); // quest completion always unlocks at least level 2
    }

    const updatedCabin: CabinState = {
      ...cabin,
      level: newLevel,
      upgrades: newUpgrades,
      activeQuests: updatedActiveQuests,
      completedQuestIds: updatedCompletedIds,
    };

    const updatedProg: PlayerProgress = {
      ...progress,
      cabin: updatedCabin,
      stashGrid: newGrid,
      gold: progress.gold + goldReward,
      exp: progress.exp + expReward,
    };

    onSaveProgress(updatedProg);

    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      updateDoc(userRef, {
        cabin: updatedCabin,
        stashGrid: newGrid,
        gold: updatedProg.gold,
        exp: updatedProg.exp,
      }).catch(err => console.error('Error completing quest in DB:', err));
    }

    notify(`🎉 ¡Misión "${quest.title}" completada! +${goldReward} 🪙 +${expReward} EXP`);
  }, [progress, cabin, onSaveProgress]);

  const affordNextLevel = nextLevelConfig ? canAffordUpgrade(nextLevelConfig.cost, progress.stashGrid) : false;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <motion.div
        className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden border"
        style={{
          background: 'linear-gradient(160deg, rgba(10,8,20,0.97) 0%, rgba(20,10,40,0.97) 100%)',
          borderColor: 'rgba(167,139,250,0.2)',
          boxShadow: '0 0 60px rgba(139,92,246,0.12), 0 20px 60px rgba(0,0,0,0.8)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Top accent */}
        <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.7), transparent)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{currentConfig?.emoji ?? '🏠'}</span>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Sistema de Cabaña</h2>
              <p className="text-[11px] text-purple-300/70">{currentConfig?.name} — Nivel {cabinLevel}/5</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/25"
          >
            Cerrar
          </button>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              className="mx-4 mt-3 px-3 py-2 rounded-lg text-xs text-center font-medium"
              style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.35)', color: '#c4b5fd' }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-5 space-y-5">
          {/* Level progress bar */}
          <div>
            <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
              <span>Progreso de Cabaña</span>
              <span>{cabinLevel}/5</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(cabinLevel / 5) * 100}%`,
                  background: 'linear-gradient(90deg, #8b5cf6, #c4b5fd)',
                }}
              />
            </div>
            <div className="flex justify-between mt-2">
              {CABIN_LEVELS.map(l => (
                <div
                  key={l.level}
                  className="flex flex-col items-center gap-0.5"
                  title={l.name}
                >
                  <span
                    className="text-lg leading-none"
                    style={{ opacity: cabinLevel >= l.level ? 1 : 0.25 }}
                  >
                    {l.emoji}
                  </span>
                  <span className="text-[9px] text-gray-500">{l.level}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active quests */}
          {cabin.activeQuests.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-purple-300 tracking-widest uppercase mb-2">
                📋 Misiones de Orit
              </h3>
              <div className="space-y-3">
                {cabin.activeQuests.map(quest => {
                  const progItems = getQuestProgress(quest, progress.stashGrid);
                  const completable = isQuestCompletable(quest, progress.stashGrid);
                  return (
                    <div
                      key={quest.id}
                      className="rounded-xl p-3 border"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        borderColor: completable ? 'rgba(16,185,129,0.35)' : 'rgba(139,92,246,0.15)',
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-xs font-semibold text-white">{quest.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{quest.description}</p>
                        </div>
                        <div className="text-[10px] text-right text-gray-500 shrink-0 ml-2">
                          {quest.reward.gold ? `+${quest.reward.gold}🪙` : ''}
                          {quest.reward.exp ? ` +${quest.reward.exp}EXP` : ''}
                        </div>
                      </div>
                      {/* Material progress bars */}
                      <div className="space-y-1 mb-2">
                        {progItems.map(p => (
                          <div key={p.key}>
                            <div className="flex justify-between text-[10px] text-gray-400">
                              <span>{p.label}</span>
                              <span style={{ color: p.have >= p.need ? '#10b981' : '#94a3b8' }}>
                                {Math.min(p.have, p.need)}/{p.need}
                              </span>
                            </div>
                            <div className="w-full h-1 rounded-full mt-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, (p.have / p.need) * 100)}%`,
                                  background: p.have >= p.need ? '#10b981' : '#8b5cf6',
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handleCompleteQuest(quest)}
                        disabled={!completable}
                        className="w-full text-[11px] font-bold py-1.5 rounded-lg transition-all duration-150"
                        style={{
                          background: completable ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${completable ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          color: completable ? '#6ee7b7' : '#64748b',
                          cursor: completable ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {completable ? '✓ Entregar Materiales' : 'Faltan materiales'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Next upgrade */}
          {nextLevelConfig && (
            <div>
              <h3 className="text-xs font-bold text-purple-300 tracking-widest uppercase mb-2">
                ⬆️ Siguiente Mejora
              </h3>
              <div
                className="rounded-xl p-4 border"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderColor: affordNextLevel ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{nextLevelConfig.emoji}</span>
                  <div>
                    <p className="text-sm font-bold text-white">Nivel {nextLevelConfig.level}: {nextLevelConfig.name}</p>
                    <p className="text-[10px] text-gray-400">{nextLevelConfig.desc}</p>
                  </div>
                </div>

                {/* Unlocks */}
                <div className="mb-3">
                  <p className="text-[10px] text-gray-500 mb-1">Desbloquea:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {nextLevelConfig.unlocks.map(u => (
                      <span
                        key={u}
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', color: '#c4b5fd' }}
                      >
                        {u}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Cost */}
                <div className="mb-3">
                  <p className="text-[10px] text-gray-500 mb-1">Coste:</p>
                  <div className="space-y-1">
                    {Object.entries(nextLevelConfig.cost).map(([key, need]) => {
                      const [cat, rar] = key.split('_') as ['wood' | 'stone' | 'metal' | 'essence', 'common' | 'rare' | 'epic' | 'legendary'];
                      const have = countMaterialInStash(progress.stashGrid, cat, rar);
                      const ok = have >= (need as number);
                      return (
                        <div key={key} className="flex justify-between text-[10px]">
                          <span style={{ color: ok ? '#6ee7b7' : '#94a3b8' }}>{MATERIAL_LABEL[key] ?? key}</span>
                          <span style={{ color: ok ? '#6ee7b7' : '#ef4444', fontWeight: 600 }}>
                            {have}/{need as number}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleUpgradeCabin}
                  disabled={!affordNextLevel}
                  className="w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-150 active:scale-95"
                  style={{
                    background: affordNextLevel
                      ? 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(167,139,250,0.25))'
                      : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${affordNextLevel ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    color: affordNextLevel ? '#e9d5ff' : '#475569',
                    cursor: affordNextLevel ? 'pointer' : 'not-allowed',
                  }}
                  onMouseEnter={e => { if (affordNextLevel) (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(139,92,246,0.5), rgba(167,139,250,0.4))'; }}
                  onMouseLeave={e => { if (affordNextLevel) (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(167,139,250,0.25))'; }}
                >
                  {affordNextLevel ? `⬆️ Mejorar a ${nextLevelConfig.name}` : '⚠️ Materiales insuficientes'}
                </button>
              </div>
            </div>
          )}

          {/* Level 5 completion state */}
          {cabinLevel >= 5 && (
            <div
              className="rounded-xl p-4 text-center"
              style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
            >
              <p className="text-xl mb-1">👑</p>
              <p className="text-sm font-bold text-amber-300">Cabaña Legendaria</p>
              <p className="text-[11px] text-gray-400 mt-1">Has alcanzado el nivel máximo. ¡Tu hogar es una leyenda!</p>
            </div>
          )}

          {/* Completed quests */}
          {cabin.completedQuestIds.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-2">
                ✅ Misiones Completadas ({cabin.completedQuestIds.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {cabin.completedQuestIds.map(id => (
                  <span
                    key={id}
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}
                  >
                    ✓ {id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
