import React from 'react';
import { motion } from 'motion/react';
import { X, Sword, Target, BookOpen, Hand, ShieldAlert, Check } from 'lucide-react';
import { PlayerProgress, CraftableItem, EquipmentSlots } from '../types';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface ArmoryUIProps {
  progress: PlayerProgress;
  onSaveProgress: (p: PlayerProgress) => void;
  onClose: () => void;
}

export function ArmoryUI({ progress, onSaveProgress, onClose }: ArmoryUIProps) {
  const currentEquipped = progress.equipment?.mainHand || null;

  // Generate test weapons
  const testWeapons: {
    category: 'sword' | 'ranged' | 'grimoire' | 'fists';
    label: string;
    icon: any;
    items: CraftableItem[];
  }[] = [
    {
      category: 'sword',
      label: 'Espadas (Corto Alcance / Daño Alto)',
      icon: Sword,
      items: [
        { id: 'armory_sword_t1', name: 'Sable Estelar Rústico (T1)', type: 'equipment', subType: 'weapon_1h', rarity: 'common', tier: 1, statBonus: 'DMG+10', equipped: false },
        { id: 'armory_sword_t2', name: 'Espada de Acero Lunar (T2)', type: 'equipment', subType: 'weapon_1h', rarity: 'rare', tier: 2, statBonus: 'DMG+22', equipped: false },
        { id: 'armory_sword_t3', name: 'Filo del Vacío Centelleante (T3)', type: 'equipment', subType: 'weapon_1h', rarity: 'epic', tier: 3, statBonus: 'DMG+45', equipped: false },
        { id: 'armory_sword_t4', name: 'Excalibur Sobrenatural (T4)', type: 'equipment', subType: 'weapon_2h', rarity: 'legendary', tier: 4, statBonus: 'DMG+90', equipped: false }
      ]
    },
    {
      category: 'ranged',
      label: 'Fusiles y Proyectiles (Largo Alcance / Ataque Rápido)',
      icon: Target,
      items: [
        { id: 'armory_ranged_t1', name: 'Mosquete de Chispa (T1)', type: 'equipment', subType: 'ranged', rarity: 'common', tier: 1, statBonus: 'DMG+6', equipped: false },
        { id: 'armory_ranged_t2', name: 'Repetidor de Plasma (T2)', type: 'equipment', subType: 'ranged', rarity: 'rare', tier: 2, statBonus: 'DMG+14', equipped: false },
        { id: 'armory_ranged_t3', name: 'Rifle Pulsar Nebular (T3)', type: 'equipment', subType: 'ranged', rarity: 'epic', tier: 3, statBonus: 'DMG+30', equipped: false },
        { id: 'armory_ranged_t4', name: 'Lanzador Estelar Eclipse (T4)', type: 'equipment', subType: 'ranged', rarity: 'legendary', tier: 4, statBonus: 'DMG+65', equipped: false }
      ]
    },
    {
      category: 'grimoire',
      label: 'Grimorios (Daño en Área / Velocidad Lenta)',
      icon: BookOpen,
      items: [
        { id: 'armory_grimoire_t1', name: 'Códice de Aprendiz (T1)', type: 'equipment', subType: 'grimoire', rarity: 'common', tier: 1, statBonus: 'DMG+15', equipped: false },
        { id: 'armory_grimoire_t2', name: 'Tomo de Runas Gravitatorias (T2)', type: 'equipment', subType: 'grimoire', rarity: 'rare', tier: 2, statBonus: 'DMG+32', equipped: false },
        { id: 'armory_grimoire_t3', name: 'Libro de Alquimia Estelar (T3)', type: 'equipment', subType: 'grimoire', rarity: 'epic', tier: 3, statBonus: 'DMG+68', equipped: false },
        { id: 'armory_grimoire_t4', name: 'Grimorio del Fin de los Tiempos (T4)', type: 'equipment', subType: 'grimoire', rarity: 'legendary', tier: 4, statBonus: 'DMG+130', equipped: false }
      ]
    },
    {
      category: 'fists',
      label: 'Guanteletes (Cuerpo a Cuerpo / Rápido / Onda Choque)',
      icon: Hand,
      items: [
        { id: 'armory_fists_t1', name: 'Guantes de Cuero Reforzado (T1)', type: 'equipment', subType: 'fists', rarity: 'common', tier: 1, statBonus: 'DMG+5', equipped: false },
        { id: 'armory_fists_t2', name: 'Cestus de Hierro Forjado (T2)', type: 'equipment', subType: 'fists', rarity: 'rare', tier: 2, statBonus: 'DMG+12', equipped: false },
        { id: 'armory_fists_t3', name: 'Nudilleras del Impacto (T3)', type: 'equipment', subType: 'fists', rarity: 'epic', tier: 3, statBonus: 'DMG+25', equipped: false },
        { id: 'armory_fists_t4', name: 'Guanteletes de Pulso Cósmico (T4)', type: 'equipment', subType: 'fists', rarity: 'legendary', tier: 4, statBonus: 'DMG+50', equipped: false }
      ]
    }
  ];

  const handleEquip = async (item: CraftableItem | null) => {
    const updatedEquipment: EquipmentSlots = {
      ...(progress.equipment || {}),
      mainHand: item ? { ...item, equipped: true } : null
    };

    const newProgress: PlayerProgress = {
      ...progress,
      equipment: updatedEquipment
    };

    onSaveProgress(newProgress);

    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      try {
        await updateDoc(userRef, {
          equipment: updatedEquipment
        });
      } catch (err) {
        console.error("Error updating equipped item in Firestore:", err);
      }
    }
  };

  const getRarityBadgeColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'epic': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'rare': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  return (
    <div className="w-full max-w-4xl bg-[#0a0812]/95 border border-purple-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(139,92,246,0.15)] flex flex-col h-[85vh] text-white">
      {/* Header */}
      <div className="p-6 border-b border-purple-500/20 flex justify-between items-center bg-purple-950/10">
        <div>
          <h2 className="text-2xl font-bold font-headline-md tracking-wider text-purple-400">ARMERO DE PRUEBAS TÁCTICAS</h2>
          <p className="text-gray-400 text-xs mt-0.5">Equipa instantáneamente cualquier arma para probar sus mecánicas, cadencia y tipo de proyectiles.</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Active Weapon Preview */}
        <div className="bg-purple-950/10 border border-purple-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sword className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-xs text-purple-300 font-mono tracking-widest uppercase">Arma Equipada Actualmente:</span>
              <h3 className="text-lg font-bold text-white">
                {currentEquipped ? currentEquipped.name : 'Puños Vacíos (Combate por Defecto)'}
              </h3>
            </div>
          </div>
          {currentEquipped && (
            <button
              onClick={() => handleEquip(null)}
              className="bg-red-950/30 border border-red-500/30 hover:bg-red-900/40 text-red-300 hover:text-red-200 text-xs font-bold py-2 px-4 rounded-lg transition duration-150"
            >
              Desequipar Arma
            </button>
          )}
        </div>

        {/* Weapons List Grid */}
        <div className="grid grid-cols-1 gap-6">
          {testWeapons.map(cat => {
            const CatIcon = cat.icon;
            return (
              <div key={cat.category} className="space-y-3">
                <h4 className="text-sm font-mono font-bold tracking-wider text-purple-300 flex items-center gap-2 border-b border-purple-500/10 pb-1.5">
                  <CatIcon className="w-4 h-4 text-purple-400" />
                  {cat.label}
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {cat.items.map(item => {
                    const isEquipped = currentEquipped && currentEquipped.name === item.name;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleEquip(item)}
                        className={`border rounded-xl p-3.5 flex flex-col justify-between h-36 cursor-pointer transition-all duration-200 bg-black/40 hover:bg-purple-950/10 hover:border-purple-500/40 ${
                          isEquipped 
                            ? 'border-purple-500 bg-purple-950/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]' 
                            : 'border-white/5'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${getRarityBadgeColor(item.rarity)}`}>
                              T{item.tier}
                            </span>
                            {isEquipped && (
                              <span className="text-purple-400 flex items-center gap-0.5 text-[10px] font-bold">
                                <Check className="w-3.5 h-3.5" /> Equipada
                              </span>
                            )}
                          </div>
                          <h5 className="font-bold text-sm mt-2 line-clamp-2 group-hover:text-purple-300 transition duration-150">{item.name}</h5>
                        </div>
                        
                        <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-2">
                          <span className="text-[10px] text-purple-300 font-mono font-bold">{item.statBonus}</span>
                          <span className="text-[10px] text-gray-400 group-hover:text-white transition duration-150">Hacer click para equipar</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-purple-500/20 bg-purple-950/5 text-[11px] text-gray-500 flex items-start gap-1.5">
        <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <span>El equipamiento en este panel es instantáneo. Al salir del armero, tu barra de acción y proyectiles cambiarán en el acto. Puedes usar los enemigos y maniquíes en las afueras para probar el alcance y daño real de cada arma.</span>
      </div>
    </div>
  );
}
