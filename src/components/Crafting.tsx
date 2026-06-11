import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hammer, Sparkles, Sword, Shield, Sofa, Feather, Database, AlertCircle, ShoppingBag, Check } from 'lucide-react';
import { PlayerProgress, CraftableItem, GatheringInventory } from '../types';

interface CraftingProps {
  progress: PlayerProgress;
  onSaveProgress: (newProg: PlayerProgress) => void;
}

interface Recipe {
  id: string;
  name: string;
  type: 'furniture' | 'equipment';
  subType?: 'weapon' | 'shield' | 'armor';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  statBonus?: string;
  description: string;
  cost: {
    material: 'wood' | 'stone' | 'metal' | 'essence';
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    count: number;
  }[];
}

const CRAFTING_RECIPES: Recipe[] = [
  // Equipment (Weapons)
  {
    id: 'weapon_novice_sword',
    name: 'Espada de Novicio',
    type: 'equipment',
    subType: 'weapon',
    rarity: 'common',
    statBonus: '+5% Fuerza en Duelos',
    description: 'Filo básico forjado con hierro común de la Cantera.',
    cost: [
      { material: 'metal', rarity: 'common', count: 5 }
    ]
  },
  {
    id: 'weapon_mist_blade',
    name: 'Mandoble de Bruma Astral',
    type: 'equipment',
    subType: 'weapon',
    rarity: 'epic',
    statBonus: '+30% Poder Temible',
    description: 'Un mandoble pesado que resuena con partículas sombrías de la Zona PvP.',
    cost: [
      { material: 'metal', rarity: 'epic', count: 12 },
      { material: 'wood', rarity: 'rare', count: 8 },
      { material: 'essence', rarity: 'rare', count: 5 }
    ]
  },
  {
    id: 'weapon_divine_sword',
    name: 'Sable del Alba Legendaria',
    type: 'equipment',
    subType: 'weapon',
    rarity: 'legendary',
    statBonus: '+65% Daño del Caos',
    description: 'Arma divina forjada con esencias celestiales eternas del plano astral.',
    cost: [
      { material: 'metal', rarity: 'legendary', count: 5 },
      { material: 'essence', rarity: 'legendary', count: 5 },
      { material: 'wood', rarity: 'epic', count: 10 }
    ]
  },
  
  // Shields & Armor
  {
    id: 'shield_star_plate',
    name: 'Escudo de Placas Estelares',
    type: 'equipment',
    subType: 'shield',
    rarity: 'rare',
    statBonus: '+40 Escudo PvP Máximo',
    description: 'Robusto e imbuido en piedras celestes para absorber golpes violentos.',
    cost: [
      { material: 'stone', rarity: 'rare', count: 12 },
      { material: 'metal', rarity: 'common', count: 8 }
    ]
  },
  {
    id: 'armor_divine_scales',
    name: 'Cota de Escamas Divinas',
    type: 'equipment',
    subType: 'armor',
    rarity: 'legendary',
    statBonus: 'PVP: -40% Daño Recibido',
    description: 'Una armadura impenetrable que reduce drásticamente el saqueo de tus oponentes.',
    cost: [
      { material: 'metal', rarity: 'legendary', count: 3 },
      { material: 'stone', rarity: 'epic', count: 8 },
      { material: 'essence', rarity: 'legendary', count: 4 }
    ]
  },

  // Furniture (Casa Decor)
  {
    id: 'decor_wind_table',
    name: 'Mesa de Cedro de los Vientos',
    type: 'furniture',
    rarity: 'common',
    description: 'Una mesa pulida perfecta para colocar tónicos sentimentales encima.',
    cost: [
      { material: 'wood', rarity: 'common', count: 8 }
    ]
  },
  {
    id: 'decor_serene_altar',
    name: 'Altar de Cristal de Serenidad',
    type: 'furniture',
    rarity: 'rare',
    description: 'Un altar que canaliza energías pacíficas del bosque directamente a tu sala.',
    cost: [
      { material: 'stone', rarity: 'rare', count: 10 },
      { material: 'essence', rarity: 'common', count: 5 }
    ]
  },
  {
    id: 'decor_velvet_sofa',
    name: 'Sillón de Terciopelo Púrpura',
    type: 'furniture',
    rarity: 'epic',
    description: 'Un lujoso sillón cómodo para que tú y tu Nitz descansen plácidamente.',
    cost: [
      { material: 'wood', rarity: 'rare', count: 12 },
      { material: 'essence', rarity: 'epic', count: 4 }
    ]
  },
  {
    id: 'decor_king_throne',
    name: 'Trono del Rey Nitz',
    type: 'furniture',
    rarity: 'legendary',
    description: 'Un majestuoso trono flotante esculpido puramente para el Nitz alfa de fase 5.',
    cost: [
      { material: 'metal', rarity: 'epic', count: 15 },
      { material: 'essence', rarity: 'legendary', count: 6 },
      { material: 'stone', rarity: 'legendary', count: 3 }
    ]
  }
];

