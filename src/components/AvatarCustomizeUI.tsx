import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Sparkles, Shirt, Palette, ShieldAlert, Check } from 'lucide-react';
import { PlayerProgress, AvatarCustomization } from '../types';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface AvatarCustomizeUIProps {
  progress: PlayerProgress;
  onSaveProgress: (p: PlayerProgress) => void;
  onClose: () => void;
}

export function AvatarCustomizeUI({ progress, onSaveProgress, onClose }: AvatarCustomizeUIProps) {
  const currentAvatar = progress.avatar || {
    name: 'Nitz de Origen',
    accessory: 'none',
    auraType: 'none',
    colorTheme: 'classic',
    clothing: 'none'
  };

  const [name, setName] = useState(currentAvatar.name || '');
  const [accessory, setAccessory] = useState<AvatarCustomization['accessory']>(currentAvatar.accessory || 'none');
  const [clothing, setClothing] = useState<AvatarCustomization['clothing']>(currentAvatar.clothing || 'none');
  const [colorTheme, setColorTheme] = useState<AvatarCustomization['colorTheme']>(currentAvatar.colorTheme || 'classic');
  const [saving, setSaving] = useState(false);

  const accessoriesList: { id: AvatarCustomization['accessory']; label: string; desc: string; icon: string }[] = [
    { id: 'none', label: 'Sin Accesorio', desc: 'Aspecto simple y minimalista', icon: '❌' },
    { id: 'halo', label: 'Halo de Luz', desc: 'Un aro celestial brillante sobre tu cabeza', icon: '😇' },
    { id: 'ribbon', label: 'Lazo Festivo', desc: 'Un lazo rosa que denota elegancia', icon: '🎀' },
    { id: 'horn_gold', label: 'Cuernos de Oro', desc: 'Cuernos estelares forjados en oro puro', icon: '👑' },
    { id: 'scarf_cozy', label: 'Bufanda Acogedora', desc: 'Bufanda cálida contra el frío cósmico', icon: '🧣' },
  ];

  const clothingList: { id: AvatarCustomization['clothing']; label: string; desc: string; icon: string }[] = [
    { id: 'none', label: 'Sin Ropa', desc: 'Aspecto natural estelar', icon: '🍃' },
    { id: 'shawl', label: 'Mantón de Éter', desc: 'Un chal ligero que ondea con el viento', icon: '🧣' },
    { id: 'armor_shard', label: 'Escamas de Blindaje', desc: 'Fragmentos de metal adheridos al torso', icon: '🛡️' },
    { id: 'robe_sage', label: 'Túnica de Sabio', desc: 'Ropaje largo ceremonial de sabio cósmico', icon: '🧙' },
  ];

  const colorThemesList: { id: AvatarCustomization['colorTheme']; label: string; desc: string; colorClass: string; hexCode: string }[] = [
    { id: 'classic', label: 'Celeste Clásico', desc: 'Tonos celestes del amanecer', colorClass: 'bg-cyan-500', hexCode: '#00e1d9' },
    { id: 'abyssal', label: 'Vacío Abisal', desc: 'Profundidades violeta del cosmos', colorClass: 'bg-purple-600', hexCode: '#8b5cf6' },
    { id: 'solstice', label: 'Solsticio Áureo', desc: 'Fuego dorado de estrellas masivas', colorClass: 'bg-amber-500', hexCode: '#f59e0b' },
    { id: 'primeval', label: 'Carmesí Ancestral', desc: 'Fuerza vital de nebulosas rojas', colorClass: 'bg-red-500', hexCode: '#ef4444' },
  ];

  const handleSave = async () => {
    setSaving(true);
    const updatedAvatar: AvatarCustomization = {
      ...currentAvatar,
      name: name || 'Nitz de Origen',
      accessory,
      clothing,
      colorTheme,
    };

    const newProgress: PlayerProgress = {
      ...progress,
      avatar: updatedAvatar,
      activeNitzName: updatedAvatar.name // keep synced
    };

    onSaveProgress(newProgress);

    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      try {
        await updateDoc(userRef, {
          avatar: updatedAvatar,
          activeNitzName: updatedAvatar.name
        });
      } catch (err) {
        console.error("Error updating avatar in Firestore:", err);
      }
    }

    setSaving(false);
    onClose();
  };

  return (
    <div className="w-full max-w-4xl bg-[#090b11]/90 border border-cyan-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col md:flex-row h-[85vh] text-white">
      {/* Visual Preview Side (Left) */}
      <div className="w-full md:w-1/3 bg-[#0d111b]/80 border-b md:border-b-0 md:border-r border-cyan-500/20 p-6 flex flex-col items-center justify-between relative overflow-hidden">
        {/* Glow grid back */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="text-center z-10 w-full">
          <span className="text-cyan-400 text-xs font-mono font-bold tracking-widest uppercase">Vista del Avatar</span>
          <h3 className="text-xl font-bold font-headline-md mt-1 truncate">{name || 'Sin Nombre'}</h3>
        </div>

        {/* Conceptual Avatar Visual representation in UI */}
        <div className="w-48 h-48 my-8 flex items-center justify-center relative z-10">
          <div className="absolute inset-0 bg-cyan-500/5 rounded-full blur-xl border border-cyan-500/10 animate-pulse" />
          
          {/* Simple clean stylized 2D avatar representation using pure Tailwind */}
          <div className="relative flex flex-col items-center">
            {/* Accessory layer */}
            {accessory === 'halo' && (
              <div className="w-16 h-3 border-2 border-yellow-400 rounded-full animate-bounce shadow-[0_0_10px_#facc15] -mb-2" />
            )}
            {accessory === 'horn_gold' && (
              <div className="flex gap-8 -mb-3 z-10">
                <div className="w-3 h-5 bg-amber-400 rounded-tl-full transform -rotate-12" />
                <div className="w-3 h-5 bg-amber-400 rounded-tr-full transform rotate-12" />
              </div>
            )}
            {accessory === 'ribbon' && (
              <div className="w-6 h-4 bg-pink-500 rounded-full flex items-center justify-center -mb-2 z-10 font-bold text-[8px]">🎀</div>
            )}

            {/* Head */}
            <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center relative shadow-lg">
              {/* Face Details */}
              <div className="flex gap-4">
                {/* Glowing Eyes based on colorTheme */}
                <div 
                  className="w-3.5 h-3.5 rounded-full animate-pulse shadow-[0_0_8px_currentColor]"
                  style={{ color: colorThemesList.find(t => t.id === colorTheme)?.hexCode || '#00e1d9', backgroundColor: 'currentColor' }}
                />
                <div 
                  className="w-3.5 h-3.5 rounded-full animate-pulse shadow-[0_0_8px_currentColor]"
                  style={{ color: colorThemesList.find(t => t.id === colorTheme)?.hexCode || '#00e1d9', backgroundColor: 'currentColor' }}
                />
              </div>
            </div>

            {/* Neck Scarf */}
            {accessory === 'scarf_cozy' && (
              <div className="w-12 h-3 bg-red-600 rounded-full z-10 -mt-1 shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
            )}

            {/* Body */}
            <div 
              className={`w-14 h-20 rounded-t-xl mt-1 border border-white/10 flex flex-col justify-end p-1 relative shadow-inner`}
              style={{ backgroundColor: colorThemesList.find(t => t.id === colorTheme)?.hexCode + '33' || 'rgba(0,225,217,0.2)' }}
            >
              {/* Clothing style */}
              {clothing === 'shawl' && (
                <div className="absolute inset-x-0 top-0 h-6 bg-red-500/80 rounded-t-xl border-b border-red-400/20" />
              )}
              {clothing === 'armor_shard' && (
                <div className="absolute inset-x-2 top-2 bottom-2 bg-slate-600 border border-slate-400 rounded flex flex-col gap-1 p-0.5 justify-around">
                  <div className="h-1 bg-slate-500 rounded-sm" />
                  <div className="h-1 bg-slate-500 rounded-sm" />
                  <div className="h-1 bg-slate-500 rounded-sm" />
                </div>
              )}
              {clothing === 'robe_sage' && (
                <div className="absolute inset-0 bg-indigo-900/90 rounded-t-xl border-t border-indigo-400/30 flex justify-center">
                  <div className="w-1 h-full bg-yellow-500/50" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full space-y-4 z-10">
          <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Tema Cosmético:</span>
              <span className="font-bold text-white capitalize">{colorTheme}</span>
            </div>
            <div className="flex justify-between">
              <span>Accesorio:</span>
              <span className="font-bold text-white capitalize">{accessory === 'none' ? 'Ninguno' : accessory.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span>Ropaje:</span>
              <span className="font-bold text-white capitalize">{clothing === 'none' ? 'Ninguno' : clothing.replace('_', ' ')}</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 px-4 rounded-xl transition duration-200 border border-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2"
          >
            {saving ? 'Guardando...' : 'Aplicar y Guardar'}
          </button>
        </div>
      </div>

      {/* Options Selection Panel (Right) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold font-headline-md tracking-wider text-cyan-400">ESPEJO DE APARIENCIA CÓSMICA</h2>
              <p className="text-gray-400 text-xs mt-0.5">Personaliza el diseño, accesorios y ropajes de tu avatar de origen.</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section 1: Name */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Nombre de tu Criatura Nitz
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombra tu avatar..."
              className="w-full bg-black/40 border border-cyan-500/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/60 transition duration-200 font-bold"
              maxLength={20}
            />
          </div>

          {/* Section 2: Color Theme */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase flex items-center gap-2">
              <Palette className="w-4 h-4" /> Tema Elemental Estelar
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {colorThemesList.map(theme => (
                <div
                  key={theme.id}
                  onClick={() => setColorTheme(theme.id)}
                  className={`border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all duration-200 hover:bg-white/5 ${
                    colorTheme === theme.id 
                      ? 'border-cyan-400/60 bg-cyan-950/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]' 
                      : 'border-white/5 bg-black/30'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full ${theme.colorClass} border border-white/20 shrink-0 shadow-[0_0_10px_rgba(255,255,255,0.15)]`} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate flex items-center gap-1.5">
                      {theme.label}
                      {colorTheme === theme.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">{theme.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Accessories */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Accesorio de Cabeza
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accessoriesList.map(acc => (
                <div
                  key={acc.id}
                  onClick={() => setAccessory(acc.id)}
                  className={`border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all duration-200 hover:bg-white/5 ${
                    accessory === acc.id 
                      ? 'border-cyan-400/60 bg-cyan-950/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]' 
                      : 'border-white/5 bg-black/30'
                  }`}
                >
                  <span className="text-2xl shrink-0">{acc.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate flex items-center gap-1.5">
                      {acc.label}
                      {accessory === acc.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">{acc.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Clothing */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase flex items-center gap-2">
              <Shirt className="w-4 h-4" /> Ropajes y Armadura Corporal
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {clothingList.map(cloth => (
                <div
                  key={cloth.id}
                  onClick={() => setClothing(cloth.id)}
                  className={`border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all duration-200 hover:bg-white/5 ${
                    clothing === cloth.id 
                      ? 'border-cyan-400/60 bg-cyan-950/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]' 
                      : 'border-white/5 bg-black/30'
                  }`}
                >
                  <span className="text-2xl shrink-0">{cloth.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate flex items-center gap-1.5">
                      {cloth.label}
                      {clothing === cloth.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">{cloth.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-[11px] text-gray-500 flex items-start gap-1.5 bg-black/20 border border-white/5 rounded-xl p-3.5 mt-4">
          <ShieldAlert className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <span>Al presionar "Aplicar y Guardar", tu apariencia se guardará en la nube y se reflejará en tiempo real para todos los guardianes que explores en el vecindario y mapas de combate.</span>
        </div>
      </div>
    </div>
  );
}
