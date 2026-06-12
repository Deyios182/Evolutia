import React, { useState } from 'react';
import { PlayerProgress } from '../types';
import { Package, ArrowRightLeft, Shield, Backpack, XCircle } from 'lucide-react';

interface StashUIProps {
  progress: PlayerProgress;
  onSaveProgress: (newProg: PlayerProgress) => void;
  onClose: () => void;
}

export function StashUI({ progress, onSaveProgress, onClose }: StashUIProps) {
  const materials = ['wood', 'stone', 'metal', 'essence'] as const;
  const rarities = ['common', 'rare', 'epic', 'legendary'] as const;

  const handleTransfer = (
    direction: 'to_stash' | 'from_stash',
    matType: 'wood' | 'stone' | 'metal' | 'essence',
    rarity: 'common' | 'rare' | 'epic' | 'legendary',
    amount: number
  ) => {
    const newProg = { ...progress };
    
    // Initialize stashInventory if undefined (backwards compatibility)
    if (!newProg.stashInventory) {
      newProg.stashInventory = {
        wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
        stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
        metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
        essence: { common: 0, rare: 0, epic: 0, legendary: 0 },
      };
    }

    if (direction === 'to_stash') {
      const available = newProg.inventory[matType][rarity] || 0;
      if (available < amount) return;
      newProg.inventory[matType][rarity] -= amount;
      newProg.stashInventory[matType][rarity] = (newProg.stashInventory[matType][rarity] || 0) + amount;
    } else {
      const available = newProg.stashInventory[matType][rarity] || 0;
      if (available < amount) return;
      newProg.stashInventory[matType][rarity] -= amount;
      newProg.inventory[matType][rarity] = (newProg.inventory[matType][rarity] || 0) + amount;
    }

    onSaveProgress(newProg);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0b0c16] text-white">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-bold font-headline-md tracking-wider text-amber-500 uppercase">Almacén Seguro Astral</h2>
        </div>
        <button onClick={onClose} className="p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/40">
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-amber-900/20 border border-amber-500/20 p-4 rounded-xl text-xs text-amber-200 mb-6 flex items-start gap-3">
        <Shield className="w-5 h-5 flex-shrink-0" />
        <p>Los materiales guardados en este Baúl <strong>jamás se perderán</strong> si caes en combate en las Zonas Rojas (Full Loot PvP). Transfiere tus recursos valiosos aquí antes de salir de la cabaña.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
        
        {/* PLAYER INVENTORY PANEL */}
        <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
            <Backpack className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-cyan-400 uppercase tracking-wide">Mochila Activa</h3>
          </div>
          
          <div className="overflow-y-auto custom-scrollbar pr-2 space-y-4">
            {materials.map(mat => (
              <div key={`inv_${mat}`} className="bg-black/30 p-3 rounded-lg border border-white/5">
                <h4 className="font-bold text-[10px] uppercase text-gray-400 mb-2 border-b border-white/10 pb-1">{mat}</h4>
                {rarities.map(rar => {
                  const count = progress.inventory[mat][rar] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={`inv_${mat}_${rar}`} className="flex items-center justify-between py-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rar === 'common' ? '#34d399' : rar === 'rare' ? '#60a5fa' : rar === 'epic' ? '#c084fc' : '#facc15' }} />
                        <span className="capitalize">{rar}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold">{count}</span>
                        <button 
                          onClick={() => handleTransfer('to_stash', mat, rar, 1)}
                          className="bg-amber-600/30 hover:bg-amber-500/50 text-amber-400 p-1.5 rounded"
                          title="Mover 1 al Almacén"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* STASH PANEL */}
        <div className="flex-1 bg-[#181512] border border-amber-500/20 rounded-xl p-4 flex flex-col overflow-hidden shadow-[0_0_20px_rgba(245,158,11,0.1)]">
          <div className="flex items-center gap-2 mb-4 border-b border-amber-500/20 pb-2">
            <Package className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-amber-500 uppercase tracking-wide">Baúl Seguro</h3>
          </div>

          <div className="overflow-y-auto custom-scrollbar pr-2 space-y-4">
            {materials.map(mat => (
              <div key={`stash_${mat}`} className="bg-black/50 p-3 rounded-lg border border-amber-500/10">
                <h4 className="font-bold text-[10px] uppercase text-amber-500/60 mb-2 border-b border-amber-500/10 pb-1">{mat}</h4>
                {rarities.map(rar => {
                  const count = progress.stashInventory?.[mat]?.[rar] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={`stash_${mat}_${rar}`} className="flex items-center justify-between py-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rar === 'common' ? '#34d399' : rar === 'rare' ? '#60a5fa' : rar === 'epic' ? '#c084fc' : '#facc15' }} />
                        <span className="capitalize text-amber-100">{rar}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-amber-400">{count}</span>
                        <button 
                          onClick={() => handleTransfer('from_stash', mat, rar, 1)}
                          className="bg-cyan-600/30 hover:bg-cyan-500/50 text-cyan-400 p-1.5 rounded"
                          title="Sacar 1 a la Mochila"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            
            {(!progress.stashInventory || 
              materials.every(m => rarities.every(r => (progress.stashInventory![m][r] || 0) === 0))) && (
              <div className="text-center py-12 text-gray-500 italic opacity-50">
                Tu baúl está vacío. Guarda aquí tus recursos para no perderlos.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