export const Crafting: React.FC<CraftingProps> = ({ progress, onSaveProgress }) => {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe>(CRAFTING_RECIPES[0]);
  const [craftingSuccess, setCraftingSuccess] = useState<string | null>(null);

  // Material helpers
  const getMaterialCount = (type: 'wood' | 'stone' | 'metal' | 'essence', rarity: 'common' | 'rare' | 'epic' | 'legendary'): number => {
    return progress.inventory[type]?.[rarity] || 0;
  };

  const checkCanCraft = (recipe: Recipe): boolean => {
    return recipe.cost.every((req) => {
      return getMaterialCount(req.material, req.rarity) >= req.count;
    });
  };

  const triggerAnvilSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Synth chime chime
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); 
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.25);
      
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.82);
    } catch (e) {
      // Audio context error fallback
    }
  };

  const handleCraft = () => {
    if (!checkCanCraft(selectedRecipe)) return;

    triggerAnvilSound();

    // Deduct and add
    const nextInventory = JSON.parse(JSON.stringify(progress.inventory)) as GatheringInventory;
    selectedRecipe.cost.forEach((req) => {
      nextInventory[req.material][req.rarity] -= req.count;
    });

    const newCraftedItem: CraftableItem = {
      id: `${selectedRecipe.id}_${Date.now()}`,
      name: selectedRecipe.name,
      type: selectedRecipe.type,
      subType: selectedRecipe.subType,
      rarity: selectedRecipe.rarity,
      statBonus: selectedRecipe.statBonus,
      placed: false,
      equipped: false
    };

    const nextProgress: PlayerProgress = {
      ...progress,
      inventory: nextInventory,
      craftedItems: [...progress.craftedItems, newCraftedItem]
    };

    onSaveProgress(nextProgress);
    
    setCraftingSuccess(`¡Crafteaste con éxito: ${selectedRecipe.name}!`);
    setTimeout(() => {
      setCraftingSuccess(null);
    }, 4000);
  };

  const getRarityStyles = (rarity: 'common' | 'rare' | 'epic' | 'legendary') => {
    switch (rarity) {
      case 'common': return 'border-slate-500 text-slate-300 bg-slate-950/40';
      case 'rare': return 'border-cyan-500 text-cyan-300 bg-cyan-950/40';
      case 'epic': return 'border-purple-500 text-purple-300 bg-purple-950/40';
      case 'legendary': return 'border-amber-500 text-amber-300 bg-amber-950/40';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      
      {/* Title & Introduction */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-4 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-headline-lg text-white flex items-center gap-2">
            <Hammer className="w-6 h-6 text-[#dec1ac] animate-bounce" />
            Forja de Albion: Recolección y Artesanía
          </h1>
          <p className="text-xs text-[#919097] uppercase tracking-wider">Combina tus recursos recolectados para equiparte y decorar tu casa mística.</p>
        </div>
        <div className="p-2 border border-blue-500/20 bg-blue-950/20 text-blue-300 text-[11px] rounded-lg flex items-center gap-2 max-w-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Forja armas para aumentar el poder de ataque en las Zonas PvP del Mundo Abierto.</span>
        </div>
      </div>

      {/* Resource Inventory Banner */}
      <div className="glass-panel bg-[#121424]/80 p-5 rounded-xl border border-white/10 shadow-lg space-y-4">
        <h3 className="text-xs uppercase font-bold tracking-widest text-[#dec1ac] flex items-center gap-1.5 font-mono">
          <Database className="w-4 h-4" /> Almacén de Recursos Forjados
        </h3>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(['wood', 'stone', 'metal', 'essence'] as const).map((mat) => {
            const matLabels: Record<string, string> = { wood: 'Aura Wood (Madera)', stone: 'Stellar Stone (Piedra)', metal: 'Celestial Metal (Hierro)', essence: 'Astral Essence' };
            const mData = progress.inventory[mat];
            return (
              <div key={mat} className="bg-[#181a30]/50 border border-white/5 p-3 rounded-lg space-y-2">
                <span className="text-xs font-bold text-white block capitalize">{matLabels[mat]}</span>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  <span className="flex items-center justify-between px-1.5 py-0.5 bg-slate-950/50 rounded text-slate-400">
                    <span>Común:</span> <strong>{mData.common}</strong>
                  </span>
                  <span className="flex items-center justify-between px-1.5 py-0.5 bg-cyan-950/50 rounded text-cyan-400">
                    <span>Raro:</span> <strong>{mData.rare}</strong>
                  </span>
                  <span className="flex items-center justify-between px-1.5 py-0.5 bg-purple-950/50 rounded text-purple-400">
                    <span>Épico:</span> <strong>{mData.epic}</strong>
                  </span>
                  <span className="flex items-center justify-between px-1.5 py-0.5 bg-amber-950/50 rounded text-amber-400">
                    <span>Leg:</span> <strong>{mData.legendary}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workbench Screen Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Recipes Scroll Board */}
        <div className="lg:col-span-5 bg-[#121424]/90 rounded-xl border border-white/10 p-4 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/5 pb-2 mb-2">Libro de Frecuencias Primordiales</h3>
          
          <div className="space-y-2">
            {CRAFTING_RECIPES.map((recipe) => {
              const countOwned = progress.craftedItems.filter(ci => ci.name === recipe.name).length;
              const hasMaterials = checkCanCraft(recipe);
              const isSelected = selectedRecipe.id === recipe.id;

              return (
                <button
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(recipe)}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-200 flex items-center justify-between ${
                    isSelected 
                      ? 'bg-[#dec1ac]/15 border-[#dec1ac]' 
                      : 'bg-[#181a30]/60 border-white/5 hover:border-white/10 hover:bg-[#1a1c35]'
                  }`}
                >
                  <div className="flex gap-3 items-center">
                    <div className="p-2 border rounded-md" style={{ borderColor: isSelected ? '#dec1ac' : 'rgba(255,255,255,0.08)' }}>
                      {recipe.type === 'furniture' && <Sofa className="w-5 h-5 text-sky-400" />}
                      {recipe.subType === 'weapon' && <Sword className="w-5 h-5 text-red-400" />}
                      {recipe.subType === 'shield' && <Shield className="w-5 h-5 text-yellow-400" />}
                      {recipe.subType === 'armor' && <Shield className="w-5 h-5 text-purple-400" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        {recipe.name}
                        {countOwned > 0 && (
                          <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-1 py-0.5 rounded font-mono">
                            Poseído ({countOwned})
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-[#919097] capitalize line-clamp-1">{recipe.description}</p>
                    </div>
                  </div>
                  
                  <span className={`text-[9px] font-mono font-bold capitalize border px-2 py-0.5 rounded ${
                    recipe.rarity === 'legendary' ? 'border-amber-500/50 text-amber-400 bg-amber-500/10' :
                    recipe.rarity === 'epic' ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' :
                    recipe.rarity === 'rare' ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10' :
                    'border-slate-500/50 text-slate-400 bg-slate-500/10'
                  }`}>
                    {recipe.rarity}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Recipe Details & Blueprint */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-gradient-to-b from-[#111326] to-[#080914] rounded-xl border border-white/10 shadow-2xl p-6 relative overflow-hidden h-[500px]">
          
          <AnimatePresence mode="wait">
            <motion.div 
              key={selectedRecipe.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 flex-1 flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Title Card */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-[#919097] uppercase tracking-widest block">Plano de Forja</span>
                    <h2 className="text-xl font-bold font-headline-lg text-white mt-1">{selectedRecipe.name}</h2>
                  </div>
                  <span className={`text-[11px] font-mono uppercase tracking-widest font-bold border px-3 py-1 rounded-md ${getRarityStyles(selectedRecipe.rarity)}`}>
                    RAREZA: {selectedRecipe.rarity}
                  </span>
                </div>

                {/* Stat block */}
                {selectedRecipe.statBonus && (
                  <div className="p-3 border border-[#dec1ac]/20 bg-[#dec1ac]/5 text-tertiary rounded-lg text-xs flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-[10px] font-mono">Bono de Atributo:</span>
                    <span className="font-semibold text-glow-silver text-white">{selectedRecipe.statBonus}</span>
                  </div>
                )}

                {/* Description */}
                <p className="text-xs text-[#eaeafb] leading-relaxed italic bg-white/2 p-3 rounded-lg font-sans">
                  " {selectedRecipe.description} "
                </p>

                {/* Crafting Requirements */}
                <div className="space-y-2">
                  <h4 className="text-xs uppercase font-bold text-[#c4c5da] tracking-wide font-mono">Ingredientes Requeridos:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedRecipe.cost.map((req) => {
                      const countOwned = getMaterialCount(req.material, req.rarity);
                      const hasEnough = countOwned >= req.count;
                      return (
                        <div key={`${req.material}_${req.rarity}`} className="flex items-center justify-between p-2.5 bg-black/45 border border-white/5 rounded-lg text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              req.rarity === 'legendary' ? 'bg-amber-500' :
                              req.rarity === 'epic' ? 'bg-purple-500' :
                              req.rarity === 'rare' ? 'bg-cyan-500' :
                              'bg-slate-400'
                            }`} />
                            <span className="capitalize text-[#dbdbea] font-medium">{req.material} ({req.rarity})</span>
                          </div>
                          <span className="font-mono">
                            <strong className={hasEnough ? 'text-green-400' : 'text-red-400'}>{countOwned}</strong> / {req.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Crafting Button Trigger */}
              <div className="space-y-4">
                {craftingSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 text-xs rounded-lg text-center font-semibold flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Check className="w-4 h-4 animate-bounce" />
                    {craftingSuccess}
                  </motion.div>
                )}

                <button
                  onClick={handleCraft}
                  disabled={!checkCanCraft(selectedRecipe)}
                  className={`w-full p-4 rounded-xl flex items-center justify-center gap-2.5 transition-all outline-none font-bold shadow-lg ${
                    checkCanCraft(selectedRecipe)
                      ? 'bg-[#dec1ac] text-black hover:bg-white active:scale-95 btn-glow'
                      : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  <Hammer className="w-5 h-5" />
                  <span>FORJAR PLANO PRIMORDIAL</span>
                </button>
              </div>

            </motion.div>
          </AnimatePresence>

          {/* Volumetric background lights */}
          <div className="absolute inset-0 opacity-10 blur-[80px] pointer-events-none bg-gradient-to-tr from-[#dec1ac]/10 to-transparent" />
        </div>

      </div>

    </div>
  );
};
