import React, { useState } from 'react';
import { Flame, Star, Hammer, Lock, RefreshCw, Layers } from 'lucide-react';
import { PlayerProgress, CraftableItem, StashSlot } from '../types';

interface RefinerUIProps {
  progress: PlayerProgress;
  onSaveProgress: (p: PlayerProgress) => void;
  onClose: () => void;
}

type RefiningRecipe = {
  name: string;
  category: 'wood' | 'metal' | 'stone';
  tier: number;
  cost: {
    category: 'wood' | 'stone' | 'metal' | 'essence';
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    amount: number;
  }[];
  result: {
    name: string;
    subType: 'refined_wood' | 'refined_metal' | 'refined_stone' | 'refined_essence';
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
  };
  requiredRefiningLevel: number;
  expGranted: number;
};

const REFINING_RECIPES: RefiningRecipe[] = [
  // Wood Planks
  {
    name: 'Tablón de Pino (T1)', category: 'wood', tier: 1,
    cost: [{ category: 'wood', rarity: 'common', amount: 2 }],
    result: { name: 'Tablón de Pino Refinado', subType: 'refined_wood', rarity: 'common' },
    requiredRefiningLevel: 1, expGranted: 10
  },
  {
    name: 'Tablón de Abedul (T2)', category: 'wood', tier: 2,
    cost: [{ category: 'wood', rarity: 'rare', amount: 2 }],
    result: { name: 'Tablón de Abedul Refinado', subType: 'refined_wood', rarity: 'rare' },
    requiredRefiningLevel: 1, expGranted: 25
  },
  {
    name: 'Tablón de Castaño (T3)', category: 'wood', tier: 3,
    cost: [{ category: 'wood', rarity: 'epic', amount: 2 }],
    result: { name: 'Tablón de Castaño Refinado', subType: 'refined_wood', rarity: 'epic' },
    requiredRefiningLevel: 2, expGranted: 60
  },
  {
    name: 'Tablón de Cedro (T4)', category: 'wood', tier: 4,
    cost: [{ category: 'wood', rarity: 'legendary', amount: 2 }],
    result: { name: 'Tablón de Cedro Refinado', subType: 'refined_wood', rarity: 'legendary' },
    requiredRefiningLevel: 3, expGranted: 150
  },
  // Metal Ingots
  {
    name: 'Lingote de Cobre (T2)', category: 'metal', tier: 2,
    cost: [{ category: 'metal', rarity: 'rare', amount: 2 }],
    result: { name: 'Lingote de Cobre Refinado', subType: 'refined_metal', rarity: 'rare' },
    requiredRefiningLevel: 1, expGranted: 25
  },
  {
    name: 'Lingote de Hierro (T3)', category: 'metal', tier: 3,
    cost: [{ category: 'metal', rarity: 'epic', amount: 2 }],
    result: { name: 'Lingote de Hierro Refinado', subType: 'refined_metal', rarity: 'epic' },
    requiredRefiningLevel: 2, expGranted: 60
  },
  {
    name: 'Lingote de Titanio (T4)', category: 'metal', tier: 4,
    cost: [{ category: 'metal', rarity: 'legendary', amount: 2 }],
    result: { name: 'Lingote de Titanio Refinado', subType: 'refined_metal', rarity: 'legendary' },
    requiredRefiningLevel: 3, expGranted: 150
  },
  // Stone Blocks
  {
    name: 'Bloque de Piedra (T1)', category: 'stone', tier: 1,
    cost: [{ category: 'stone', rarity: 'common', amount: 2 }],
    result: { name: 'Bloque de Piedra Refinado', subType: 'refined_stone', rarity: 'common' },
    requiredRefiningLevel: 1, expGranted: 10
  },
  {
    name: 'Bloque de Granito (T2)', category: 'stone', tier: 2,
    cost: [{ category: 'stone', rarity: 'rare', amount: 2 }],
    result: { name: 'Bloque de Granito Refinado', subType: 'refined_stone', rarity: 'rare' },
    requiredRefiningLevel: 1, expGranted: 25
  },
  {
    name: 'Bloque de Pizarra (T3)', category: 'stone', tier: 3,
    cost: [{ category: 'stone', rarity: 'epic', amount: 2 }],
    result: { name: 'Bloque de Pizarra Refinado', subType: 'refined_stone', rarity: 'epic' },
    requiredRefiningLevel: 2, expGranted: 60
  },
  {
    name: 'Bloque de Mármol (T4)', category: 'stone', tier: 4,
    cost: [{ category: 'stone', rarity: 'legendary', amount: 2 }],
    result: { name: 'Bloque de Mármol Refinado', subType: 'refined_stone', rarity: 'legendary' },
    requiredRefiningLevel: 3, expGranted: 150
  }
];

