import React, { useState } from 'react';
import { Hammer, Shield, Crosshair, Star, ChevronUp, Lock } from 'lucide-react';
import { PlayerProgress, CraftableItem } from '../types';

interface WorkbenchUIProps {
  progress: PlayerProgress;
  onSaveProgress: (p: PlayerProgress) => void;
  onClose: () => void;
  type: 'forge' | 'weaver' | 'enchanter';
}

type Recipe = {
  result: CraftableItem;
  cost: { wood: number; stone: number; metal: number; essence: number };
  requiredLevel: number;
};

const RECIPES: Record<'forge' | 'weaver' | 'enchanter', Recipe[]> = {
  forge: [
    {
      result: { id: 'w_sword1', name: 'Sable Oxidado', type: 'equipment', subType: 'weapon_1h', rarity: 'common', weight: 4 },
      cost: { wood: 10, stone: 0, metal: 15, essence: 0 }, requiredLevel: 1
    },
    {
      result: { id: 'w_rifle1', name: 'Rifle de Chatarra', type: 'equipment', subType: 'ranged', rarity: 'rare', weight: 6, statBonus: 'DMG+25' },
      cost: { wood: 50, stone: 0, metal: 100, essence: 10 }, requiredLevel: 2
    },
    {
      result: { id: 'a_chest1', name: 'Pechera de Placas Pesadas', type: 'equipment', subType: 'chest', rarity: 'rare', weight: 12, statBonus: 'HP+150' },
      cost: { wood: 0, stone: 50, metal: 150, essence: 0 }, requiredLevel: 3
    }
  ],
  weaver: [
    {
      result: { id: 'bp_1', name: 'Mochila de Superviviente', type: 'equipment', subType: 'backpack', rarity: 'common', weight: 1, weightCapacity: 80 },
      cost: { wood: 30, stone: 0, metal: 0, essence: 0 }, requiredLevel: 1
    },
    {
      result: { id: 'a_legs1', name: 'Botas Tácticas Ligeras', type: 'equipment', subType: 'legs', rarity: 'common', weight: 2, statBonus: 'HP+20' },
      cost: { wood: 40, stone: 0, metal: 5, essence: 0 }, requiredLevel: 1
    },
    {
      result: { id: 'bp_2', name: 'Mochila Militar XL', type: 'equipment', subType: 'backpack', rarity: 'rare', weight: 3, weightCapacity: 200 },
      cost: { wood: 150, stone: 0, metal: 50, essence: 0 }, requiredLevel: 2
    }
  ],
  enchanter: [
    {
      result: { id: 'w_grim1', name: 'Grimorio de Aprendiz', type: 'equipment', subType: 'grimoire', rarity: 'common', weight: 2 },
      cost: { wood: 5, stone: 0, metal: 0, essence: 25 }, requiredLevel: 1
    },
    {
      result: { id: 'r_ring1', name: 'Anillo de Vigor Menor', type: 'equipment', subType: 'ring', rarity: 'rare', weight: 0.2, statBonus: 'HP+50' },
      cost: { wood: 0, stone: 0, metal: 10, essence: 50 }, requiredLevel: 2
    },
    {
      result: { id: 's_shield1', name: 'Escudo de Plasma', type: 'equipment', subType: 'shield', rarity: 'epic', weight: 3, statBonus: 'HP+200' },
      cost: { wood: 0, stone: 100, metal: 100, essence: 200 }, requiredLevel: 3
    }
  ]
};

