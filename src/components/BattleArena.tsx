import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, ShieldAlert, Sparkles, Zap, Flame, Shield, Heart, RotateCcw, ShoppingBag, Eye } from 'lucide-react';
import { PlayerProgress, CraftableItem, EmotionName } from '../types';
import { EMOTION_COLORS } from './NitzCanvas';

interface BattleArenaProps {
  progress: PlayerProgress;
  onSaveProgress: (newProg: PlayerProgress) => void;
  onDefeat?: () => void;
}

export const BattleArena: React.FC<BattleArenaProps> = ({ progress, onSaveProgress, onDefeat }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Equipments from progress
  const weapons = progress.craftedItems.filter(item => item.subType === 'weapon');
  const shields = progress.craftedItems.filter(item => item.subType === 'shield');
  const armors = progress.craftedItems.filter(item => item.subType === 'armor');

  // Active equipped items local copy or fallback
  const activeWeapon = progress.craftedItems.find(item => item.subType === 'weapon' && item.equipped) || weapons[0];
  const activeShield = progress.craftedItems.find(item => item.subType === 'shield' && item.equipped) || shields[0];
  const activeArmor = progress.craftedItems.find(item => item.subType === 'armor' && item.equipped) || armors[0];

  // Dynamic Statistics from Equips
  const getWeaponBonus = () => {
    if (!activeWeapon) return { dMult: 1.0, label: 'Puños Desnudos (+0%)' };
    if (activeWeapon.name.includes('Sable del Alba')) return { dMult: 1.75, label: `${activeWeapon.name} (+75% Daño)` };
    if (activeWeapon.name.includes('Mandoble')) return { dMult: 1.35, label: `${activeWeapon.name} (+35% Daño)` };
    return { dMult: 1.15, label: `${activeWeapon.name} (+15% Daño)` };
  };

  const getShieldBonus = () => {
    if (!activeShield) return { shieldCap: 0, label: 'Ninguno (+0)' };
    if (activeShield.name.includes('Estelares')) return { shieldCap: 75, label: `${activeShield.name} (+75 de Escudo Absorbente)` };
    return { shieldCap: 40, label: `${activeShield.name} (+40 de Escudo Absorbente)` };
  };

  const getArmorBonus = () => {
    if (!activeArmor) return { mitigation: 0.0, label: 'Ropaje Común (0% Mitigación)' };
    if (activeArmor.name.includes('Escamas')) return { mitigation: 0.40, label: `${activeArmor.name} (-40% Daño Recibido)` };
    return { mitigation: 0.15, label: `${activeArmor.name} (-15% Daño Recibido)` };
  };

  const currentWeaponAttr = getWeaponBonus();
  const currentShieldAttr = getShieldBonus();
  const currentArmorAttr = getArmorBonus();

  // State
  const [battleReport, setBattleReport] = useState<string[]>([]);
  const [isFighting, setIsFighting] = useState<boolean>(false);
  const [playerHp, setPlayerHp] = useState<number>(350 + progress.phase * 50);
  const [playerShield, setPlayerShield] = useState<number>(currentShieldAttr.shieldCap);
  const [enemyHp, setEnemyHp] = useState<number>(450);
  const [enemyMaxHp] = useState<number>(450);
  const [round, setRound] = useState<number>(1);
  const [battleOver, setBattleOver] = useState<boolean>(false);
  const [enemyBurnTicks, setEnemyBurnTicks] = useState<number>(0);
  const [playerMitigationActive, setPlayerMitigationActive] = useState<boolean>(false);
  const [victory, setVictory] = useState<boolean>(false);

  // FX animation states
  const [shakeAmount, setShakeAmount] = useState<number>(0);
  const [weaponAnimationState, setWeaponAnimationState] = useState<'idle' | 'swing' | 'cast'>('idle');
  const [activeFlashes, setActiveFlashes] = useState<{ x: number; y: number; text: string; color: string }[]>([]);
  const [enemyOffset, setEnemyOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Potion shop inside the arena
  const [activeTonic, setActiveTonic] = useState<boolean>(false); // double next attack

  // Nitz Companion Battle Stats
  const nitzMaxHp = 220 + progress.phase * 30;
  const [nitzHp, setNitzHp] = useState<number>(220 + progress.phase * 30);
  const [selectedOrder, setSelectedOrder] = useState<'none' | 'attack' | 'heal' | 'protect'>('none');
  const [nitzAnimationState, setNitzAnimationState] = useState<'idle' | 'charge' | 'support' | 'pain'>('idle');

  // Calculate dominant emotion
  const getDominant = (): EmotionName => {
    let maxName: EmotionName = 'Alegría';
    let maxValue = -1;
    (Object.keys(progress.emotions) as EmotionName[]).forEach((key) => {
      if (progress.emotions[key] > maxValue) {
        maxValue = progress.emotions[key];
        maxName = key;
      }
    });
    return maxName;
  };

  const currentDominant = getDominant();
  const playerColorHexStr = EMOTION_COLORS[currentDominant].toString(16).padStart(6, '0');

  // Trigger synth tones
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
    } catch(e) {}
  };

  // Potion purchase
  const handleBuyTonic = () => {
    if (progress.gold < 40) return;
    onSaveProgress({
      ...progress,
      gold: progress.gold - 40
    });
    setActiveTonic(true);
    triggerAudioTone(659.25, 'triangle', 0.6);
    setBattleReport(prev => [...prev, '🧪 Usaste un Tónico de Sentimiento Amplificado (-40g). ¡Tu próximo ataque infligirá 200% de daño!']);
  };

  // Switch equipment dynamically in battle arena
  const handleEquipItem = (itemId: string, subType: 'weapon' | 'shield' | 'armor') => {
    const updatedCrafted = progress.craftedItems.map(item => {
      if (item.subType === subType) {
        return { ...item, equipped: item.id === itemId };
      }
      return item;
    });

    onSaveProgress({
      ...progress,
      craftedItems: updatedCrafted
    });

    triggerAudioTone(330, 'sawtooth', 0.2);
    setBattleReport(prev => [...prev, `⚙️ Te has equipado un nuevo elemento táctico.`]);
  };

  // Action / Combat tactics (Joint player & Nitz Turn)
  const handleTactic = (tacticStyle: 'weapon' | 'shield' | 'armor') => {
    if (isFighting || battleOver) return;
    setIsFighting(true);

    const dmgMult = currentWeaponAttr.dMult;
    const isAmplified = activeTonic;
    if (isAmplified) {
      setActiveTonic(false);
    }

    const roundLogs: string[] = [`--- RONDA ${round} ---`];

    // ====== FASE 1: ATAQUE DEL JUGADOR ======
    let playerDmg = 0;
    let playerLog = '';

    if (tacticStyle === 'weapon') {
      setWeaponAnimationState('swing');
      const isLegendary = activeWeapon?.name.includes('Sable del Alba');
      const isEpic = activeWeapon?.name.includes('Mandoble');
      
      if (isLegendary) {
        playerDmg = Math.floor((65 + progress.phase * 15) * dmgMult * (isAmplified ? 2.0 : 1.0));
        setEnemyBurnTicks(2);
        playerLog = `⚔️ [IRA SOLAR]: Blandes Sable del Alba Legendario infligiendo ${playerDmg} de daño directo e impregnando quemadura solar (2 turnos).`;
        triggerAudioTone(660, 'sawtooth', 0.5);
        setActiveFlashes(prev => [...prev, { x: 360, y: 150, text: `-${playerDmg}!`, color: '#f59e0b' }]);
      } else if (isEpic) {
        playerDmg = Math.floor((50 + progress.phase * 12) * dmgMult * (isAmplified ? 2.0 : 1.0));
        playerLog = `⚔️ [TAJO SOMBRÍO]: Blandes Mandoble de Bruma Astral infligiendo ${playerDmg} de daño y desgarrando barreras del oponente.`;
        triggerAudioTone(440, 'triangle', 0.5);
        setActiveFlashes(prev => [...prev, { x: 360, y: 150, text: `-${playerDmg}!`, color: '#c084fc' }]);
      } else {
        playerDmg = Math.floor((38 + progress.phase * 8) * dmgMult * (isAmplified ? 2.0 : 1.0));
        playerLog = `⚔️ [CORTE RÁPIDO]: Blandes Espada de Novicio infligiendo ${playerDmg} de daño continuo.`;
        triggerAudioTone(220, 'sawtooth', 0.45);
        setActiveFlashes(prev => [...prev, { x: 360, y: 150, text: `-${playerDmg}!`, color: '#f87171' }]);
      }
      setEnemyOffset({ x: Math.random() * 20 - 10, y: -20 });
      setShakeAmount(10);
    } else if (tacticStyle === 'shield') {
      setWeaponAnimationState('cast');
      const isStarPlate = activeShield?.name.includes('Estelares');
      
      if (isStarPlate) {
        const shieldRegen = 60 + progress.phase * 8;
        setPlayerShield(prev => Math.min(currentShieldAttr.shieldCap, prev + shieldRegen));
        playerLog = `🛡️ [BARRERA RÚNICA]: Canalizas placas estelares y restauras +${shieldRegen} escudo protector.`;
        triggerAudioTone(523.25, 'sine', 0.6);
        setActiveFlashes(prev => [...prev, { x: 100, y: 220, text: `+${shieldRegen} Escudo!`, color: '#38bdf8' }]);
      } else {
        const shieldRegen = 30 + progress.phase * 4;
        setPlayerShield(prev => Math.min(Math.max(40, currentShieldAttr.shieldCap), prev + shieldRegen));
        playerLog = `🛡️ [GUARDIA SIMPLE]: Levantas tus brazos bloqueando y restaurando +${shieldRegen} de escudo básico.`;
        triggerAudioTone(330, 'sine', 0.4);
        setActiveFlashes(prev => [...prev, { x: 100, y: 220, text: `+${shieldRegen} Escudo!`, color: '#94a3b8' }]);
      }
      setShakeAmount(4);
    } else if (tacticStyle === 'armor') {
      setWeaponAnimationState('idle');
      const isScales = activeArmor?.name.includes('Escamas');
      const hpHeal = (isScales ? 45 : 25) + progress.phase * 6;
      setPlayerHp(prev => Math.min(350 + progress.phase * 50, prev + hpHeal));
      
      if (isScales) {
        setPlayerMitigationActive(true);
        playerLog = `🛡️ [ESCAMA SAGRADA]: Endureces tu Cota de Escamas Divinas, curándote +${hpHeal} HP y mitigando 50% de daño en el próximo turno.`;
        triggerAudioTone(783.99, 'sine', 0.8);
      } else {
        playerLog = `🛡️ [REFUGIO COMÚN]: Te resguardas curándote +${hpHeal} HP de forma pasiva.`;
        triggerAudioTone(330, 'sine', 0.8);
      }
      setActiveFlashes(prev => [...prev, { x: 100, y: 220, text: `+${hpHeal} HP!`, color: '#34d399' }]);
      setShakeAmount(2);
    }

    roundLogs.push(playerLog);

    // Burn check:
    let burnDmg = 0;
    if (enemyBurnTicks > 0) {
      burnDmg = 15;
      setEnemyBurnTicks(prev => prev - 1);
      roundLogs.push(`🔥 [QUEMADURA SOLAR]: El Nitz Korrumpido sufre ${burnDmg} de daño por fuego continuo.`);
    }

    let nextEnemyHp = Math.max(0, enemyHp - playerDmg - burnDmg);

    // ====== FASE 2: ACCIÓN DE TU NITZ (CON IA O CON ORDEN DIRECTA) ======
    if (nextEnemyHp > 0) {
      if (nitzHp <= 0) {
        roundLogs.push(`😴 Tu Companion Nitz está exhausto y fuera de combate, descansando en su refugio.`);
      } else {
        let nitzDmg = 0;
        let nitzHeal = 0;
        let nitzShield = 0;
        let nitzLog = '';

        if (selectedOrder !== 'none') {
          // Obedecer orden directa del jugador
          if (selectedOrder === 'attack') {
            setNitzAnimationState('charge');
            nitzDmg = Math.floor((36 + progress.phase * 10) * (isAmplified ? 1.5 : 1.0));
            nitzLog = `🐾 [ORDEN: ¡AL ATAQUE!]: Tu Nitz muerde con rabia estelar al Nitz Korrumpido por ${nitzDmg} de daño físico!`;
            triggerAudioTone(293.66, 'triangle', 0.45);
            setActiveFlashes(prev => [...prev, { x: 360, y: 170, text: `-${nitzDmg} Nitz!`, color: '#fca5a5' }]);
          } else if (selectedOrder === 'heal') {
            setNitzAnimationState('support');
            nitzHeal = 45 + progress.phase * 6;
            setPlayerHp(prev => Math.min(prev + nitzHeal, 350 + progress.phase * 50));
            setNitzHp(prev => Math.min(prev + 25, nitzMaxHp));
            nitzLog = `🐾 [ORDEN: ¡CÚRAME!]: Tu Nitz obedece fielmente y sopla Bruma Astral, curándote +${nitzHeal} HP y sanando +25 HP de sí mismo.`;
            triggerAudioTone(523.25, 'sine', 0.8);
            setActiveFlashes(prev => [...prev, { x: 120, y: 190, text: `+${nitzHeal} Nitz!`, color: '#4ade80' }]);
          } else if (selectedOrder === 'protect') {
            setNitzAnimationState('support');
            nitzShield = 55 + progress.phase * 4;
            setPlayerShield(prev => Math.min(prev + nitzShield, Math.max(120, currentShieldAttr.shieldCap)));
            nitzLog = `🐾 [ORDEN: ¡PROTEGER!]: Tu Nitz se infla grandemente cubriéndote con una barrera astral de +${nitzShield} escudo y atrayendo la atención enemiga.`;
            triggerAudioTone(392, 'sine', 0.6);
            setActiveFlashes(prev => [...prev, { x: 140, y: 240, text: `+${nitzShield} Escudo!`, color: '#22d3ee' }]);
          }
        } else {
          // IA Autónoma basada en emoción dominante!
          const emotionMood = currentDominant;
          if (emotionMood === 'Ira' || emotionMood === 'Orgullo' || emotionMood === 'Miedo') {
            setNitzAnimationState('charge');
            nitzDmg = Math.floor(28 + progress.phase * 6);
            nitzLog = `🤖 [IA COMPAÑERA] (Personalidad Agresiva, Motivado por ${emotionMood}): Tu Nitz muerde ferozmente por su propia voluntad infligiendo ${nitzDmg} de daño!`;
            triggerAudioTone(261.63, 'triangle', 0.4);
            setActiveFlashes(prev => [...prev, { x: 340, y: 160, text: `-${nitzDmg}!`, color: '#f87171' }]);
          } else if (emotionMood === 'Amor' || emotionMood === 'Serenidad' || emotionMood === 'Alegría') {
            setNitzAnimationState('support');
            nitzHeal = 25 + progress.phase * 5;
            setPlayerHp(prev => Math.min(prev + nitzHeal, 350 + progress.phase * 50));
            nitzLog = `🤖 [IA COMPAñERA] (Personalidad Defensora, Motivado por ${emotionMood}): Tu Nitz brilla cálidamente y restaura automáticamente +${nitzHeal} HP a tu salud!`;
            triggerAudioTone(493.88, 'sine', 0.7);
            setActiveFlashes(prev => [...prev, { x: 110, y: 200, text: `+${nitzHeal} HP!`, color: '#10b981' }]);
          } else {
            // Confianza, Sorpresa, Tristeza
            setNitzAnimationState('support');
            nitzDmg = 15 + progress.phase * 4;
            nitzLog = `🤖 [IA COMPAÑERA] (Personalidad de Apoyo, Motivado por ${emotionMood}): Tu Nitz místico desconcierta con Destello Estelar, infligiendo ${nitzDmg} de daño y otorgando 2x Daño Amplificado para tu próximo asalto.`;
            setActiveTonic(true);
            triggerAudioTone(587.33, 'sine', 0.5);
            setActiveFlashes(prev => [...prev, { x: 350, y: 140, text: `-${nitzDmg}!`, color: '#fbbf24' }]);
          }
        }

        nextEnemyHp = Math.max(0, nextEnemyHp - nitzDmg);
        roundLogs.push(nitzLog);
      }
    }

    setEnemyHp(nextEnemyHp);

    // ====== FASE 3: DETECTAR VICTORIA ======
    if (nextEnemyHp <= 0) {
      setTimeout(() => {
        setVictory(true);
        setBattleOver(true);
        setNitzAnimationState('idle');
        roundLogs.push('🏆 ¡VICTORIA DE EQUIPO! Tú y tu Nitz han purificado al Nitz Korrumpido con éxito. ¡Recibes +100 Oro y +60 EXP!');
        onSaveProgress({
          ...progress,
          gold: progress.gold + 100,
          exp: progress.exp + 60
        });
        setBattleReport(prev => [...prev, ...roundLogs]);
        setIsFighting(false);
        triggerAudioTone(659, 'sine', 1.0);
      }, 1200);
      return;
    }

    // ====== FASE 4: RESPUESTA REACCIONARIA DEL ENEMIGO ======
    setTimeout(() => {
      setWeaponAnimationState('idle');
      setNitzAnimationState('idle');
      setEnemyOffset({ x: 0, y: 0 });

      let enemyBaseDmg = Math.floor(40 + Math.random() * 25 + progress.phase * 4);
      if (playerMitigationActive) {
        enemyBaseDmg = Math.floor(enemyBaseDmg * 0.5);
        setPlayerMitigationActive(false);
        roundLogs.push(`🛡️ ¡Mitigación del 50% activa por tu Escama Sagrada!`);
      }

      // Decidir objetivo: tu Nitz (35% de probabilidad) o tú el Guardián (65%).
      // Pero si se ordenó PROTEGER, o es personalidad defensiva, intercepta por completo!
      const isNitzProtectActive = selectedOrder === 'protect';
      const targetsNitz = nitzHp > 0 && (isNitzProtectActive || Math.random() < 0.35);

      if (targetsNitz) {
        // El enemigo ataca a la criatura acompañante
        let actualNitzDmg = isNitzProtectActive ? Math.floor(enemyBaseDmg * 0.45) : enemyBaseDmg;
        const nextNitzHp = Math.max(0, nitzHp - actualNitzDmg);
        setNitzHp(nextNitzHp);
        
        setNitzAnimationState('pain');
        roundLogs.push(
          `🌋 El Nitz Korrumpido enfurece arremetiendo contra tu COMPAÑERO NITZ.` +
          ` ¡Nitz recibe ${actualNitzDmg} de daño! ${isNitzProtectActive ? '(¡Daño reducido gracias a la instrucción de Proteger!)' : ''}`
        );

        if (nextNitzHp <= 0) {
          roundLogs.push(`💤 ¡Tu Nitz ha colapsado exhausto! Se retira temporalmente para descansar en su cápsula cósmica.`);
        }
        triggerAudioTone(130, 'sawtooth', 0.5);
      } else {
        // El enemigo te ataca a ti (el Guardián Celestial)
        const playerMitigation = currentArmorAttr.mitigation;
        const actualPlayerDmg = Math.floor(enemyBaseDmg * (1.0 - playerMitigation));
        
        let finalPlayerHpDmg = actualPlayerDmg;
        let pShieldAbsorbed = 0;

        if (playerShield > 0) {
          if (playerShield >= actualPlayerDmg) {
            setPlayerShield(prev => prev - actualPlayerDmg);
            pShieldAbsorbed = actualPlayerDmg;
            finalPlayerHpDmg = 0;
          } else {
            pShieldAbsorbed = playerShield;
            finalPlayerHpDmg = actualPlayerDmg - playerShield;
            setPlayerShield(0);
          }
        }

        const nextPlayerHp = Math.max(0, playerHp - finalPlayerHpDmg);
        setPlayerHp(nextPlayerHp);

        roundLogs.push(
          `🌋 El Nitz Korrumpido te escupe una Flama de Sombras directamente a TI.` +
          ` ¡Recibes ${actualPlayerDmg} de daño total (${pShieldAbsorbed > 0 ? `${pShieldAbsorbed} absorbido por Escudo, ` : ''}${finalPlayerHpDmg} restado de HP!).`
        );
        setShakeAmount(15);
        triggerAudioTone(110, 'sawtooth', 0.5);

        if (nextPlayerHp <= 0) {
          setVictory(false);
          setBattleOver(true);
          roundLogs.push('💀 Has sido derrotado. Tu Nitz místico se interpone para retirarte a salvo de regreso en la taberna.');
          triggerAudioTone(85, 'sine', 1.2);
          if (onDefeat) {
            setTimeout(() => {
              onDefeat();
            }, 3000);
          }
        }
      }

      setBattleReport(prev => [...prev, ...roundLogs]);
      setRound(prev => prev + 1);
      setIsFighting(false);
      
      // Limpiar orden preparada para la siguiente ronda
      setSelectedOrder('none');
    }, 1400);
  };

  const handleReset = () => {
    setPlayerHp(350 + progress.phase * 50);
    setPlayerShield(currentShieldAttr.shieldCap);
    setNitzHp(220 + progress.phase * 30);
    setEnemyHp(450);
    setRound(1);
    setSelectedOrder('none');
    setNitzAnimationState('idle');
    setBattleOver(false);
    setBattleReport([]);
    setIsFighting(false);
    setActiveTonic(false);
    setEnemyBurnTicks(0);
    setPlayerMitigationActive(false);
  };

  // Interactive joint team graphics drawing inside canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let timer = 0;

    const draw = () => {
      timer += 0.05;
      const w = canvasRef.current?.width || 720;
      const h = canvasRef.current?.height || 440;

      ctx.clearRect(0, 0, w, h);

      // Shaking camera offset
      const currentShakeX = shakeAmount > 0 ? (Math.random() * shakeAmount - shakeAmount / 2) : 0;
      const currentShakeY = shakeAmount > 0 ? (Math.random() * shakeAmount - shakeAmount / 2) : 0;
      if (shakeAmount > 0) {
        setShakeAmount(prev => Math.max(0, prev - 0.5));
      }

      ctx.save();
      ctx.translate(currentShakeX, currentShakeY);

      // 1. Draw cosmic nebula space sky background
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      skyGrad.addColorStop(0, '#040510');
      skyGrad.addColorStop(0.5, '#070a1a');
      skyGrad.addColorStop(1, '#11142a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Stars
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 1; i <= 25; i++) {
        const sx = (Math.sin(i * 1234) * 0.5 + 0.5) * w;
        const sy = (Math.cos(i * 5678) * 0.5 + 0.5) * (h * 0.55);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // 2. Draw 3D-Look perspective floor grid
      const horizonY = h * 0.55;
      ctx.strokeStyle = 'rgba(222, 193, 172, 0.15)';
      ctx.lineWidth = 1.5;

      // Vertical perspective lines
      const lineCount = 14;
      for (let i = 0; i <= lineCount; i++) {
        const progressX = i / lineCount;
        const xOffset = (progressX - 0.5) * 850;
        ctx.beginPath();
        ctx.moveTo(w / 2, horizonY);
        ctx.lineTo(w / 2 + xOffset, h);
        ctx.stroke();
      }

      // Horizontal ground lines
      const horizGridCount = 8;
      for (let i = 1; i <= horizGridCount; i++) {
        const progressY = i / horizGridCount;
        const gy = horizonY + (h - horizonY) * Math.pow(progressY, 2.5);
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // 3. Draw Enemy "Nitz Korrumpido" standing in 3D center
      const enemyX = w / 2 + enemyOffset.x;
      const enemyY = horizonY - 15 + Math.sin(timer * 2) * 10 + enemyOffset.y;
      
      // Aura bloom under rogue
      const radG = ctx.createRadialGradient(enemyX, enemyY, 5, enemyX, enemyY, 75);
      radG.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
      radG.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = radG;
      ctx.beginPath();
      ctx.arc(enemyX, enemyY, 75, 0, Math.PI * 2);
      ctx.fill();

      // Enemy Body Core (Wobbly circle)
      const rBase = 42 + Math.cos(timer * 3) * 3;
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.2) {
        const wiggle = Math.sin(a * 6 + timer * 4) * 3;
        const cx = enemyX + Math.cos(a) * (rBase + wiggle);
        const cy = enemyY + Math.sin(a) * (rBase + wiggle);
        if (a === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Enemy glowing eyes
      ctx.fillStyle = 'white';
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(enemyX - 12 - Math.sin(timer)*1, enemyY - 8, 5, 0, Math.PI * 2);
      ctx.arc(enemyX + 12 - Math.sin(timer)*1, enemyY - 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Enemy Health bar in 3D
      const eBarW = 120;
      const eBarH = 6;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(enemyX - eBarW / 2, enemyY - 70, eBarW, eBarH);
      ctx.fillStyle = '#fc8181';
      ctx.fillRect(enemyX - eBarW / 2, enemyY - 70, eBarW * (enemyHp / enemyMaxHp), eBarH);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.strokeRect(enemyX - eBarW / 2, enemyY - 70, eBarW, eBarH);

      // Float label name
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NITZ KORRUMPIDO (FASE 4)', enemyX, enemyY - 78);

      // 3b. DRAW COMPANION NITZ (BOTTOM-LEFT / GROUND PERSPECTIVE)
      const nitzX = w * 0.26 + (nitzAnimationState === 'charge' ? 100 : nitzAnimationState === 'support' ? -20 : 0);
      const nitzY = h * 0.74 + Math.sin(timer * 2.5) * 8 + (nitzAnimationState === 'pain' ? 15 : 0);
      const nitzR = 30 + progress.phase * 5;

      // Draw companion glowing halo
      const nitzG = ctx.createRadialGradient(nitzX, nitzY, 5, nitzX, nitzY, nitzR + 30);
      const glowColor = '#' + playerColorHexStr;
      nitzG.addColorStop(0, `rgba(${parseInt(playerColorHexStr.substring(0, 2), 16) || 120}, ${parseInt(playerColorHexStr.substring(2, 4), 16) || 180}, ${parseInt(playerColorHexStr.substring(4, 6), 16) || 240}, 0.35)`);
      nitzG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nitzG;
      ctx.beginPath();
      ctx.arc(nitzX, nitzY, nitzR + 30, 0, Math.PI * 2);
      ctx.fill();

      // Draw Nitz body (Wobbly circle)
      ctx.fillStyle = glowColor;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.2) {
        const wiggle = Math.sin(a * 4 + timer * 3.5) * 2.5;
        const cx = nitzX + Math.cos(a) * (nitzR + wiggle);
        const cy = nitzY + Math.sin(a) * (nitzR + wiggle);
        if (a === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sparkling friendly cute eyes
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(nitzX - 8, nitzY - 4, 5, 0, Math.PI * 2);
      ctx.arc(nitzX + 8, nitzY - 4, 5, 0, Math.PI * 2);
      ctx.fill();

      // Glossy pupils with hope
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(nitzX - 7, nitzY - 4, 2, 0, Math.PI * 2);
      ctx.arc(nitzX + 9, nitzY - 4, 2, 0, Math.PI * 2);
      ctx.fill();

      // Sparkles of high emotion
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(nitzX - 9, nitzY - 6, 1, 0, Math.PI * 2);
      ctx.arc(nitzX + 7, nitzY - 6, 1, 0, Math.PI * 2);
      ctx.fill();

      // Cheeks blush
      ctx.fillStyle = 'rgba(244, 63, 94, 0.5)';
      ctx.beginPath();
      ctx.arc(nitzX - 12, nitzY + 2, 3, 0, Math.PI * 2);
      ctx.arc(nitzX + 12, nitzY + 2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Companion 3D Health Bar
      if (nitzHp > 0) {
        const cBarW = 90;
        const cBarH = 5;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(nitzX - cBarW/2, nitzY - nitzR - 15, cBarW, cBarH);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(nitzX - cBarW/2, nitzY - nitzR - 15, cBarW * (nitzHp / nitzMaxHp), cBarH);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.strokeRect(nitzX - cBarW/2, nitzY - nitzR - 15, cBarW, cBarH);

        // Name and state
        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`NITZ (${currentDominant.toUpperCase()})`, nitzX, nitzY - nitzR - 22);
      } else {
        ctx.fillStyle = '#9ca3af';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`NITZ DEBILITADO`, nitzX, nitzY - nitzR - 16);
      }

      // 4. DRAW THE FIRST-PERSON WEAPON HAND RIG (BOTTOM RIGHT)
      const idleSwayX = Math.sin(timer * 1.5) * 6;
      const idleSwayY = Math.cos(timer * 1.2) * 5;

      let weaponX = w * 0.82 + idleSwayX;
      let weaponY = h * 0.88 + idleSwayY;

      // Handle custom animations
      if (weaponAnimationState === 'swing') {
        const swingTimer = (timer * 10) % (Math.PI * 2);
        weaponX -= Math.abs(Math.sin(swingTimer)) * 60;
        weaponY -= Math.abs(Math.cos(swingTimer)) * 40;
        
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(w / 2 + 50, h / 2 + 60, 100, Math.PI, Math.PI * 1.5);
        ctx.stroke();
      } else if (weaponAnimationState === 'cast') {
        weaponY -= 15;
      }

      ctx.save();
      ctx.translate(weaponX, weaponY);
      ctx.rotate(-0.3 + (weaponAnimationState === 'swing' ? -0.8 : 0));

      // Draw hand sleeves (Player arm extending up)
      ctx.fillStyle = '#1e1b4b';
      ctx.strokeStyle = '#c4c5da';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-15, 60);
      ctx.lineTo(25, 60);
      ctx.lineTo(15, -10);
      ctx.lineTo(-20, -10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // IF WEAPON IS EQUIPPED - DRAW IT
      if (activeWeapon) {
        let bladeColor = '#34d399'; // novice
        let hiltColor = '#dec1ac';
        if (activeWeapon.name.includes('Sable del Alba')) {
          bladeColor = '#fbbf24'; // legendary golden aura
          hiltColor = '#f59e0b';
        } else if (activeWeapon.name.includes('Mandoble')) {
          bladeColor = '#c084fc'; // purple power
          hiltColor = '#6b21a8';
        }

        // Draw handle and Guard hilt
        ctx.fillStyle = hiltColor;
        ctx.fillRect(-10, -16, 20, 6);
        ctx.fillRect(-3, -25, 6, 12);

        // Draw Crystalline Blade
        ctx.fillStyle = bladeColor;
        ctx.beginPath();
        ctx.moveTo(-6, -25);
        ctx.lineTo(6, -25);
        ctx.lineTo(4, -130);
        ctx.lineTo(0, -145);
        ctx.lineTo(-4, -130);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -25);
        ctx.lineTo(0, -135);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.shadowColor = bladeColor;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, -100, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#dec1ac';
        ctx.beginPath();
        ctx.arc(0, -20, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // 5. Draw floating damage flash texts
      ctx.save();
      activeFlashes.forEach((fl) => {
        ctx.fillStyle = fl.color;
        ctx.font = 'bold 20px monospace';
        ctx.fillText(fl.text, fl.x, fl.y);
      });
      ctx.restore();

      // Ambient screen red blood HUD flash when player HP is critical
      if (playerHp < 100) {
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.15 + Math.sin(timer * 5) * 0.1})`;
        ctx.lineWidth = 14;
        ctx.strokeRect(0, 0, w, h);
      }

      ctx.restore();

      animFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [shakeAmount, weaponAnimationState, activeFlashes, playerHp, enemyHp, enemyOffset, activeWeapon, nitzHp, nitzAnimationState, currentDominant, playerColorHexStr]);

  // Clean flashes over time
  useEffect(() => {
    if (activeFlashes.length > 0) {
      const timer = setTimeout(() => {
        setActiveFlashes([]);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [activeFlashes]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      
      {/* Header banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <Swords className="w-8 h-8 text-red-400 animate-pulse" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white font-headline-lg">Arena del Guardián: Primera Persona</h1>
            <p className="text-xs text-[#919097] uppercase tracking-wider">Maneja tu arsenal de la forja e interactúa con estadísticas reales en combates dinámicos</p>
          </div>
        </div>
        <div className="text-xs font-mono font-semibold px-3 py-1.5 bg-[#4c1d1d]/30 text-red-400 border border-red-500/20 rounded-full flex items-center gap-1.5 animate-pulse">
          <ShieldAlert className="w-4 h-4" />
          <span>Incursión Activa &nbsp;•&nbsp; Pelea Táctica</span>
        </div>
      </div>

      {/* Equipment select & Stats calibration row before duling */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Weapon Armory selection */}
        <div className="bg-[#121424] border border-white/10 rounded-xl p-4 space-y-3">
          <span className="text-[10px] font-mono text-[#dec1ac] uppercase tracking-widest block">Equipar Arma Forjada</span>
          <div className="space-y-1.5">
            {weapons.length > 0 ? (
              weapons.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleEquipItem(item.id, 'weapon')}
                  className={`w-full text-left p-2 rounded text-xs transition border flex justify-between items-center ${
                    item.equipped ? 'bg-amber-500/10 text-white border-amber-500' : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/15'
                  }`}
                >
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-[9px] font-mono text-amber-400">{item.statBonus}</span>
                </button>
              ))
            ) : (
              <p className="text-[11px] text-gray-500 py-2">No posees armas crafted en tu inventario. Forja una en la pestaña Crafting.</p>
            )}
          </div>
        </div>

        {/* Shield Armory selection */}
        <div className="bg-[#121424] border border-white/10 rounded-xl p-4 space-y-3">
          <span className="text-[10px] font-mono text-[#dec1ac] uppercase tracking-widest block">Equipar Escudo Forjado</span>
          <div className="space-y-1.5">
            {shields.length > 0 ? (
              shields.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleEquipItem(item.id, 'shield')}
                  className={`w-full text-left p-2 rounded text-xs transition border flex justify-between items-center ${
                    item.equipped ? 'bg-amber-500/10 text-white border-amber-500' : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/15'
                  }`}
                >
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-[9px] font-mono text-cyan-400">{item.statBonus}</span>
                </button>
              ))
            ) : (
              <p className="text-[11px] text-gray-500 py-2">No posees escudos. Forja un "Escudo de Placas Estelares" para absorber golpes.</p>
            )}
          </div>
        </div>

        {/* Armor selection */}
        <div className="bg-[#121424] border border-white/10 rounded-xl p-4 space-y-3">
          <span className="text-[10px] font-mono text-[#dec1ac] uppercase tracking-widest block">Equipar Armadura Forjada</span>
          <div className="space-y-1.5">
            {armors.length > 0 ? (
              armors.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleEquipItem(item.id, 'armor')}
                  className={`w-full text-left p-2 rounded text-xs transition border flex justify-between items-center ${
                    item.equipped ? 'bg-amber-500/10 text-white border-amber-500' : 'bg-black/30 border-white/5 text-gray-400 hover:border-white/15'
                  }`}
                >
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-[9px] font-mono text-purple-400">{item.statBonus}</span>
                </button>
              ))
            ) : (
              <p className="text-[11px] text-gray-500 py-2">No posees armaduras de la forja. Mitigación base activa al 0%.</p>
            )}
          </div>
        </div>

      </div>

      {/* Main viewport visual and live data feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6">
        
        {/* Visual box left side */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-black rounded-xl border border-white/10 relative overflow-hidden h-[540px] shadow-2xl p-4">
          
          {/* Top HP HUD of combatants */}
          <div className="absolute top-4 inset-x-4 z-10 flex justify-between items-start pointer-events-none text-glow-silver select-none">
            {/* Left Hand: Player and Nitz Status Columns */}
            <div className="flex flex-col gap-2">
              {/* Player Status */}
              <div className="bg-black/80 border border-white/10 rounded-lg p-2.5 w-44 backdrop-blur-md space-y-1">
                <span className="text-[8.5px] uppercase font-mono tracking-widest text-emerald-400 block">Guardián (Tú)</span>
                <h4 className="text-white text-xs font-bold leading-none truncate">{progress.username || 'Tú'}</h4>
                
                {/* HP Bar */}
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-white/5 mt-1.5">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${(playerHp / (350 + progress.phase * 50)) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[9px] font-mono text-gray-400 leading-none">
                  <span>HP: {playerHp} / {350 + progress.phase * 50}</span>
                </div>

                {/* Absorb Shield Bar */}
                {currentShieldAttr.shieldCap > 0 && (
                  <>
                    <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden border border-white/5 mt-1.55">
                      <div 
                        className="h-full bg-cyan-400 transition-all duration-300"
                        style={{ width: `${(playerShield / currentShieldAttr.shieldCap) * 100}%` }}
                      />
                    </div>
                    <div className="text-[8.5px] font-mono text-cyan-400 leading-none">
                      Escudo: {playerShield} / {currentShieldAttr.shieldCap}
                    </div>
                  </>
                )}
              </div>

              {/* Nitz Companion Status */}
              <div className="bg-black/80 border border-white/10 rounded-lg p-2.5 w-44 backdrop-blur-md space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[8.5px] uppercase font-mono tracking-widest text-[#dec1ac] block">Compañero Nitz</span>
                  <span className="text-[8px] font-mono bg-indigo-500/15 text-indigo-300 px-1 rounded uppercase">Acompañante</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-white font-semibold flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-[#dec1ac]" /> Criatura Nitz
                  </span>
                  <span className={`text-[8px] font-mono font-bold uppercase ${nitzHp <= 0 ? 'text-red-400' : 'text-cyan-300'}`}>
                    {nitzHp > 0 ? (selectedOrder !== 'none' ? '🏁 ORDENADO' : '🤖 PENSANDO...') : '😴 DEBILITADO'}
                  </span>
                </div>
                
                {/* HP Bar */}
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-white/5 mt-1">
                  <div 
                    className="h-full bg-cyan-500 transition-all duration-300"
                    style={{ width: `${(nitzHp / nitzMaxHp) * 100}%` }}
                  />
                </div>
                <div className="text-[9px] font-mono text-gray-400 leading-none">
                  HP: {nitzHp} / {nitzMaxHp}
                </div>
              </div>
            </div>

            {/* Shield and Attack Multiplier icons */}
            {activeTonic && (
              <div className="bg-yellow-500 text-black px-2 py-1 rounded text-[9px] font-bold animate-pulse font-mono flex items-center gap-1 uppercase self-center">
                <Flame className="w-3.5 h-3.5" /> 2x Amplificado!
              </div>
            )}

            {/* Right Hand: Rogue Outcast */}
            <div className="bg-black/85 border border-white/10 rounded-lg p-2.5 w-44 backdrop-blur-md text-right space-y-1">
              <span className="text-[9px] uppercase font-mono tracking-widest text-red-400 block">Enemigo</span>
              <h4 className="text-white text-xs font-bold leading-none">Nitz Korrumpido</h4>
              
              {/* Crimson HP */}
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-white/5 mt-1.5">
                <div 
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${(enemyHp / enemyMaxHp) * 100}%` }}
                />
              </div>
              <div className="text-[9px] font-mono text-gray-400">HP: {enemyHp} / {enemyMaxHp}</div>
            </div>
          </div>

          {/* Interactive Rendering Canvas */}
          <canvas 
            ref={canvasRef} 
            width={720} 
            height={440} 
            className="w-full h-full rounded-md" 
          />

          {/* Tactical Bottom Action Belt Controls */}
          <div className="relative z-10 glass-panel bg-black/85 p-3 rounded-xl border border-white/10 space-y-2.5">
            
            {/* Top row: Nitz Order Selector if alive and battle is active */}
            {!battleOver && nitzHp > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white/5 p-2 rounded-lg border border-white/5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-tertiary animate-pulse" />
                  <span className="text-[10px] font-mono font-bold text-gray-300 uppercase">Orden Directa a tu Nitz:</span>
                </div>
                <div className="flex gap-1.5 w-full sm:w-auto">
                  <button
                    disabled={isFighting}
                    onClick={() => setSelectedOrder(prev => prev === 'attack' ? 'none' : 'attack')}
                    className={`flex-1 sm:flex-initial px-3 py-1 text-[9.5px] font-extrabold rounded-md border transition-all ${
                      selectedOrder === 'attack'
                        ? 'bg-red-500/20 text-red-300 border-red-500/50 scale-105 shadow-md shadow-red-500/10'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    ⚔️ ¡Ataque Feroz!
                  </button>
                  <button
                    disabled={isFighting}
                    onClick={() => setSelectedOrder(prev => prev === 'heal' ? 'none' : 'heal')}
                    className={`flex-1 sm:flex-initial px-3 py-1 text-[9.5px] font-extrabold rounded-md border transition-all ${
                      selectedOrder === 'heal'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 scale-105 shadow-md shadow-emerald-500/10'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    💚 ¡Cúrame!
                  </button>
                  <button
                    disabled={isFighting}
                    onClick={() => setSelectedOrder(prev => prev === 'protect' ? 'none' : 'protect')}
                    className={`flex-1 sm:flex-initial px-3 py-1 text-[9.5px] font-extrabold rounded-md border transition-all ${
                      selectedOrder === 'protect'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 scale-105 shadow-md shadow-cyan-500/10'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    🛡️ ¡Proteger Guardián!
                  </button>
                </div>
              </div>
            )}

            {/* Bottom row: Player tactics and weapon info */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-0.5 self-start sm:self-center">
                <span className="text-[9px] text-[#dec1ac] uppercase font-bold tracking-widest block font-mono">Mis Tácticas de Guardián (Tú)</span>
                <div className="text-[10px] text-gray-400 max-w-xs">
                  {activeWeapon ? `Sable: ${activeWeapon.name} (${activeWeapon.statBonus})` : 'Mi equipo de combate'}
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto items-center">
                {!battleOver ? (
                  <>
                    <button
                      onClick={() => handleTactic('weapon')}
                      disabled={isFighting}
                      className="flex-1 sm:flex-initial p-2 px-3.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 active:scale-95 disabled:opacity-40"
                    >
                      <Flame className="w-4 h-4" />
                      <span>{activeWeapon?.name.includes('Sable del Alba') ? 'Ira Solar' : activeWeapon?.name.includes('Mandoble') ? 'Tajo Sombrío' : 'Corte Rápido'}</span>
                    </button>
                    <button
                      onClick={() => handleTactic('shield')}
                      disabled={isFighting}
                      className="flex-1 sm:flex-initial p-2 px-3.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-400 hover:to-cyan-300 text-white rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 active:scale-95 disabled:opacity-40"
                    >
                      <Zap className="w-4 h-4" />
                      <span>{activeShield?.name.includes('Estelares') ? 'Barrera Rúnica' : 'Guardia Simple'}</span>
                    </button>
                    <button
                      onClick={() => handleTactic('armor')}
                      disabled={isFighting}
                      className="flex-1 sm:flex-initial p-2 px-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-400 hover:to-emerald-300 text-white rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 active:scale-95 disabled:opacity-40"
                    >
                      <Shield className="w-4 h-4" />
                      <span>{activeArmor?.name.includes('Escamas') ? 'Escama Sagrada' : 'Refugio Común'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleReset}
                    className="w-full px-6 py-2 bg-[#dec1ac] hover:bg-white text-black font-extrabold text-xs rounded-lg transition-all uppercase tracking-widest shadow-md"
                  >
                    Reiniciar Combate Estratégico
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Right side telemetry logs / store recovery */}
        <div className="lg:col-span-4 flex flex-col justify-between h-[540px] bg-[#121424] rounded-xl border border-white/10 overflow-hidden shadow-xl">
          
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-[#1b1e32] border-b border-white/5 py-3 px-4 flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-white font-mono">Consola de Combate Cooperativo</span>
              <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-0.5 rounded uppercase font-mono animate-pulse">Live</span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-[11px] text-[#c4c5da] custom-scrollbar">
              {battleReport.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 space-y-2 p-4">
                  <ShieldAlert className="w-8 h-8 text-white/10 animate-bounce" />
                  <p>Iniciando batalla táctica.</p>
                  <p className="text-[10px]">Tú manejas tu propio sable y armadura, mientras tu Nitz actúa solo por IA o responde a tus órdenes de asalto.</p>
                </div>
              ) : (
                battleReport.map((log, i) => (
                  <div 
                    key={i} 
                    className={`p-2 rounded border border-white/5 ${
                      log.startsWith('---') 
                        ? 'bg-[#191b32] text-white border-l-2 border-l-[#dec1ac] pl-2.5 font-bold' 
                        : log.includes('VICTORIA') 
                        ? 'bg-emerald-950/20 text-emerald-300 border-l-2 border-l-emerald-500 pl-2.5' 
                        : log.includes('debilitado') || log.includes('💀') || log.includes('colapsado')
                        ? 'bg-red-950/20 text-red-300 border-l-2 border-l-red-500 pl-2.5'
                        : log.includes('🧪')
                        ? 'bg-yellow-950/20 text-yellow-300 border-l-2 border-l-yellow-400 pl-2.5'
                        : log.includes('[ORDEN')
                        ? 'bg-indigo-950/20 text-indigo-300 border-l-2 border-l-indigo-400 pl-2.5 font-bold'
                        : log.includes('[IA COMPAÑERA]')
                        ? 'bg-cyan-950/15 text-cyan-300 border-l-2 border-l-cyan-400 pl-2.5 style:italic'
                        : 'bg-black/10'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom potion auxiliary belt */}
          <div className="bg-[#191b32] border-t border-white/5 p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-white font-semibold flex items-center gap-1.5 h-6">
                <ShoppingBag className="w-4 h-4 text-[#dec1ac]" /> Farmacia de Combate
              </span>
              <span className="bg-black/40 px-2 py-0.5 font-mono text-[10.5px] rounded text-emerald-400 font-bold border border-white/5">
                Oro: {progress.gold}g
              </span>
            </div>

            <button
              onClick={handleBuyTonic}
              disabled={progress.gold < 40 || activeTonic}
              className="w-full p-2.5 bg-[#dec1ac]/15 hover:bg-[#dec1ac]/25 border border-[#dec1ac]/30 text-tertiary disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold rounded-lg transition-colors flex items-center justify-between"
              title="El tónico dobla el daño del próximo ataque físico o ráfaga"
            >
              <span>Comprar Tónico Sentimental (2x Daño)</span>
              <span>40g</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