export const RefinerUI: React.FC<RefinerUIProps> = ({ progress, onSaveProgress, onClose }) => {
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'wood' | 'metal' | 'stone'>('all');

  const refiningLevel = progress.refiningLevel || 1;
  const refiningExp = progress.refiningExp || 0;
  const expToNextLevel = refiningLevel * 300;

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const triggerAudioTone = (freq: number, type: OscillatorType = 'sine', duration = 0.5) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  };

  // Helper to count materials inside the secure stash grid
  const getStashMaterialCount = (category: string, rarity: string): number => {
    let count = 0;
    (progress.stashGrid || []).forEach(slot => {
      if (slot && slot.type === 'material' && slot.materialCategory === category && slot.materialRarity === rarity) {
        count += slot.quantity || 0;
      }
    });
    return count;
  };

  // Helper to consume materials from the stash grid
  const consumeMaterialsFromStash = (
    grid: (StashSlot | null)[],
    category: string,
    rarity: string,
    amount: number
  ): (StashSlot | null)[] | null => {
    const updatedGrid = [...grid];
    let remaining = amount;

    for (let i = 0; i < updatedGrid.length; i++) {
      const slot = updatedGrid[i];
      if (slot && slot.type === 'material' && slot.materialCategory === category && slot.materialRarity === rarity) {
        const qty = slot.quantity || 0;
        if (qty >= remaining) {
          const newQty = qty - remaining;
          remaining = 0;
          if (newQty <= 0) {
            updatedGrid[i] = null;
          } else {
            updatedGrid[i] = { ...slot, quantity: newQty };
          }
          break;
        } else {
          remaining -= qty;
          updatedGrid[i] = null;
        }
      }
    }

    return remaining === 0 ? updatedGrid : null;
  };

  const handleRefine = (recipe: RefiningRecipe) => {
    if (refiningLevel < recipe.requiredRefiningLevel) {
      showNotif(`❌ Requiere Nivel de Refinamiento ${recipe.requiredRefiningLevel}`);
      return;
    }

    // 1. Verify stash resources
    let hasResources = true;
    recipe.cost.forEach(c => {
      const available = getStashMaterialCount(c.category, c.rarity);
      if (available < c.amount) {
        hasResources = false;
      }
    });

    if (!hasResources) {
      showNotif('❌ Recursos de entrada insuficientes en el Almacén Seguro.');
      return;
    }

    // 2. Consume resources
    let currentGrid = [...(progress.stashGrid || [])];
    recipe.cost.forEach(c => {
      const resultGrid = consumeMaterialsFromStash(currentGrid, c.category, c.rarity, c.amount);
      if (resultGrid) {
        currentGrid = resultGrid;
      }
    });

    // 3. Create Refined Material
    const itemId = `ref_${recipe.result.subType}_t${recipe.tier}_${Date.now()}`;
    const refinedItem: CraftableItem = {
      id: itemId,
      name: recipe.result.name,
      type: 'material',
      subType: recipe.result.subType,
      rarity: recipe.result.rarity,
      tier: recipe.tier,
      quantity: 1
    };

    // 4. Update XP & Level
    let newExp = refiningExp + recipe.expGranted;
    let newLvl = refiningLevel;
    let leveledUp = false;

    while (newExp >= newLvl * 300) {
      newExp -= newLvl * 300;
      newLvl += 1;
      leveledUp = true;
    }

    // Save Progress
    onSaveProgress({
      ...progress,
      stashGrid: currentGrid,
      craftedItems: [...(progress.craftedItems || []), refinedItem],
      refiningExp: newExp,
      refiningLevel: newLvl
    });

    triggerAudioTone(440, 'triangle', 0.4);
    setTimeout(() => triggerAudioTone(554.37, 'triangle', 0.3), 100);

    if (leveledUp) {
      triggerAudioTone(880, 'sine', 0.8);
      showNotif(`🎉 ¡SUBISTE DE NIVEL DE REFINAMIENTO! Nuevo Nivel: ${newLvl}`);
    } else {
      showNotif(`🔥 Refinado con éxito: +${recipe.expGranted} EXP.`);
    }
  };

  const filteredRecipes = selectedCategory === 'all' 
    ? REFINING_RECIPES 
    : REFINING_RECIPES.filter(r => r.category === selectedCategory);

  return (
    <div className="w-full h-full flex flex-col text-gray-200 relative p-4">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-widest flex items-center gap-2 text-amber-500">
            <Flame className="w-6 h-6 animate-pulse" /> Refinería de Recursos Estelares
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">Refina madera, metal y piedra en lingotes y tablones refinados.</p>
        </div>
        <button 
          onClick={onClose}
          className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 px-4 py-2 rounded font-bold uppercase transition-all"
        >
          Cerrar Interfaz
        </button>
      </div>

      {notification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#121528] border border-emerald-500/40 px-6 py-2 rounded-full text-xs font-bold text-emerald-400 shadow-2xl animate-fade-in">
          {notification}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Refining Mastery Info */}
        <div className="w-full lg:w-1/4 bg-[#0a0c10] border border-white/5 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-amber-400">
              <Star className="w-4 h-4" /> Maestría de Refinado
            </h3>
            
            <div className="space-y-4">
              <div className="bg-[#11161d] p-4 rounded-lg border border-white/5 text-center">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest block font-mono">Nivel de Profesión</span>
                <span className="text-4xl font-extrabold text-white block mt-1">{refiningLevel}</span>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5 text-gray-400">
                  <span>EXP de Progreso</span>
                  <span>{refiningExp} / {expToNextLevel} EXP</span>
                </div>
                <div className="w-full bg-black h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (refiningExp / expToNextLevel) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-[11px] text-gray-500 leading-normal font-mono border-t border-white/5 pt-4">
            ⚒️ <strong>Consejo de Albion:</strong> Las herramientas avanzadas requieren tablones y metales refinados para su fabricación. ¡Mantén tu refinería encendida!
          </div>
        </div>

        {/* Right Column: Recipe list and Filters */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Category Filter Buttons */}
          <div className="flex gap-2 bg-black/40 border border-white/5 p-1 rounded-xl w-fit">
            {(['all', 'wood', 'metal', 'stone'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  selectedCategory === cat 
                    ? 'bg-amber-600/90 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'Ver Todos' : cat === 'wood' ? '🪵 Madera' : cat === 'metal' ? '⚙️ Metal' : '🪨 Piedra'}
              </button>
            ))}
          </div>

          {/* Recipe Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
            {filteredRecipes.map((recipe, idx) => {
              const isLocked = refiningLevel < recipe.requiredRefiningLevel;
              return (
                <div 
                  key={idx} 
                  className={`bg-[#0a0c10] border rounded-xl p-4 flex flex-col relative transition-all ${
                    isLocked ? 'border-red-950/30 opacity-70' : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  {isLocked && (
                    <div className="absolute inset-0 bg-black/75 z-10 flex items-center justify-center rounded-xl backdrop-blur-[1px]">
                      <div className="bg-red-950/90 text-red-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase border border-red-500/20 flex items-center gap-1 shadow-2xl">
                        <Lock className="w-3 h-3" /> Req Lvl {recipe.requiredRefiningLevel}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-gray-200">{recipe.name}</h4>
                      <span className="text-[9px] text-[#dec1ac] font-mono block mt-0.5">Otorga +{recipe.expGranted} EXP</span>
                    </div>
                    <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-amber-400 font-bold uppercase">
                      Tier {recipe.tier}
                    </span>
                  </div>

                  {/* Costs */}
                  <div className="space-y-1.5 flex-1 mt-2">
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold font-mono">Coste del Material</span>
                    <div className="space-y-1">
                      {recipe.cost.map((cost, cIdx) => {
                        const inStash = getStashMaterialCount(cost.category, cost.rarity);
                        const isEnough = inStash >= cost.amount;
                        return (
                          <div key={cIdx} className="flex justify-between text-xs font-mono">
                            <span className="text-gray-400 capitalize">
                              {cost.rarity === 'common' ? 'Común' : cost.rarity === 'rare' ? 'Raro' : cost.rarity === 'epic' ? 'Épico' : 'Legendario'}{' '}
                              {cost.category === 'wood' ? 'Madera' : cost.category === 'stone' ? 'Piedra' : cost.category === 'metal' ? 'Metal' : 'Esencia'}
                            </span>
                            <span className={isEnough ? 'text-emerald-400' : 'text-red-400 font-bold'}>
                              {inStash} / {cost.amount}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRefine(recipe)}
                    className="w-full mt-4 py-2 rounded-lg font-bold uppercase text-[10px] tracking-wider transition-all bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black active:scale-95 shadow-md border border-amber-400/20"
                  >
                    Refinar Elemento
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