export const WorkbenchUI: React.FC<WorkbenchUIProps> = ({ progress, onSaveProgress, onClose, type }) => {
  const [notification, setNotification] = useState<string | null>(null);

  const getWorkbenchData = () => {
    switch (type) {
      case 'forge': return { name: 'Herrería Pesada', level: progress.workbenchForgeLevel || 1, color: 'text-orange-500', bg: 'bg-orange-500' };
      case 'weaver': return { name: 'Telar de Supervivencia', level: progress.workbenchWeaverLevel || 1, color: 'text-emerald-500', bg: 'bg-emerald-500' };
      case 'enchanter': return { name: 'Mesa de Arcanos', level: progress.workbenchEnchanterLevel || 1, color: 'text-purple-500', bg: 'bg-purple-500' };
    }
  };

  const wb = getWorkbenchData();
  const maxLevel = 5;

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUpgrade = () => {
    if (wb.level >= maxLevel) return;
    
    // Upgrade cost scaling
    const costWood = wb.level * 100;
    const costStone = wb.level * 100;
    const costMetal = wb.level * 50;

    const inv = progress.inventory;
    if (
      inv.wood.common >= costWood &&
      inv.stone.common >= costStone &&
      inv.metal.common >= costMetal
    ) {
      const nextInv = { ...inv };
      nextInv.wood.common -= costWood;
      nextInv.stone.common -= costStone;
      nextInv.metal.common -= costMetal;

      const updates: any = { inventory: nextInv };
      if (type === 'forge') updates.workbenchForgeLevel = wb.level + 1;
      if (type === 'weaver') updates.workbenchWeaverLevel = wb.level + 1;
      if (type === 'enchanter') updates.workbenchEnchanterLevel = wb.level + 1;

      onSaveProgress({ ...progress, ...updates });
      showNotif(`¡${wb.name} mejorada a Nivel ${wb.level + 1}!`);
    } else {
      showNotif("❌ Recursos insuficientes en el inventario permanente.");
    }
  };

  const handleCraft = (recipe: Recipe) => {
    if (wb.level < recipe.requiredLevel) {
      showNotif("❌ Requiere subir de nivel la estación.");
      return;
    }

    const inv = progress.inventory;
    if (
      inv.wood.common >= recipe.cost.wood &&
      inv.stone.common >= recipe.cost.stone &&
      inv.metal.common >= recipe.cost.metal &&
      inv.essence.common >= recipe.cost.essence
    ) {
      const nextInv = { ...inv };
      nextInv.wood.common -= recipe.cost.wood;
      nextInv.stone.common -= recipe.cost.stone;
      nextInv.metal.common -= recipe.cost.metal;
      nextInv.essence.common -= recipe.cost.essence;

      // Ensure item is completely unique
      const newItem = { ...recipe.result, id: `${recipe.result.id}_${Date.now()}` };
      
      onSaveProgress({
        ...progress,
        inventory: nextInv,
        craftedItems: [...(progress.craftedItems || []), newItem]
      });

      showNotif(`🛠️ Has fabricado: ${recipe.result.name}`);
    } else {
      showNotif("❌ Materiales insuficientes en tu inventario permanente (Stash).");
    }
  };

  return (
    <div className="w-full h-full flex flex-col text-gray-200 relative p-4">
      {/* Title Header */}
      <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
        <div>
          <h2 className={`text-2xl font-black uppercase tracking-widest flex items-center gap-2 ${wb.color}`}>
            <Hammer className="w-6 h-6" /> {wb.name} <span className="text-sm bg-white/10 px-2 py-0.5 rounded text-white ml-2">LVL {wb.level}</span>
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">Sintetiza equipo usando los recursos de tu Almacén Seguro.</p>
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

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Upgrade Station */}
        <div className="w-full lg:w-1/3 bg-[#0a0c10] border border-white/5 rounded-xl p-6 relative overflow-hidden group">
          <div className={`absolute top-0 left-0 w-1 h-full ${wb.bg}`} />
          <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-gray-300">
            <ChevronUp className="w-4 h-4" /> Mejora de Estación
          </h3>
          
          {wb.level < maxLevel ? (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">Sube de nivel para desbloquear planos de fabricación más avanzados y poderosos.</p>
              <div className="bg-[#11161d] p-3 rounded border border-white/5 text-xs font-mono space-y-1">
                <div className="text-amber-600/80">🌲 Madera Req: {wb.level * 100}</div>
                <div className="text-slate-500">🪨 Piedra Req: {wb.level * 100}</div>
                <div className="text-gray-400">⚙️ Metal Req: {wb.level * 50}</div>
              </div>
              <button 
                onClick={handleUpgrade}
                className={`w-full py-3 rounded-lg font-bold uppercase text-xs tracking-wider transition-all shadow-lg hover:brightness-110 active:scale-95 ${wb.bg} text-black`}
              >
                Actualizar a Lvl {wb.level + 1}
              </button>
            </div>
          ) : (
            <div className="text-center py-10 space-y-2">
              <Star className={`w-10 h-10 mx-auto ${wb.color}`} />
              <div className="text-sm font-bold uppercase">Nivel Máximo Alcanzado</div>
            </div>
          )}
        </div>

        {/* Right Column: Crafting Blueprints */}
        <div className="flex-1">
          <h3 className="text-sm font-bold uppercase tracking-widest mb-4 text-gray-300">Planos Disponibles</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {RECIPES[type].map((recipe, idx) => {
              const isLocked = wb.level < recipe.requiredLevel;
              return (
                <div key={idx} className={`bg-[#0a0c10] border rounded-xl p-4 flex flex-col relative transition-all ${isLocked ? 'border-red-900/30 opacity-70' : 'border-white/10 hover:border-white/30'}`}>
                  {isLocked && (
                    <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center rounded-xl backdrop-blur-[1px]">
                      <div className="bg-red-900/80 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase flex items-center gap-1 shadow-xl">
                        <Lock className="w-3 h-3" /> Req Lvl {recipe.requiredLevel}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-gray-200">{recipe.result.name}</h4>
                      <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded mt-1 inline-block ${
                        recipe.result.rarity === 'common' ? 'bg-gray-600/30 text-gray-300' :
                        recipe.result.rarity === 'rare' ? 'bg-blue-600/30 text-blue-300' :
                        'bg-purple-600/30 text-purple-300'
                      }`}>
                        {recipe.result.rarity} - {recipe.result.subType}
                      </span>
                    </div>
                    {recipe.result.statBonus && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                        {recipe.result.statBonus}
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-gray-500 mb-3 font-mono">
                    Peso: {recipe.result.weight}KG
                    {recipe.result.weightCapacity && ` | Carga Máx: ${recipe.result.weightCapacity}KG`}
                  </div>

                  <div className="mt-auto pt-3 border-t border-white/5 space-y-2">
                    <div className="flex gap-2 text-[10px] font-mono text-gray-400">
                      {recipe.cost.wood > 0 && <span>Madera: {recipe.cost.wood}</span>}
                      {recipe.cost.stone > 0 && <span>Piedra: {recipe.cost.stone}</span>}
                      {recipe.cost.metal > 0 && <span>Metal: {recipe.cost.metal}</span>}
                      {recipe.cost.essence > 0 && <span>Esencia: {recipe.cost.essence}</span>}
                    </div>
                    
                    <button
                      disabled={isLocked}
                      onClick={() => handleCraft(recipe)}
                      className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 py-1.5 rounded text-xs font-bold uppercase transition-all"
                    >
                      Fabricar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
