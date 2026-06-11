import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, ShieldAlert, Shield, Axe, AxeIcon, Flame, Heart, Sparkles, Sword, Play, Ghost, Skull, RefreshCw, AlertCircle, ShoppingBag, Coins } from 'lucide-react';
import { PlayerProgress, GatheringInventory, CraftableItem } from '../types';

interface MundoAbiertoProps {
  progress: PlayerProgress;
  onSaveProgress: (newProg: PlayerProgress) => void;
}

type ModeZone = 'safe_wood' | 'yellow_quarry' | 'red_pvp';

interface NodeItem {
  id: string;
  name: string;
  type: 'wood' | 'stone' | 'metal' | 'essence';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  clicksRequired: number;
  clicksCurrent: number;
}

interface PvPCombatant {
  name: string;
  maxHp: number;
  hp: number;
  attackPower: number;
  shieldChance: number;
}

export const MundoAbierto: React.FC<MundoAbiertoProps> = ({ progress, onSaveProgress }) => {
  const [activeZone, setActiveZone] = useState<ModeZone>('safe_wood');
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [tempBag, setTempBag] = useState<GatheringInventory>({
    wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
    stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
    metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
    essence: { common: 0, rare: 0, epic: 0, legendary: 0 }
  });

  const [activeHarvestNode, setActiveHarvestNode] = useState<NodeItem | null>(null);
  
  // PVP Combat state
  const [combatState, setCombatState] = useState<{
    inCombat: boolean;
    playerHp: number;
    playerMaxHp: number;
    playerShield: number;
    playerMaxShield: number;
    enemy: PvPCombatant;
    combatLog: string[];
    turn: 'player' | 'enemy';
  } | null>(null);

  const [simulatedAuraMsgs, setSimulatedAuraMsgs] = useState<string>('Explorando los campos sintonizados...');

  // Gear modifiers calculations
  const getWeaponBonus = (): { percent: number; name: string } => {
    const weapon = progress.craftedItems.find(item => item.type === 'equipment' && item.subType === 'weapon' && item.equipped);
    if (!weapon) return { percent: 0, name: 'Espada de Madera' };
    if (weapon.rarity === 'common') return { percent: 5, name: weapon.name };
    if (weapon.rarity === 'rare') return { percent: 15, name: weapon.name };
    if (weapon.rarity === 'epic') return { percent: 30, name: weapon.name };
    if (weapon.rarity === 'legendary') return { percent: 65, name: weapon.name };
    return { percent: 0, name: 'Arma Común' };
  };

  const getShieldBonus = (): { amount: number; name: string } => {
    const shield = progress.craftedItems.find(item => item.type === 'equipment' && item.subType === 'shield' && item.equipped);
    if (!shield) return { amount: 0, name: 'Ninguno' };
    if (shield.rarity === 'common') return { amount: 15, name: shield.name };
    if (shield.rarity === 'rare') return { amount: 40, name: shield.name };
    if (shield.rarity === 'epic') return { amount: 75, name: shield.name };
    if (shield.rarity === 'legendary') return { amount: 120, name: shield.name };
    return { amount: 0, name: 'Escudo Básico' };
  };

  const getArmorBonus = (): { reduction: number; name: string } => {
    const armor = progress.craftedItems.find(item => item.type === 'equipment' && item.subType === 'armor' && item.equipped);
    if (!armor) return { reduction: 0, name: 'Ropa Simple' };
    if (armor.rarity === 'common') return { reduction: 10, name: armor.name };
    if (armor.rarity === 'rare') return { reduction: 20, name: armor.name };
    if (armor.rarity === 'epic') return { reduction: 30, name: armor.name };
    if (armor.rarity === 'legendary') return { reduction: 40, name: armor.name };
    return { reduction: 0, name: 'Cota Ligera' };
  };

  const currentWeapon = getWeaponBonus();
  const currentShield = getShieldBonus();
  const currentArmor = getArmorBonus();

  // Load and refresh Nodes for a zone
  useEffect(() => {
    generateResourcesForZone(activeZone);
    
    // Simulate ambient chats in open world: Albion style
    const phrases = [
      '¡Guardián_Luz ha recolectado Aura Wood Legendario hace poco!',
      'Ten cuidado en la Zona Roja de Bruma, el clan acechador ronda buscando loot.',
      'Siento que el Metal Celestial rutila fuertemente al sur.',
      'Asegúrate de regresar a puerto o cabaña para salvaguardar tu mochila en el almacén.'
    ];
    setSimulatedAuraMsgs(phrases[Math.floor(Math.random() * phrases.length)]);
  }, [activeZone]);

  const generateResourcesForZone = (zone: ModeZone) => {
    setActiveHarvestNode(null);
    let newNodes: NodeItem[] = [];
    if (zone === 'safe_wood') {
      newNodes = [
        { id: 'sw1', name: 'Arbusto Centelleante Común', type: 'wood', rarity: 'common', clicksRequired: 3, clicksCurrent: 0 },
        { id: 'sw2', name: 'Roble Ancestral de Aura', type: 'wood', rarity: 'rare', clicksRequired: 6, clicksCurrent: 0 },
        { id: 'sw3', name: 'Esencia de Bosque Resplandeciente', type: 'essence', rarity: 'common', clicksRequired: 4, clicksCurrent: 0 },
        { id: 'sw4', name: 'Orquídea Astral', type: 'essence', rarity: 'rare', clicksRequired: 8, clicksCurrent: 0 }
      ];
    } else if (zone === 'yellow_quarry') {
      newNodes = [
        { id: 'yq1', name: 'Fisura de Piedra Celestial', type: 'stone', rarity: 'common', clicksRequired: 4, clicksCurrent: 0 },
        { id: 'yq2', name: 'Losa Estelar Rutilante', type: 'stone', rarity: 'epic', clicksRequired: 10, clicksCurrent: 0 },
        { id: 'yq3', name: 'Beta de Vena Metálica', type: 'metal', rarity: 'rare', clicksRequired: 8, clicksCurrent: 0 },
        { id: 'yq4', name: 'Esencia de Falla Cósmica', type: 'essence', rarity: 'epic', clicksRequired: 12, clicksCurrent: 0 }
      ];
    } else { // RED PVP
      newNodes = [
        { id: 'rp1', name: 'Tronco Corrupto de Bruma', type: 'wood', rarity: 'epic', clicksRequired: 12, clicksCurrent: 0 },
        { id: 'rp2', name: 'Estatua del Alba Legendaria', type: 'stone', rarity: 'legendary', clicksRequired: 20, clicksCurrent: 0 },
        { id: 'rp3', name: 'Hierro del Abismo Destructor', type: 'metal', rarity: 'legendary', clicksRequired: 18, clicksCurrent: 0 },
        { id: 'rp4', name: 'Neblina Astral de Caos', type: 'essence', rarity: 'legendary', clicksRequired: 22, clicksCurrent: 0 }
      ];
    }
    setNodes(newNodes);
  };

  const handleInteractNode = (node: NodeItem) => {
    if (combatState?.inCombat) return;
    setActiveHarvestNode(node);

    // Minor audio feedback
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, audioCtx.currentTime); // Mi
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch (_) {}

    // Albion Danger Roll in PVP RED zone
    if (activeZone === 'red_pvp' && Math.random() < 0.33) {
      triggerPvPAmbush();
      return;
    }

    setNodes(prev => prev.map(n => {
      if (n.id === node.id) {
        const nextClicks = n.clicksCurrent + 1;
        if (nextClicks >= n.clicksRequired) {
          // Add reward to temporary local bag
          setTempBag(tb => {
            const nextBag = { ...tb };
            nextBag[n.type][n.rarity] += Math.floor(Math.random() * 2) + 1;
            return nextBag;
          });
          // Reward experience
          const expAward = n.rarity === 'common' ? 4 : n.rarity === 'rare' ? 10 : n.rarity === 'epic' ? 22 : 45;
          const nextProg = { ...progress, exp: progress.exp + expAward };
          onSaveProgress(nextProg);
          
          setActiveHarvestNode(null);
          // Auto regenerate node
          return { ...n, clicksCurrent: 0 };
        }
        return { ...n, clicksCurrent: nextClicks };
      }
      return n;
    }));
  };

  // Safe Backing: Secures resources from TempBag into permanent Inventory
  const handleBankResources = () => {
    // Merge tempBag into progress.inventory
    const nextInventory = JSON.parse(JSON.stringify(progress.inventory)) as GatheringInventory;
    let countTransferred = 0;
    
    const mats = ['wood', 'stone', 'metal', 'essence'] as const;
    const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
    
    mats.forEach(m => {
      rarities.forEach(r => {
        const amount = tempBag[m][r];
        if (amount > 0) {
          nextInventory[m][r] += amount;
          countTransferred += amount;
        }
      });
    });

    if (countTransferred === 0) return;

    const nextProg: PlayerProgress = {
      ...progress,
      inventory: nextInventory,
      gold: progress.gold + Math.floor(countTransferred * 1.5) // Bonus gold for shipping!
    };

    onSaveProgress(nextProg);

    // Reset temporary bag
    setTempBag({
      wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
      stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
      metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
      essence: { common: 0, rare: 0, epic: 0, legendary: 0 }
    });

    // Ambient audio chime
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.52);
    } catch (_) {}
  };

  // Hostile ambushes in PVP Zone
  const triggerPvPAmbush = () => {
    const enemies = [
      { name: 'Acechador_Sombrío_PVP', maxHp: 100, hp: 100, attackPower: 14, shieldChance: 15 },
      { name: 'Bruto_Rojo_FullLoot', maxHp: 130, hp: 130, attackPower: 18, shieldChance: 5 },
      { name: 'LootGrizzly_99', maxHp: 110, hp: 110, attackPower: 15, shieldChance: 25 },
    ];
    const picked = enemies[Math.floor(Math.random() * enemies.length)];
    
    const pShield = currentShield.amount;
    const pMaxHp = 100 + (progress.phase * 15);

    setCombatState({
      inCombat: true,
      playerHp: pMaxHp,
      playerMaxHp: pMaxHp,
      playerShield: pShield,
      playerMaxShield: pShield,
      enemy: picked,
      combatLog: [`¡EMBOSCADA EN ZONA PVP ROJA! El jugador hostil ${picked.name} te ha bloqueado el paso.`],
      turn: 'player'
    });
    setActiveHarvestNode(null);

    // Tension noise
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.62);
    } catch (_) {}
  };

  // COMBAT ACTIONS
  const playPlayerAttack = () => {
    if (!combatState || combatState.turn !== 'player') return;

    // Calc power
    const rawAttack = 15 + Math.floor(progress.phase * 3);
    const weaponMultiplier = 1 + (currentWeapon.percent / 100);
    const dmg = Math.floor(rawAttack * weaponMultiplier);

    const nextEnemyHp = Math.max(0, combatState.enemy.hp - dmg);
    
    const log = [...combatState.combatLog];
    log.push(`Lanzas Destello Astral usando ${currentWeapon.name} e infliges ${dmg} de daño real continuo.`);

    if (nextEnemyHp <= 0) {
      // Victory: Defeated the rival! Keep raw inventory, gain bonus gold
      const goldReward = Math.floor(Math.random() * 80) + 60;
      const nextProg = { 
        ...progress, 
        gold: progress.gold + goldReward,
        exp: progress.exp + 100
      };
      onSaveProgress(nextProg);

      log.push(`¡FANTÁSTICO! Derrotaste a ${combatState.enemy.name}. Has protegido tu botín y ganado +${goldReward}g y +100 EXP.`);
      setCombatState(prev => prev ? {
        ...prev,
        enemy: { ...prev.enemy, hp: 0 },
        combatLog: log,
        turn: 'player' // stays done
      } : null);

      // Settle combat after 3 seconds
      setTimeout(() => {
        setCombatState(null);
      }, 3500);

    } else {
      setCombatState(prev => prev ? {
        ...prev,
        enemy: { ...prev.enemy, hp: nextEnemyHp },
        combatLog: log,
        turn: 'enemy'
      } : null);

      // Schedule enemy response
      setTimeout(() => {
        playEnemyTurn();
      }, 1500);
    }
  };

  const playPlayerShieldBoost = () => {
    if (!combatState || combatState.turn !== 'player') return;

    const shieldAdd = 20 + Math.floor(progress.phase * 5);
    const nextShield = Math.min(combatState.playerMaxShield, combatState.playerShield + shieldAdd);
    
    const log = [...combatState.combatLog];
    log.push(`Canalizas Confianza y reparas tu escudo rúnico (+${shieldAdd} Protección).`);

    setCombatState(prev => prev ? {
      ...prev,
      playerShield: nextShield,
      combatLog: log,
      turn: 'enemy'
    } : null);

    setTimeout(() => {
      playEnemyTurn();
    }, 1500);
  };

  const playEnemyTurn = () => {
    setCombatState(prev => {
      if (!prev) return null;

      const log = [...prev.combatLog];
      
      // Calculate rival attack applying armor reduction
      const rawEnemyDmg = prev.enemy.attackPower;
      const armorReduction = 1 - (currentArmor.reduction / 100);
      const calculatedDmg = Math.max(3, Math.floor(rawEnemyDmg * armorReduction));

      let nextShield = prev.playerShield;
      let nextHp = prev.playerHp;

      if (nextShield > 0) {
        if (nextShield >= calculatedDmg) {
          nextShield -= calculatedDmg;
          log.push(`Rival ${prev.enemy.name} arremete contra tu escudo, absorbiendo ${calculatedDmg} de potencia.`);
        } else {
          const bleedingDmg = calculatedDmg - nextShield;
          nextShield = 0;
          nextHp = Math.max(0, nextHp - bleedingDmg);
          log.push(`Rival ${prev.enemy.name} pulveriza tu escudo restante y te inflige ${bleedingDmg} de daño directo.`);
        }
      } else {
        nextHp = Math.max(0, nextHp - calculatedDmg);
        log.push(`Rival ${prev.enemy.name} rasga tus escamas directamente haciéndote ${calculatedDmg} de daño.`);
      }

      if (nextHp <= 0) {
        // PLAYER DEFEAT: CRITICAL FULL LOOT LOST!
        let lostStrList: string[] = [];
        const mats = ['wood', 'stone', 'metal', 'essence'] as const;
        const rarities = ['common', 'rare', 'epic', 'legendary'] as const;

        mats.forEach(m => {
          rarities.forEach(r => {
            const amount = tempBag[m][r];
            if (amount > 0) lostStrList.push(`${amount}x ${m} (${r})`);
          });
        });

        const lostSummary = lostStrList.length > 0 ? lostStrList.join(', ') : 'Ninguno (mochila vacía)';

        log.push(`¡HAS SIDO CAÍDO EN COMBATE PVP! Se rompieron tus escamas sentimentales. El contrincante saqueó toda tu mochila temporal: ${lostSummary}`);
        
        // Reset local temp bag
        setTempBag({
          wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
          stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
          metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
          essence: { common: 0, rare: 0, epic: 0, legendary: 0 }
        });

        // End combat showing failure
        setTimeout(() => {
          setCombatState(null);
        }, 4500);

        return {
          ...prev,
          playerHp: 0,
          playerShield: 0,
          combatLog: log,
          turn: 'player'
        };
      }

      return {
        ...prev,
        playerHp: nextHp,
        playerShield: nextShield,
        combatLog: log,
        turn: 'player'
      };
    });
  };

  const hasItemsInTempBag = (): boolean => {
    const mats = ['wood', 'stone', 'metal', 'essence'] as const;
    const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
    let found = false;
    mats.forEach(m => {
      rarities.forEach(r => {
        if (tempBag[m][r] > 0) found = true;
      });
    });
    return found;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">

      {/* Map Header details */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-4 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-headline-lg text-white flex items-center gap-2">
            <Compass className="w-6 h-6 text-[#dec1ac] animate-spin" style={{ animationDuration: '30s' }} />
            Mundo Abierto de Evolutia: Tierras de Recolección
          </h1>
          <p className="text-xs text-[#919097] uppercase tracking-wider">Cosecha y defiende tus recursos valiosos frente a acechadores en zonas de pérdida total.</p>
        </div>

        {/* Temporary Bag HUD */}
        <div className="bg-[#121424] border border-white/10 p-3 rounded-xl flex items-center justify-between gap-5 shadow-inner w-full md:w-auto">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#dec1ac]/10 text-tertiary rounded">
              <ShoppingBag className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider block text-tertiary font-mono">Mochila Temporal</span>
              <span className="text-xs font-bold text-white font-mono">
                {hasItemsInTempBag() ? '¡Contiene Recursos!' : 'Vacía'}
              </span>
            </div>
          </div>
          <button 
            onClick={handleBankResources}
            disabled={!hasItemsInTempBag()}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              hasItemsInTempBag() 
                ? 'bg-[#dec1ac] text-black hover:bg-white active:scale-95 cursor-pointer shadow' 
                : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
            }`}
          >
            Asegurar en Almacén (+Oro)
          </button>
        </div>
      </div>

      {/* Active Equip Banner */}
      <div className="bg-[#17192f]/60 border border-white/5 p-3 rounded-lg text-xs grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
        <div className="flex items-center gap-2">
          <Sword className="w-4 h-4 text-red-400" />
          <span>Fuerza: <strong className="text-white">{currentWeapon.name} ({currentWeapon.percent > 0 ? `+${currentWeapon.percent}%` : 'Básico'})</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-yellow-400" />
          <span>Protección: <strong className="text-white">{currentShield.name} ({currentShield.amount > 0 ? `+${currentShield.amount} Escudo` : 'Ninguno'})</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-purple-400" />
          <span>Defensa: <strong className="text-white">{currentArmor.name} ({currentArmor.reduction > 0 ? `-${currentArmor.reduction}% Daño` : 'Ninguno'})</strong></span>
        </div>
      </div>

      {/* THREE ZONE TABS */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => { if (!combatState?.inCombat) setActiveZone('safe_wood'); }}
          disabled={combatState?.inCombat}
          className={`p-3 text-center rounded-lg border text-xs font-bold transition-all uppercase tracking-wider ${
            activeZone === 'safe_wood' 
              ? 'bg-[#dec1ac]/15 border-emerald-500 text-emerald-400 shadow-lg font-bold' 
              : 'bg-[#121424] border-white/5 text-[#919097] hover:text-white'
          }`}
        >
          🌲 Arboleda Segura (Bosque)
        </button>
        <button
          onClick={() => { if (!combatState?.inCombat) setActiveZone('yellow_quarry'); }}
          disabled={combatState?.inCombat}
          className={`p-3 text-center rounded-lg border text-xs font-bold transition-all uppercase tracking-wider ${
            activeZone === 'yellow_quarry' 
              ? 'bg-[#dec1ac]/15 border-yellow-500 text-yellow-400 shadow-lg font-bold' 
              : 'bg-[#121424] border-white/5 text-[#919097] hover:text-white'
          }`}
        >
          ⛰️ Mina Celestial (Rara)
        </button>
        <button
          onClick={() => { if (!combatState?.inCombat) setActiveZone('red_pvp'); }}
          disabled={combatState?.inCombat}
          className={`p-3 text-center rounded-lg border text-xs font-bold transition-all uppercase tracking-wider ${
            activeZone === 'red_pvp' 
              ? 'bg-deep-orange-950/20 border-red-500 text-red-500 shadow-lg font-bold' 
              : 'bg-[#121424] border-white/5 text-[#919097] hover:text-white'
          }`}
        >
          🔥 Brumas de Caos (PVP FULL LOOT!)
        </button>
      </div>

      {/* INTERACTIVE PLAYGROUND BOX */}
      <div className="relative min-h-[440px] bg-gradient-to-b from-[#111326] to-[#04050d] border border-white/10 rounded-xl shadow-2xl p-6 overflow-hidden flex flex-col justify-between">
        
        {/* HOLOGRAPHIC AMBIENCE */}
        <div className="absolute inset-0 bg-[#dec1ac]/5 blur-[90px] pointer-events-none" />

        {/* COMBAT VIEW (Ambushed!) */}
        <AnimatePresence>
          {combatState?.inCombat && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 bg-black/90 z-20 p-6 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between border-b border-red-950/40 pb-3">
                <div className="flex items-center gap-2 text-red-400">
                  <ShieldAlert className="w-5 h-5 animate-pulse text-red-500" />
                  <span className="text-sm font-bold uppercase tracking-wider">¡COMBATE ACTIVO EN ZONA DE PÉRDIDA DE BOTÍN!</span>
                </div>
                <div className="text-[10px] bg-red-950/30 text-red-500 border border-red-900/40 px-2 py-0.5 rounded font-mono">
                  RIESGO: MÁXIMO (Rapiña por oponentes)
                </div>
              </div>

              {/* Combat Field Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 my-4 items-center overflow-y-auto max-h-[260px] custom-scrollbar p-1">
                
                {/* Left Side: Player Guardian */}
                <div className="bg-[#15172b]/80 border border-[#dec1ac]/20 p-4 rounded-xl space-y-3 shadow-lg">
                  <div className="flex justify-between items-center">
                    <h5 className="text-xs font-bold text-white uppercase">{progress.username || 'Tu Guardián'}</h5>
                    <span className="text-[9px] font-mono text-tertiary">Fase {progress.phase}</span>
                  </div>
                  
                  {/* Health Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-red-400 flex items-center gap-1"><Heart className="w-3 h-3" /> Salud:</span>
                      <strong>{combatState.playerHp} / {combatState.playerMaxHp}</strong>
                    </div>
                    <div className="w-full bg-[#1e2030] h-2 rounded overflow-hidden">
                      <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${(combatState.playerHp / combatState.playerMaxHp) * 100}%` }} />
                    </div>
                  </div>

                  {/* Shield Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-yellow-400 flex items-center gap-1"><Shield className="w-3 h-3" /> Escudo Místico:</span>
                      <strong>{combatState.playerShield} / {combatState.playerMaxShield}</strong>
                    </div>
                    <div className="w-full bg-[#1e2030] h-2 rounded overflow-hidden">
                      <div className="bg-yellow-500 h-full transition-all duration-300" style={{ width: combatState.playerMaxShield > 0 ? `${(combatState.playerShield / combatState.playerMaxShield) * 100}%` : '0%' }} />
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 italic">Equipado: {currentWeapon.name} &bull; {currentShield.name}</p>
                </div>

                {/* Right Side: Hostile Player Rogue */}
                <div className="bg-[#1f161b]/80 border border-red-500/20 p-4 rounded-xl space-y-3 shadow-lg">
                  <div className="flex justify-between items-center">
                    <h5 className="text-xs font-bold text-red-400 uppercase">{combatState.enemy.name}</h5>
                    <span className="text-[10px] bg-red-950/50 text-red-400 px-2 rounded-full border border-red-900/30">RIVAL HOSTIL</span>
                  </div>

                  {/* Health Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-red-400 flex items-center gap-1"><Heart className="w-3 h-3" /> Salud Enemiga:</span>
                      <strong>{combatState.enemy.hp} / {combatState.enemy.maxHp}</strong>
                    </div>
                    <div className="w-full bg-[#1e2030] h-2 rounded overflow-hidden">
                      <div className="bg-red-600 h-full transition-all duration-300" style={{ width: `${(combatState.enemy.hp / combatState.enemy.maxHp) * 100}%` }} />
                    </div>
                  </div>

                  {/* Log panel */}
                  <div className="h-16 overflow-y-auto bg-black/50 p-2 rounded text-[9px] font-mono text-[#c4c5da] custom-scrollbar space-y-1">
                    {combatState.combatLog.slice(-3).map((line, idx) => (
                      <p key={idx} className="leading-tight">{line}</p>
                    ))}
                  </div>
                </div>

              </div>

              {/* Combat Actions Controls */}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={playPlayerAttack}
                  disabled={combatState.turn !== 'player' || combatState.playerHp <= 0 || combatState.enemy.hp <= 0}
                  className="flex-1 p-3.5 bg-red-500 hover:bg-red-400 text-white disabled:opacity-35 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Sword className="w-4 h-4" />
                  <span>DESTELLO DE COMBATE ({currentWeapon.name})</span>
                </button>
                <button
                  onClick={playPlayerShieldBoost}
                  disabled={combatState.turn !== 'player' || combatState.playerHp <= 0 || combatState.enemy.hp <= 0}
                  className="flex-1 p-3.5 bg-yellow-500 hover:bg-yellow-400 text-black disabled:opacity-35 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  <span>CONCENTRAR ESCUDO (+DEFENSA)</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD top showing current temporary stocks gathered */}
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-tertiary">Mundo Abierto</span>
            <h3 className="text-lg font-bold font-headline-lg text-white">
              {activeZone === 'safe_wood' ? 'Plano 1: Bosques de Frecuencias Primordiales' :
               activeZone === 'yellow_quarry' ? 'Plano 2: Falla de Cuarzo y Metales Celestiales' :
               'Plano 3: Tierras Rojas Desoladas (ZONA ROJA INVASIVA!)'}
            </h3>
          </div>
          <div className="flex gap-2 text-[10px] font-mono glass-panel bg-black/40 text-[#c4c5da] px-3 py-1.5 rounded-lg border border-white/5">
            <span className="text-green-400 animate-pulse">&bull; ONLINE</span>
            <span>6 Guardianes Cerca</span>
          </div>
        </div>

        {/* RENDERING ACTIVE GATHERING NODES */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 my-6 items-center">
          {nodes.map((node) => {
            const isHarvesting = activeHarvestNode?.id === node.id;
            const progressPercent = isHarvesting ? (node.clicksCurrent / node.clicksRequired) * 100 : 0;
            
            return (
              <div 
                key={node.id} 
                className={`p-4 bg-[#14162e]/70 border rounded-xl transition-all flex flex-col justify-between h-44 cursor-pointer hover:bg-[#1a1c35] ${
                  node.rarity === 'legendary' ? 'border-amber-500/30' :
                  node.rarity === 'epic' ? 'border-purple-500/30' :
                  node.rarity === 'rare' ? 'border-cyan-500/30' :
                  'border-white/5'
                }`}
                onClick={() => handleInteractNode(node)}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[9px] font-mono font-semibold uppercase px-2 py-0.5 rounded ${
                      node.rarity === 'legendary' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      node.rarity === 'epic' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      node.rarity === 'rare' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                      'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      {node.rarity}
                    </span>
                    {node.type === 'wood' && <Axe className="w-3.5 h-3.5 text-green-400" />}
                    {node.type === 'stone' && <Compass className="w-3.5 h-3.5 text-gray-400 animate-spin" style={{ animationDuration: '10s' }} />}
                    {node.type === 'metal' && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                    {node.type === 'essence' && <Flame className="w-3.5 h-3.5 text-purple-400 animate-pulse" />}
                  </div>
                  
                  <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">{node.name}</h4>
                </div>

                {/* Interact Progress bar */}
                <div className="space-y-1.5 mt-2">
                  <div className="flex justify-between text-[9px] font-mono text-[#919097]">
                    <span>Extrayendo:</span>
                    <span>{node.clicksCurrent} / {node.clicksRequired}</span>
                  </div>
                  <div className="w-full bg-[#0a0c16] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        node.rarity === 'legendary' ? 'bg-amber-400' :
                        node.rarity === 'epic' ? 'bg-purple-400' :
                        node.rarity === 'rare' ? 'bg-cyan-400' :
                        'bg-slate-400'
                      }`} 
                      style={{ width: `${(node.clicksCurrent / node.clicksRequired) * 100}%` }} 
                    />
                  </div>
                  <span className="text-[8px] tracking-wider text-center block text-tertiary opacity-80 uppercase">Hacer Click para Cosechar</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* SCREEN FOOTER CHATS */}
        <div className="relative z-10 text-xs text-[#919097] flex items-center justify-between bg-white/2 p-3 rounded border border-white/5 font-mono">
          <div className="flex items-center gap-2">
            <ShieldAlert className={`w-4 h-4 ${activeZone === 'red_pvp' ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`} />
            <span>{simulatedAuraMsgs}</span>
          </div>
          <button 
            onClick={() => generateResourcesForZone(activeZone)}
            className="text-[10px] text-tertiary flex items-center gap-1 hover:text-white transition-colors uppercase cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerar Nódulos
          </button>
        </div>

      </div>

    </div>
  );
};
