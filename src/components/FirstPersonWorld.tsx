import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, 
  ShieldAlert, 
  Shield, 
  Axe, 
  Flame, 
  Heart, 
  Sparkles, 
  Sword, 
  Zap,
  Play, 
  Ghost, 
  Skull, 
  Hammer, 
  Users, 
  LogOut, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  BookOpen, 
  RefreshCw,
  Coins,
  MapPin,
  CheckCircle,
  XCircle,
  MessageSquare
} from 'lucide-react';
import * as THREE from 'three';
import { PlayerProgress, GatheringInventory, CraftableItem, EmotionName } from '../types';
import { db, auth } from '../firebase';
import { collection, doc, query, onSnapshot, updateDoc, increment, getDoc, arrayUnion, addDoc } from 'firebase/firestore';

// Subcomponents to render as immersive overlays
import { MyHome } from './MyHome';
import { Lobby } from './Lobby';
import { BattleArena } from './BattleArena';
import { Minigame } from './Minigame';
import { Codex } from './Codex';
import { Crafting } from './Crafting';
import { Vecindario } from './Vecindario';

interface FirstPersonWorldProps {
  progress: PlayerProgress;
  onSaveProgress: (newProg: PlayerProgress) => void;
  // Triggered when updating state inside App.tsx
  onUpdateEmotions: (updater: (prev: any) => any) => void;
  onEvolve: () => void;
  onSpendGold: (amount: number, expGained: number) => boolean;
}

export type FPMapType = 'cabin' | 'neighborhood' | 'lobby' | 'map1' | 'map2' | 'map3';

interface OnlinePlayer {
  id: string;
  username: string;
  phase: number;
  dominantEmotion: EmotionName;
  currentMap?: FPMapType;
  posX?: number;
  posZ?: number;
  facingAngle?: number;
  pvpEnabled?: boolean;
  companionSummoned?: boolean;
  activeNitzName?: string;
}

interface InteractiveNode3D {
  id: string;
  name: string;
  x: number;
  z: number;
  type: 'tree' | 'ore' | 'synth' | 'anvil' | 'bookshelf' | 'door_vecindario' | 'door_cabin' | 'door_lobby' | 'door_map1' | 'door_map2' | 'door_map3' | 'door_arena' | 'nitz_npc' | 'house_plot' | 'portal_praise';
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  clicksRequired?: number;
  clicksCurrent?: number;
  label: string;
  plotOwnerId?: string; // For neighborhood houses
}

export function FirstPersonWorld({
  progress,
  onSaveProgress,
  onUpdateEmotions,
  onEvolve,
  onSpendGold
}: FirstPersonWorldProps) {
  // Navigation states
  const [currentMap, setCurrentMap] = useState<FPMapType>('cabin');
  const [playerX, setPlayerX] = useState<number>(0);
  const [playerZ, setPlayerZ] = useState<number>(5);
  const [cameraAngle, setCameraAngle] = useState<number>(0); // in radians
  const [cameraPitch, setCameraPitch] = useState<number>(0); // up/down viewport

  // Active overlay modal state
  const [activeOverlay, setActiveOverlay] = useState<'none' | 'crafting' | 'syntonia' | 'codex' | 'arena' | 'interactive_pet_chat' | 'house_decorating'>('none');

  // Multi-player states
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [pvpEnabled, setPvpEnabled] = useState<boolean>(false);
  const [praiseMessage, setPraiseMessage] = useState<string | null>(null);

  // Extraction States (Arc Raiders style)
  const [extractionActive, setExtractionActive] = useState<boolean>(false);
  const [extractionTimeLeft, setExtractionTimeLeft] = useState<number>(0);

  // PVP Battle State
  const [activeDuelId, setActiveDuelId] = useState<string | null>(null);
  const [pendingDuelInvite, setPendingDuelInvite] = useState<any | null>(null);
  const [pvpDuel, setPvpDuel] = useState<{
    inCombat: boolean;
    rivalName: string;
    rivalId: string;
    rivalHp: number;
    rivalMaxHp: number;
    rivalShield: number;
    playerHp: number;
    playerMaxHp: number;
    playerShield: number;
    logs: string[];
  } | null>(null);

  // Temp gathering bag state
  const [tempBag, setTempBag] = useState<GatheringInventory>({
    wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
    stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
    metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
    essence: { common: 0, rare: 0, epic: 0, legendary: 0 }
  });

  // Interactive nodes inside the active map
  const [activeNodes, setActiveNodes] = useState<InteractiveNode3D[]>([]);
  const [nearNode, setNearNode] = useState<InteractiveNode3D | null>(null);

  // Physics & FPS controls state
  const playerYRef = useRef<number>(1.6);
  const velocityYRef = useRef<number>(0);
  const isJumpingRef = useRef<boolean>(false);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const [activeNitzIndex, setActiveNitzIndex] = useState<number>(0);

  // Synchronize activeNitzIndex with progress.avatar.name
  useEffect(() => {
    const name = progress.avatar.name;
    if (name === "Nitz Ígneo") {
      setActiveNitzIndex(1);
    } else if (name === "Nitz Abisal") {
      setActiveNitzIndex(2);
    } else {
      setActiveNitzIndex(0);
    }
  }, [progress.avatar.name]);

  // UI feedback notifications
  const [notification, setNotification] = useState<string | null>(null);

  // Input controller states
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({});

  // Coordinate & Camera Refs for frame-rate independent physics
  const playerXRef = useRef<number>(0);
  const playerZRef = useRef<number>(5);
  const cameraAngleRef = useRef<number>(0);
  const cameraPitchRef = useRef<number>(0);
  const onlinePlayersRef = useRef<OnlinePlayer[]>([]);
  const activeNodesRef = useRef<InteractiveNode3D[]>([]);

  // Synchronize state changes to refs
  useEffect(() => {
    playerXRef.current = playerX;
  }, [playerX]);

  useEffect(() => {
    playerZRef.current = playerZ;
  }, [playerZ]);

  useEffect(() => {
    cameraAngleRef.current = cameraAngle;
  }, [cameraAngle]);

  useEffect(() => {
    cameraPitchRef.current = cameraPitch;
  }, [cameraPitch]);

  useEffect(() => {
    onlinePlayersRef.current = onlinePlayers;
  }, [onlinePlayers]);

  useEffect(() => {
    activeNodesRef.current = activeNodes;
  }, [activeNodes]);

  // Mobile touch support detection
  const [isMobile, setIsMobile] = useState<boolean>(false);
  useEffect(() => {
    const detectMobile = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmall = window.innerWidth <= 768;
      setIsMobile(hasTouch || isSmall);
    };
    detectMobile();
    window.addEventListener('resize', detectMobile);
    return () => window.removeEventListener('resize', detectMobile);
  }, []);

  // Mobile virtual joystick state
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickStartRef = useRef({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);

  const handleJoystickStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      joystickStartRef.current = { x: t.clientX, y: t.clientY };
      setIsJoystickActive(true);
    }
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (!isJoystickActive || e.touches.length === 0) return;
    const t = e.touches[0];
    const dx = t.clientX - joystickStartRef.current.x;
    const dy = t.clientY - joystickStartRef.current.y;

    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = 40;
    let nx = dx;
    let ny = dy;

    if (dist > maxRadius) {
      nx = (dx / dist) * maxRadius;
      ny = (dy / dist) * maxRadius;
    }

    setJoystickPos({ x: nx, y: ny });

    // Threshold of 0.25 to trigger virtual keys
    const ndx = nx / maxRadius;
    const ndy = ny / maxRadius;

    keysRef.current['w'] = ndy < -0.25;
    keysRef.current['s'] = ndy > 0.25;
    keysRef.current['a'] = ndx < -0.25;
    keysRef.current['d'] = ndx > 0.25;
  };

  const handleJoystickEnd = () => {
    setIsJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    keysRef.current['w'] = false;
    keysRef.current['s'] = false;
    keysRef.current['a'] = false;
    keysRef.current['d'] = false;
  };

  // Active overlay and interaction references for keydown listener
  const activeOverlayRef = useRef(activeOverlay);
  useEffect(() => {
    activeOverlayRef.current = activeOverlay;
  }, [activeOverlay]);

  const handleInteractNearNodeRef = useRef<() => void>(() => {});

  // Elements references for Three.js
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const keysDownRef = useRef<{ [key: string]: boolean }>({});
  const companionMeshRef = useRef<THREE.Mesh | null>(null);
  const companionRingRef = useRef<THREE.Mesh | null>(null);
  const strikeNodeRef = useRef<InteractiveNode3D | null>(null);

  // Setup initial key listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysDownRef.current[k] = true;
      keysRef.current[k] = true;
      setKeys({ ...keysDownRef.current });

      // If user presses Control or Alt, release pointer lock
      if (e.key === 'Control' || e.key === 'Alt') {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }

      // If user presses E, trigger interaction
      if ((e.key === 'e' || e.key === 'E') && activeOverlayRef.current === 'none') {
        handleInteractNearNodeRef.current();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysDownRef.current[k] = false;
      keysRef.current[k] = false;
      setKeys({ ...keysDownRef.current });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Exit pointer lock if overlay is active
  useEffect(() => {
    if (activeOverlay !== 'none') {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  }, [activeOverlay]);

  // Update notification helper
  const triggerNotification = (text: string) => {
    setNotification(text);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Safe Backing / Banking resources
  const handleBankResourcesDirectly = () => {
    const nextInventory = JSON.parse(JSON.stringify(progress.inventory)) as GatheringInventory;
    let countTotal = 0;
    
    const typesKeys = ['wood', 'stone', 'metal', 'essence'] as const;
    const rarityKeys = ['common', 'rare', 'epic', 'legendary'] as const;

    typesKeys.forEach(t => {
      rarityKeys.forEach(r => {
        const amt = tempBag[t][r];
        if (amt > 0) {
          nextInventory[t][r] += amt;
          countTotal += amt;
        }
      });
    });

    if (countTotal === 0) {
      triggerNotification("⚠️ Tu mochila temporal está vacía");
      return;
    }

    const goldBonus = Math.floor(countTotal * 2.5);
    const nextProg: PlayerProgress = {
      ...progress,
      inventory: nextInventory,
      gold: progress.gold + goldBonus,
      exp: progress.exp + countTotal * 12
    };

    onSaveProgress(nextProg);
    triggerNotification(`🎒 ¡Tu botín ha sido guardado! Recibes +${goldBonus} de oro y +${countTotal * 12} EXP.`);

    // Reset temporary session cargo
    setTempBag({
      wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
      stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
      metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
      essence: { common: 0, rare: 0, epic: 0, legendary: 0 }
    });

    // Play visual synth chime
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.1);
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (_) {}
  };

  // Determine current active dominant emotion
  const getDominant = (): { name: EmotionName; color: string; colorHex: number } => {
    let maxName: EmotionName = 'Alegría';
    let maxValue = -1;
    (Object.keys(progress.emotions) as EmotionName[]).forEach((key) => {
      if (progress.emotions[key] > maxValue) {
        maxValue = progress.emotions[key];
        maxName = key;
      }
    });

    // Color definitions
    const colors: Record<EmotionName, { hex: string; col: number }> = {
      Ira: { hex: 'text-red-500', col: 0xef4444 },
      Miedo: { hex: 'text-purple-500', col: 0xa855f7 },
      Tristeza: { hex: 'text-blue-500', col: 0x3b82f6 },
      Alegría: { hex: 'text-yellow-400', col: 0xfacc15 },
      Confianza: { hex: 'text-green-400', col: 0x4ade80 },
      Sorpresa: { hex: 'text-pink-400', col: 0xf472b6 },
      Amor: { hex: 'text-rose-400', col: 0xf43f5e },
      Orgullo: { hex: 'text-orange-500', col: 0xf97316 },
      Serenidad: { hex: 'text-cyan-400', col: 0x22d3ee }
    };

    return {
      name: maxName,
      color: colors[maxName]?.hex || 'text-white',
      colorHex: colors[maxName]?.col || 0xffffff
    };
  };

  const currentDominant = getDominant();

  // Load interactive nodes based on map selected
  useEffect(() => {
    let newNodes: InteractiveNode3D[] = [];
    if (currentMap === 'cabin') {
      newNodes = [
        { id: 'synth', name: 'Sintonizador Orgánico Estelar', x: -4, z: -3, type: 'synth', label: '🎼 Sostén Sintonía (Minijuego)' },
        { id: 'anvil', name: 'Yunque Forjador Astral', x: 4, z: -3, type: 'anvil', label: '🔨 Abrir Forja de Equipamiento' },
        { id: 'bookshelf', name: 'Gran Librera Astral (Códice)', x: -5, z: 2, type: 'bookshelf', label: '📖 Códice de Arquetipos' },
        { id: 'companion_nitz', name: 'Tu Criatura Acompañante Nitz', x: 0, z: -1, type: 'nitz_npc', label: '🐾 Interactuar con Nitz (Cuidado/Chat Gp-3)' },
        { id: 'door_to_vecindario', name: 'Puerta Principal de la Cabaña', x: 0, z: 6.5, type: 'door_vecindario', label: '🚪 Salir al Vecindario Astral' }
      ];
      setPlayerX(0);
      setPlayerZ(4);
    } else if (currentMap === 'neighborhood') {
      newNodes = [
        { id: 'door_back_cabin', name: 'Tu Cabaña', x: 0, z: 9, type: 'door_cabin', label: '🏠 Entrar a tu Cabaña' },
        { id: 'road_to_lobby', name: 'Senda al Templo del Lobby', x: 0, z: -25, type: 'door_lobby', label: '💎 Viajar al Lobby Central' },
        // Static interactive houses of neighbors
        { id: 'plot_luz', name: 'C Cathedral de Guardián_Luz', x: -14, z: -6, type: 'house_plot', plotOwnerId: 'plot_luz', label: '🏰 Visitar / Alabar Nitz de Guardián_Luz' },
        { id: 'plot_anime', name: 'Cabaña de AuraAnime', x: 14, z: -6, type: 'house_plot', plotOwnerId: 'plot_anime', label: '🌸 Visitar / Alabar Nitz de AuraAnime' },
        { id: 'plot_stellaria', name: 'Cabaña de Stellaria', x: -10, z: -18, type: 'house_plot', plotOwnerId: 'plot_stellaria', label: '🌌 Visitar / Alabar Nitz de Stellaria' }
      ];
      setPlayerX(0);
      setPlayerZ(7);
    } else if (currentMap === 'lobby') {
      newNodes = [
        { id: 'gate_vecindario', name: 'Paso de Regreso a Vecindarios', x: 0, z: 12, type: 'door_vecindario', label: '🏘️ Regresar al Vecindario' },
        { id: 'gate_world1', name: 'Portal al Mapa 1: Bosque Seguro', x: -12, z: -8, type: 'door_map1', label: '🌲 Viajar al Bosque Seguro (Fácil/Seguro)' },
        { id: 'gate_world2', name: 'Portal al Mapa 2: Cantera de Caos', x: 12, z: -8, type: 'door_map2', label: '💎 Viajar al Cantera Estelar (Medio/Materiales)' },
        { id: 'gate_world3', name: 'Portal Celestial al Mapa 3: Zona de Bruma de Sangre', x: 0, z: -18, type: 'door_map3', label: '💀 Viajar a la Zona Roja (Elite/PvP / Full Loot!)' },
        { id: 'portal_arena', name: 'Portal de Duelos de Arena vs Rogue Nitz', x: 0, z: -2, type: 'door_arena', label: '⚔️ Iniciar Arena de Combates vs Rogue Nitz' }
      ];
      setPlayerX(0);
      setPlayerZ(10);
    } else if (currentMap === 'map1') {
      // Safe gathering field
      newNodes = [
        { id: 'map1_exit', name: 'Portal de Escape al Lobby', x: 0, z: 18, type: 'door_lobby', label: '🚪 Regresar al Lobby Seguro' },
        { id: 'tr_c1', name: 'Arbusto Centelleante Común', x: -8, z: -5, type: 'tree', rarity: 'common', clicksRequired: 3, clicksCurrent: 0, label: '🌲 Recolectar Madera Común (+4 EXP)' },
        { id: 'tr_r2', name: 'Roble Ancestral de Aura', x: 8, z: -8, type: 'tree', rarity: 'rare', clicksRequired: 6, clicksCurrent: 0, label: '✨ Recolectar Madera Rara (+10 EXP)' },
        { id: 'tr_e1', name: 'Esencia de Bosque Resplandeciente', x: -4, z: -12, type: 'tree', rarity: 'epic', clicksRequired: 10, clicksCurrent: 0, label: '🔮 Recolectar Esencia Épica (+22 EXP)' }
      ];
      setPlayerX(0);
      setPlayerZ(15);
    } else if (currentMap === 'map2') {
      newNodes = [
        { id: 'map2_exit', name: 'Portal de Escape al Lobby', x: 0, z: 18, type: 'door_lobby', label: '🚪 Regresar al Lobby Seguro' },
        { id: 'or_c1', name: 'Fisura de Piedra Celestial', x: -10, z: -5, type: 'ore', rarity: 'common', clicksRequired: 4, clicksCurrent: 0, label: '🪨 Extraer Piedra Estelar (+4 EXP)' },
        { id: 'or_r1', name: 'Beta de Vena Metálica', x: 10, z: -7, type: 'ore', rarity: 'rare', clicksRequired: 8, clicksCurrent: 0, label: '⚡ Extraer Veta Metálica Rara (+10 EXP)' },
        { id: 'or_e1', name: 'Esencia de Falla Cósmica', x: 0, z: -11, type: 'tree', rarity: 'epic', clicksRequired: 11, clicksCurrent: 0, label: '🔮 Recolectar Esencia de Cuarzo Épico (+22 EXP)' }
      ];
      setPlayerX(0);
      setPlayerZ(15);
    } else if (currentMap === 'map3') {
      // Hard dangerous PvP Zone
      newNodes = [
        { id: 'map3_exit', name: 'Portal de Salvación al Lobby', x: 0, z: 20, type: 'door_lobby', label: '🚪 Regresar al Lobby de Enlace (Saca tu mochila!)' },
        { id: 'or_ep1', name: 'Hierro del Abismo Destructor', x: -12, z: -6, type: 'ore', rarity: 'epic', clicksRequired: 12, clicksCurrent: 0, label: '🔥 Extraer Hierro del Abismo Épico (+22 EXP)' },
        { id: 'or_ld1', name: 'Estatua del Alba Legendaria', x: 12, z: -12, type: 'ore', rarity: 'legendary', clicksRequired: 18, clicksCurrent: 0, label: '👑 Extraer Cristal de Alba Legendario (+45 EXP!)' },
        { id: 'tr_ld1', name: 'Neblina Astral de Caos', x: 0, z: -15, type: 'tree', rarity: 'legendary', clicksRequired: 17, clicksCurrent: 0, label: '🌌 Condensar Neblina Estelar Legendaria (+45 EXP!)' }
      ];
      setPlayerX(0);
      setPlayerZ(17);
    }
    setActiveNodes(newNodes);
    setNearNode(null);
  }, [currentMap]);

  // Real-time Firestore sync setup for multiplayer coordinates
  useEffect(() => {
    if (!auth.currentUser) return;
    
    // Subscribe to all online players in real time
    const qPlayers = collection(db, 'users');
    const unsubscribe = onSnapshot(qPlayers, (snapshot) => {
      const peers: OnlinePlayer[] = [];
      snapshot.forEach(docSnap => {
        if (docSnap.id === auth.currentUser?.uid) return;
        const data = docSnap.data();
        if (data.status === 'online' || data.isLoggedIn) {
          // Check if active within the last 5 minutes (300,000 ms)
          const lastActiveMs = data.lastActive ? Date.parse(data.lastActive) : 0;
          if (Date.now() - lastActiveMs < 300000) {
            peers.push({
              id: docSnap.id,
              username: data.username || 'Guardián',
              phase: data.phase || 1,
              dominantEmotion: data.dominantEmotion || 'Serenidad',
              currentMap: data.currentMap || 'lobby',
              posX: data.posX !== undefined ? parseFloat(data.posX) : 0,
              posZ: data.posZ !== undefined ? parseFloat(data.posZ) : 0,
              facingAngle: data.facingAngle !== undefined ? parseFloat(data.facingAngle) : 0,
              pvpEnabled: data.pvpEnabled || false,
              companionSummoned: data.companionSummoned || false,
              activeNitzName: data.activeNitzName || data.avatar?.name || 'Nitz de Origen'
            });
          }
        }
      });
      setOnlinePlayers(peers);
    });

    return () => {
      unsubscribe();
    };
  }, [currentMap]);

  // Periodically write self coordinates and active map to cloud (throttled every 1.5 seconds)
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const interval = setInterval(async () => {
      const userRef = doc(db, 'users', auth.currentUser!.uid);
      try {
        await updateDoc(userRef, {
          status: 'online',
          currentMap: currentMap,
          posX: parseFloat(playerX.toFixed(2)),
          posZ: parseFloat(playerZ.toFixed(2)),
          facingAngle: parseFloat(cameraAngle.toFixed(2)),
          pvpEnabled: pvpEnabled,
          companionSummoned: progress.companionSummoned || false,
          activeNitzName: progress.avatar.name || 'Nitz de Origen',
          lastActive: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error syncing player positional stats:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [currentMap, playerX, playerZ, cameraAngle, pvpEnabled, progress.companionSummoned, progress.avatar.name]);

  // Listen for PvP duel challenges and state updates
  useEffect(() => {
    if (!auth.currentUser) return;

    // 1. Listen for pending invites where we are the defender
    const qInvites = collection(db, 'pvp_duels');
    const unsubscribeInvites = onSnapshot(qInvites, (snapshot) => {
      let inviteFound = false;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.defenderId === auth.currentUser?.uid && data.status === 'pending') {
          setPendingDuelInvite({ id: docSnap.id, ...data });
          inviteFound = true;
        }
      });
      if (!inviteFound) {
        setPendingDuelInvite(null);
      }
    });

    return () => {
      unsubscribeInvites();
    };
  }, []);

  useEffect(() => {
    if (!activeDuelId || !auth.currentUser) return;

    const docRef = doc(db, 'pvp_duels', activeDuelId);
    const unsubscribeDuel = onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      const isChallenger = data.challengerId === auth.currentUser?.uid;

      if (data.status === 'rejected') {
        triggerNotification(`⚔️ Duelo rechazado por ${isChallenger ? data.defenderName : data.challengerName}.`);
        setActiveDuelId(null);
        setPvpDuel(null);
        return;
      }

      setPvpDuel({
        inCombat: data.status === 'active' || data.status === 'finished',
        rivalName: isChallenger ? data.defenderName : data.challengerName,
        rivalId: isChallenger ? data.defenderId : data.challengerId,
        rivalHp: isChallenger ? data.defenderHp : data.challengerHp,
        rivalMaxHp: isChallenger ? data.defenderMaxHp : data.challengerMaxHp,
        rivalShield: isChallenger ? data.defenderShield : data.challengerShield,
        playerHp: isChallenger ? data.challengerHp : data.defenderHp,
        playerMaxHp: isChallenger ? data.challengerMaxHp : data.defenderMaxHp,
        playerShield: isChallenger ? data.challengerShield : data.defenderShield,
        logs: data.logs || []
      });

      if (data.status === 'finished') {
        // Resolve loot drop on defeat / claim loot on victory
        const isWinner = data.winnerId === auth.currentUser?.uid;
        
        if (isWinner) {
          const enemyLoot = isChallenger ? data.defenderLoot : data.challengerLoot;
          if (enemyLoot) {
            setTempBag(prevBag => {
              const mergedBag = JSON.parse(JSON.stringify(prevBag)) as GatheringInventory;
              const mats = ['wood', 'stone', 'metal', 'essence'] as const;
              const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
              mats.forEach(m => {
                rarities.forEach(r => {
                  if (enemyLoot[m] && enemyLoot[m][r]) {
                    mergedBag[m][r] += enemyLoot[m][r];
                  }
                });
              });
              return mergedBag;
            });
          }
          triggerNotification(`🏆 ¡VICTORIA EXQUISITA! Has vencido y absorbido el botín de ${isChallenger ? data.defenderName : data.challengerName}.`);
        } else if (data.winnerId === 'draw') {
          setTempBag({
            wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
            stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
            metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
            essence: { common: 0, rare: 0, epic: 0, legendary: 0 }
          });
          setCurrentMap('cabin');
          triggerNotification("💀 Duelo empatado. Ambos han colapsado y perdido sus recursos en la bruma.");
        } else {
          setTempBag({
            wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
            stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
            metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
            essence: { common: 0, rare: 0, epic: 0, legendary: 0 }
          });
          setCurrentMap('cabin');
          triggerNotification(`💀 Has sido derrotado por ${isChallenger ? data.defenderName : data.challengerName}. Perdiste todos tus recursos temporales.`);
        }

        setTimeout(() => {
          setActiveDuelId(null);
          setPvpDuel(null);
        }, 5000);
      }
    });

    return () => {
      unsubscribeDuel();
    };
  }, [activeDuelId]);

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

  const handleStartExtraction = () => {
    if (extractionActive || !hasItemsInTempBag()) return;
    
    setExtractionActive(true);
    setExtractionTimeLeft(15);
    triggerNotification("🚀 Secuencia de extracción iniciada. ¡Defiende la zona!");

    // Play initial portal sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(350, audioCtx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.85);
    } catch (_) {}
  };

  const triggerPvPAmbush = () => {
    setActiveOverlay('arena');
  };

  const handleDefeatInArena = () => {
    if (currentMap === 'map3') {
      setTempBag({
        wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
        stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
        metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
        essence: { common: 0, rare: 0, epic: 0, legendary: 0 }
      });
      setCurrentMap('cabin');
      triggerNotification("💀 Has sido derrotado en combate en la Zona Roja. Perdiste toda tu mochila temporal y fuiste teletransportado a la cabaña.");
    }
    setActiveOverlay('none');
  };

  // Countdown controller for extraction
  useEffect(() => {
    if (!extractionActive) return;

    if (extractionTimeLeft <= 0) {
      // SUCCESSFUL EXTRACTION!
      setExtractionActive(false);
      handleBankResourcesDirectly(); // secure resources to inventory!
      setCurrentMap('lobby'); // return player safely to Lobby
      triggerNotification("🏆 ¡Extracción exitosa! Tus recursos han sido almacenados de forma segura en el almacén.");
      
      // Play chiptune win sound
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3); // G5
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.45); // C6
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.85);
      } catch (_) {}
      return;
    }

    // Check if player moved out of extraction zone (Faro coordinates x:0, z:-10)
    const distanceToBeacon = Math.sqrt(Math.pow(playerX, 2) + Math.pow(playerZ - (-10), 2));
    if (distanceToBeacon > 5.5) {
      setExtractionActive(false);
      setExtractionTimeLeft(0);
      triggerNotification("⚠️ Extracción fallida: saliste de la zona de seguridad del faro.");
      return;
    }

    // Interval to countdown
    const timerId = setTimeout(() => {
      if (pvpDuel?.inCombat || activeOverlay === 'arena') return; // pause countdown during battles!
      
      // 40% chance of rogue ambush every 4 seconds
      if (extractionTimeLeft % 4 === 0 && Math.random() < 0.40) {
        triggerPvPAmbush();
        triggerNotification("🚨 ¡EMBOSCADA! Enemigos de Bruma interfieren con la extracción.");
      }
      setExtractionTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [extractionActive, extractionTimeLeft, playerX, playerZ, pvpDuel?.inCombat, activeOverlay]);


  // Three.js dynamic rendering cycle loops
  useEffect(() => {
    if (!mountRef.current) return;

    // Dimensions
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Atmospheric Fog depending on current zone
    if (currentMap === 'cabin') {
      scene.background = new THREE.Color(0x0e101f);
      scene.fog = new THREE.FogExp2(0x0e101f, 0.08);
    } else if (currentMap === 'neighborhood') {
      scene.background = new THREE.Color(0x111625);
      scene.fog = new THREE.FogExp2(0x111625, 0.025);
    } else if (currentMap === 'lobby') {
      scene.background = new THREE.Color(0x0a0c16);
      scene.fog = new THREE.FogExp2(0x0a0c16, 0.03);
    } else if (currentMap === 'map1') {
      scene.background = new THREE.Color(0x0b1319);
      scene.fog = new THREE.FogExp2(0x0b1319, 0.04);
    } else if (currentMap === 'map2') {
      scene.background = new THREE.Color(0x13121b);
      scene.fog = new THREE.FogExp2(0x13121b, 0.035);
    } else { // MAP 3 - RED ZONE
      scene.background = new THREE.Color(0x230910);
      scene.fog = new THREE.FogExp2(0x230910, 0.045);
    }

    // Camera
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 100);
    cameraRef.current = camera;
    scene.add(camera);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfcf8f2, 0.85);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Create Floor Grid and Landscape representation
    const floorGeo = new THREE.PlaneGeometry(80, 80, 20, 20);
    floorGeo.rotateX(-Math.PI / 2);

    let floorColor = 0x242b40;
    if (currentMap === 'cabin') floorColor = 0x1f1929; // Wood tiles
    else if (currentMap === 'neighborhood') floorColor = 0x1a2e26; // Grassy green
    else if (currentMap === 'lobby') floorColor = 0x222638; // Stone pavement
    else if (currentMap === 'map1') floorColor = 0x132a1e; // Mystic velvet forest
    else if (currentMap === 'map2') floorColor = 0x201c24; // Rocky quarry
    else if (currentMap === 'map3') floorColor = 0x3d0b13; // Volcanic crimson ground

    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: 0.8,
      metalness: 0.2,
      wireframe: false
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    scene.add(floorMesh);

    // In Map 3, draw the Extraction Beacon
    let extractionBeaconMesh: THREE.Mesh | null = null;
    let extractionZoneRing: THREE.Mesh | null = null;
    let extractionShieldMesh: THREE.Mesh | null = null;

    if (currentMap === 'map3') {
      // Beacon pole
      const poleGeo = new THREE.CylinderGeometry(0.2, 0.25, 3.5, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
      extractionBeaconMesh = new THREE.Mesh(poleGeo, poleMat);
      extractionBeaconMesh.position.set(0, 1.75, -10);
      scene.add(extractionBeaconMesh);

      // Glowing light at the top of the beacon
      const lightGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const lightMat = new THREE.MeshBasicMaterial({
        color: extractionActive ? 0x10b981 : 0xef4444,
      });
      const topLight = new THREE.Mesh(lightGeo, lightMat);
      topLight.position.y = 1.85;
      extractionBeaconMesh.add(topLight);

      // Ring showing extraction bounds
      const zoneGeo = new THREE.RingGeometry(4.9, 5.0, 32);
      zoneGeo.rotateX(-Math.PI / 2);
      const zoneMat = new THREE.MeshBasicMaterial({
        color: extractionActive ? 0x10b981 : 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });
      extractionZoneRing = new THREE.Mesh(zoneGeo, zoneMat);
      extractionZoneRing.position.set(0, 0.05, -10);
      scene.add(extractionZoneRing);

      // Transparent shield dome when active
      if (extractionActive) {
        const shieldGeo = new THREE.SphereGeometry(5.0, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2);
        const shieldMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide
        });
        extractionShieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        extractionShieldMesh.position.set(0, 0, -10);
        scene.add(extractionShieldMesh);
      }
    }

    // Render floor grids details
    const gridHelper = new THREE.GridHelper(80, 40, 0xdec1ac, 0x3e425e);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Render Walls if inside Cabin
    if (currentMap === 'cabin') {
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x110f17, roughness: 0.9 });
      
      // Front Wall
      const wf = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 0.5), wallMat);
      wf.position.set(0, 3, -5.5);
      scene.add(wf);

      // Back Wall
      const wb = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 0.5), wallMat);
      wb.position.set(0, 3, 6.5);
      scene.add(wb);

      // Left Wall
      const wl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 12), wallMat);
      wl.position.set(-5.5, 3, 0);
      scene.add(wl);

      // Right Wall
      const wr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 12), wallMat);
      wr.position.set(5.5, 3, 0);
      scene.add(wr);
    }

    // Geometries repository for interactive nodes
    const activeMeshes: THREE.Mesh[] = [];

    activeNodes.forEach(node => {
      let geo: THREE.BufferGeometry;
      let mat: THREE.Material;

      if (node.type === 'tree') {
        // Simple elegant 3D vector styling
        geo = new THREE.ConeGeometry(1.6, 3.5, 6);
        mat = new THREE.MeshStandardMaterial({
          color: node.rarity === 'legendary' ? 0xffea70 : node.rarity === 'epic' ? 0xc084fc : node.rarity === 'rare' ? 0x60a5fa : 0x34d399,
          roughness: 0.5,
          emissive: node.rarity === 'legendary' ? 0x221100 : 0x000000
        });
      } else if (node.type === 'ore') {
        geo = new THREE.IcosahedronGeometry(1.2, 0);
        mat = new THREE.MeshStandardMaterial({
          color: node.rarity === 'legendary' ? 0xffb700 : node.rarity === 'epic' ? 0x47e6ff : node.rarity === 'rare' ? 0xcfcfcf : 0x94a3b8,
          roughness: 0.2,
          metalness: 0.8
        });
      } else if (node.type === 'synth') {
        geo = new THREE.BoxGeometry(1.8, 1.2, 1);
        mat = new THREE.MeshStandardMaterial({ color: 0xdec1ac, roughness: 0.1, emissive: 0x331a00 });
      } else if (node.type === 'anvil') {
        geo = new THREE.BoxGeometry(1.4, 0.8, 0.8);
        mat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
      } else if (node.type === 'bookshelf') {
        geo = new THREE.BoxGeometry(1.5, 2.5, 0.6);
        mat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
      } else if (node.type === 'nitz_npc') {
        geo = new THREE.SphereGeometry(0.9, 8, 8);
        // Custom companion aura paint
        mat = new THREE.MeshStandardMaterial({ color: currentDominant.colorHex, roughness: 0.1, emissive: currentDominant.colorHex, emissiveIntensity: 0.5 });
      } else if (node.type === 'house_plot') {
        // Neighborhood houses
        geo = new THREE.BoxGeometry(4, 3, 4);
        mat = new THREE.MeshStandardMaterial({ color: 0x2a2845, roughness: 0.6 });
      } else { // portals or doors
        geo = new THREE.TorusGeometry(1.5, 0.2, 8, 24);
        mat = new THREE.MeshStandardMaterial({ color: 0x6366f1, emissive: 0x312e81 });
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(node.x, node.type === 'bookshelf' || node.type === 'house_plot' ? 1.4 : node.type === 'tree' ? 1.75 : 0.6, node.z);
      mesh.name = node.id;
      scene.add(mesh);
      activeMeshes.push(mesh);
      
      // If house_plot or tree, add a chimney cylinder or roof cone
      if (node.type === 'house_plot') {
        const roofGeo = new THREE.ConeGeometry(3.5, 2, 4);
        roofGeo.rotateY(Math.PI/4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x582c3c });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(node.x, 3.9, node.z);
        scene.add(roof);
      }
    });

    // Define colors dictionary for emotion mappings
    const colorsDict: Record<EmotionName, number> = {
      Ira: 0xef4444, Miedo: 0xa855f7, Tristeza: 0x3b82f6, Alegría: 0xfacc15,
      Confianza: 0x4ade80, Sorpresa: 0xf472b6, Amor: 0xf43f5e, Orgullo: 0xf97316, Serenidad: 0x22d3ee
    };

    // Populate actual online peers dynamically in tick loop via onlinePlayersRef to prevent scene re-creation
    const peerMeshes: { id: string; mesh: THREE.Mesh; companionMesh?: THREE.Mesh | null; activeNitzName?: string; companionSummoned?: boolean }[] = [];

    // Render Summoned Nitz Companion in open maps
    let companionMesh: THREE.Mesh | null = null;
    let companionRing: THREE.Mesh | null = null;
    if (progress.companionSummoned && currentMap !== 'cabin') {
      const nitzGeo = new THREE.SphereGeometry(0.45, 16, 16);
      let nCol = currentDominant.colorHex;
      if (progress.avatar.name === "Nitz Ígneo") nCol = 0xef4444; // Fire Red
      else if (progress.avatar.name === "Nitz Abisal") nCol = 0x8b5cf6; // Void Purple

      const nitzMat = new THREE.MeshStandardMaterial({
        color: nCol,
        roughness: 0.1,
        emissive: nCol,
        emissiveIntensity: 0.45
      });
      companionMesh = new THREE.Mesh(nitzGeo, nitzMat);
      companionMesh.position.set(playerX + 1.2, 1.2, playerZ - 1.2);
      scene.add(companionMesh);
      companionMeshRef.current = companionMesh;

      const ringGeo = new THREE.TorusGeometry(0.6, 0.02, 4, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: nCol, transparent: true, opacity: 0.7 });
      companionRing = new THREE.Mesh(ringGeo, ringMat);
      companionRing.rotation.x = Math.PI / 2;
      companionMesh.add(companionRing);
      companionRingRef.current = companionRing;
    } else {
      companionMeshRef.current = null;
      companionRingRef.current = null;
    }

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Viewport mouse dragging or pointer-lock to rotate CAMERA
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      try {
        renderer.domElement.requestPointerLock();
      } catch (_) {}

      // Request fullscreen on user click gesture
      try {
        const docEl = document.documentElement;
        if (!document.fullscreenElement) {
          if (docEl.requestFullscreen) docEl.requestFullscreen();
          else if ((docEl as any).webkitRequestFullscreen) (docEl as any).webkitRequestFullscreen();
          else if ((docEl as any).mozRequestFullScreen) (docEl as any).mozRequestFullScreen();
          else if ((docEl as any).msRequestFullscreen) (docEl as any).msRequestFullscreen();
        }
      } catch (_) {}

      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const isLocked = document.pointerLockElement === renderer.domElement;
      if (isLocked) {
        const deltaX = e.movementX;
        const deltaY = e.movementY;
        setCameraAngle(prev => prev + deltaX * 0.003);
        setCameraPitch(prev => Math.max(-0.75, Math.min(0.75, prev - deltaY * 0.003)));
      } else {
        if (!isDragging) return;
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        setCameraAngle(prev => prev + deltaX * 0.0055);
        setCameraPitch(prev => Math.max(-0.6, Math.min(0.6, prev - deltaY * 0.0055)));
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    // Support touch drag to look around on mobile
    let prevTouchX = 0;
    let prevTouchY = 0;
    let isTouchLooking = false;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.joystick-container') || target.closest('.mobile-btn')) return;

      // Request fullscreen on user touch gesture
      try {
        const docEl = document.documentElement;
        if (!document.fullscreenElement) {
          if (docEl.requestFullscreen) docEl.requestFullscreen();
          else if ((docEl as any).webkitRequestFullscreen) (docEl as any).webkitRequestFullscreen();
          else if ((docEl as any).mozRequestFullScreen) (docEl as any).mozRequestFullScreen();
          else if ((docEl as any).msRequestFullscreen) (docEl as any).msRequestFullscreen();
        }
      } catch (_) {}

      isTouchLooking = true;
      if (e.touches.length > 0) {
        prevTouchX = e.touches[0].clientX;
        prevTouchY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchLooking || e.touches.length === 0) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - prevTouchX;
      const deltaY = touch.clientY - prevTouchY;
      prevTouchX = touch.clientX;
      prevTouchY = touch.clientY;

      setCameraAngle(prev => prev + deltaX * 0.006);
      setCameraPitch(prev => Math.max(-0.6, Math.min(0.6, prev - deltaY * 0.006)));
    };

    const handleTouchEnd = () => {
      isTouchLooking = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('touchstart', handleTouchStart, { passive: true });
    dom.addEventListener('touchmove', handleTouchMove, { passive: true });
    dom.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Animation frames loop
    let animId = 0;
    let timer = 0;

    const tick = () => {
      timer += 0.04;
      animId = requestAnimationFrame(tick);

      // Float companion Nitz dynamically if in Cabin
      activeMeshes.forEach(m => {
        if (m.name === 'companion_nitz') {
          m.position.y = 1.0 + Math.sin(timer * 2.2) * 0.22;
          m.rotation.y += 0.015;
        } else if (m.name === 'road_to_lobby' || m.name.startsWith('gate_') || m.name === 'portal_arena' || m.name === 'map3_exit' || m.name === 'map2_exit' || m.name === 'map1_exit') {
          m.rotation.z += 0.01;
        }
      });

      // Animate summoned companion follow behavior
      if (companionMesh) {
        let targetX = cameraRef.current ? cameraRef.current.position.x - Math.sin(cameraAngle) * 1.5 + Math.cos(cameraAngle) * 1.1 : playerX - Math.sin(cameraAngle) * 1.5 + Math.cos(cameraAngle) * 1.1;
        let targetZ = cameraRef.current ? cameraRef.current.position.z + Math.cos(cameraAngle) * 1.5 + Math.sin(cameraAngle) * 1.1 : playerZ + Math.cos(cameraAngle) * 1.5 + Math.sin(cameraAngle) * 1.1;
        let targetY = 1.35 + Math.sin(timer * 2.5) * 0.18;

        if (strikeNodeRef.current) {
          targetX = strikeNodeRef.current.x;
          targetZ = strikeNodeRef.current.z;
          targetY = 1.0;
        }

        companionMesh.position.x += (targetX - companionMesh.position.x) * 0.08;
        companionMesh.position.z += (targetZ - companionMesh.position.z) * 0.08;
        companionMesh.position.y += (targetY - companionMesh.position.y) * 0.08;

        companionMesh.rotation.y += 0.025;
        if (companionRing) {
          companionRing.rotation.z -= 0.015;
        }
      }

      // Pulse extraction shield
      if (extractionShieldMesh) {
        const scale = 1.0 + Math.sin(timer * 5) * 0.012;
        extractionShieldMesh.scale.set(scale, scale, scale);
      }

      // 1. Manage peer meshes dynamically based on onlinePlayersRef.current to prevent scene tear-downs
      const currentPeers = onlinePlayersRef.current.filter(p => p.currentMap === currentMap);

      // Despawn peers that left or changed maps
      for (let i = peerMeshes.length - 1; i >= 0; i--) {
        const pm = peerMeshes[i];
        const stillOnline = currentPeers.find(p => p.id === pm.id);
        if (!stillOnline) {
          scene.remove(pm.mesh);
          if (pm.companionMesh) scene.remove(pm.companionMesh);
          peerMeshes.splice(i, 1);
          // Hide its nameplate
          const el = document.getElementById(`nameplate-${pm.id}`);
          if (el) el.style.display = 'none';
        }
      }

      // Spawn or update peers in 3D
      currentPeers.forEach(peer => {
        let pm = peerMeshes.find(p => p.id === peer.id);
        const col = colorsDict[peer.dominantEmotion] || 0xffffff;

        if (!pm) {
          // Render peer as a gorgeous floating octahedron
          const peerGeo = new THREE.OctahedronGeometry(0.8, 0);
          const peerMat = new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.5,
            roughness: 0.1,
            metalness: 0.8
          });
          const mesh = new THREE.Mesh(peerGeo, peerMat);
          mesh.position.set(peer.posX || 0, 1.2, peer.posZ || 0);
          scene.add(mesh);

          // Render peer's companion Nitz if companionSummoned is true
          let peerNitzMesh: THREE.Mesh | null = null;
          if (peer.companionSummoned) {
            const cGeo = new THREE.SphereGeometry(0.3, 12, 12);
            let nCol = col;
            if (peer.activeNitzName === "Nitz Ígneo") nCol = 0xef4444; // Fire Red
            else if (peer.activeNitzName === "Nitz Abisal") nCol = 0x8b5cf6; // Void Purple

            const cMat = new THREE.MeshStandardMaterial({
              color: nCol,
              emissive: nCol,
              emissiveIntensity: 0.45,
              roughness: 0.15
            });
            peerNitzMesh = new THREE.Mesh(cGeo, cMat);
            peerNitzMesh.position.set((peer.posX || 0) + 0.8, 1.0, (peer.posZ || 0) - 0.8);
            scene.add(peerNitzMesh);
          }

          pm = {
            id: peer.id,
            mesh,
            companionMesh: peerNitzMesh,
            activeNitzName: peer.activeNitzName,
            companionSummoned: peer.companionSummoned
          };
          peerMeshes.push(pm);
        } else {
          // Update colors / presence of companion mesh dynamically if summoned state or type changed
          if (pm.companionSummoned !== peer.companionSummoned || pm.activeNitzName !== peer.activeNitzName) {
            if (pm.companionMesh) {
              scene.remove(pm.companionMesh);
              pm.companionMesh = null;
            }
            if (peer.companionSummoned) {
              const cGeo = new THREE.SphereGeometry(0.3, 12, 12);
              let nCol = col;
              if (peer.activeNitzName === "Nitz Ígneo") nCol = 0xef4444;
              else if (peer.activeNitzName === "Nitz Abisal") nCol = 0x8b5cf6;

              const cMat = new THREE.MeshStandardMaterial({
                color: nCol,
                emissive: nCol,
                emissiveIntensity: 0.45,
                roughness: 0.15
              });
              pm.companionMesh = new THREE.Mesh(cGeo, cMat);
              pm.companionMesh.position.copy(pm.mesh.position).add(new THREE.Vector3(0.8, -0.2, -0.8));
              scene.add(pm.companionMesh);
            }
            pm.companionSummoned = peer.companionSummoned;
            pm.activeNitzName = peer.activeNitzName;
          }
        }

        // Smoothly interpolate (lerp) peer mesh position
        const targetX = peer.posX || 0;
        const targetZ = peer.posZ || 0;
        pm.mesh.position.x += (targetX - pm.mesh.position.x) * 0.15;
        pm.mesh.position.z += (targetZ - pm.mesh.position.z) * 0.15;
        
        // Float peer vertically
        pm.mesh.position.y = 1.2 + Math.sin(timer * 2.1 + pm.mesh.position.x) * 0.15;
        
        // Lerp/apply facing angle
        if (peer.facingAngle !== undefined) {
          pm.mesh.rotation.y = peer.facingAngle;
        } else {
          pm.mesh.rotation.y += 0.02;
        }

        // Animate peer companion follow behavior trailing behind the peer mesh
        if (pm.companionMesh) {
          const angle = peer.facingAngle !== undefined ? peer.facingAngle : pm.mesh.rotation.y;
          const compTargetX = pm.mesh.position.x - Math.sin(angle) * 1.1;
          const compTargetZ = pm.mesh.position.z + Math.cos(angle) * 1.1;
          const compTargetY = pm.mesh.position.y + Math.sin(timer * 3.0) * 0.12;

          pm.companionMesh.position.x += (compTargetX - pm.companionMesh.position.x) * 0.1;
          pm.companionMesh.position.z += (compTargetZ - pm.companionMesh.position.z) * 0.1;
          pm.companionMesh.position.y += (compTargetY - pm.companionMesh.position.y) * 0.1;
          
          pm.companionMesh.rotation.y += 0.03;
        }
      });

      // Project peer nameplates from 3D coordinates to 2D screen space
      const tempV = new THREE.Vector3();
      peerMeshes.forEach(pm => {
        tempV.setFromMatrixPosition(pm.mesh.matrixWorld);
        tempV.y += 1.25; // position nameplate slightly above the mesh
        tempV.project(camera);

        const el = document.getElementById(`nameplate-${pm.id}`);
        if (el) {
          const isBehind = tempV.z > 1;
          if (isBehind) {
            el.style.display = 'none';
          } else {
            const screenX = (tempV.x * 0.5 + 0.5) * width;
            const screenY = (-(tempV.y * 0.5) + 0.5) * height;

            el.style.display = 'flex';
            el.style.left = `${screenX}px`;
            el.style.top = `${screenY}px`;

            // Adjust opacity dynamically based on distance to player camera
            const dist = camera.position.distanceTo(pm.mesh.position);
            const maxDist = 40;
            if (dist > maxDist) {
              el.style.opacity = '0';
              el.style.pointerEvents = 'none';
            } else {
              el.style.opacity = String(1.0 - (dist / maxDist) * 0.65);
            }
          }
        }
      });

      renderer.render(scene, camera);
    };

    tick();

    // Handle container resizing securely with ResizeObserver
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    
    const ob = new ResizeObserver(handleResize);
    ob.observe(mountRef.current);

    return () => {
      cancelAnimationFrame(animId);
      ob.disconnect();
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('touchstart', handleTouchStart);
      dom.removeEventListener('touchmove', handleTouchMove);
      dom.removeEventListener('touchend', handleTouchEnd);
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [currentMap, activeNodes, progress.companionSummoned, extractionActive, progress.avatar.name]);

  // Motion processing cycle (frame controller loops updating coordinates)
  useEffect(() => {
    let loopId = 0;
    let lastTime = performance.now();

    const moveLoop = () => {
      loopId = requestAnimationFrame(moveLoop);

      const now = performance.now();
      let dt = (now - lastTime) / 1000; // delta time in seconds
      lastTime = now;

      // Cap delta time to prevent giant jumps (e.g. tab switches)
      if (dt > 0.1) dt = 0.1;

      // Speed metrics: 4.5 units per second base speed
      const baseSpeed = 4.5;
      const isRunning = keysRef.current['shift'];
      const runMultiplier = 1.8;
      const moveSpeed = baseSpeed * (isRunning ? runMultiplier : 1.0) * dt;

      // Read values from refs to ensure frame-rate independence and prevent effect stutters
      const angle = cameraAngleRef.current;
      const pitch = cameraPitchRef.current;
      const curX = playerXRef.current;
      const curZ = playerZRef.current;

      let dx = 0;
      let dz = 0;

      // WASD / Arrow checks
      if (keysRef.current['w'] || keysRef.current['arrowup']) {
        dx += Math.sin(angle);
        dz -= Math.cos(angle);
      }
      if (keysRef.current['s'] || keysRef.current['arrowdown']) {
        dx -= Math.sin(angle);
        dz += Math.cos(angle);
      }
      if (keysRef.current['a'] || keysRef.current['arrowleft']) {
        dx -= Math.cos(angle);
        dz -= Math.sin(angle);
      }
      if (keysRef.current['d'] || keysRef.current['arrowright']) {
        dx += Math.cos(angle);
        dz += Math.sin(angle);
      }

      // Normalize movement vector to prevent diagonal speedup
      const length = Math.sqrt(dx * dx + dz * dz);
      if (length > 0) {
        dx = (dx / length) * moveSpeed;
        dz = (dz / length) * moveSpeed;
      }

      // Safe bound clamps
      let limitValue = 38;
      if (currentMap === 'cabin') limitValue = 5;

      let nextX = Math.max(-limitValue, Math.min(limitValue, curX + dx));
      let nextZ = Math.max(-limitValue, Math.min(limitValue, curZ + dz));

      // JUMP PHYSICS (Space triggers jump)
      const gravity = -18.0; // gravity acceleration
      const jumpImpulse = 6.0; // upward jump impulse

      if (keysRef.current[' '] && !isJumpingRef.current) {
        velocityYRef.current = jumpImpulse;
        isJumpingRef.current = true;
      }

      if (isJumpingRef.current) {
        velocityYRef.current += gravity * dt;
        playerYRef.current += velocityYRef.current * dt;

        // Ground collision check
        if (playerYRef.current <= 1.6) {
          playerYRef.current = 1.6;
          velocityYRef.current = 0;
          isJumpingRef.current = false;
        }
      }

      // Calculate proximity to interactive nodes
      let foundNear: InteractiveNode3D | null = null;
      activeNodesRef.current.forEach(node => {
        const dist = Math.sqrt(Math.pow(nextX - node.x, 2) + Math.pow(nextZ - node.z, 2));
        if (dist < 2.5) {
          foundNear = node;
        }
      });

      // Update coordinate refs
      playerXRef.current = nextX;
      playerZRef.current = nextZ;

      setNearNode(foundNear);
      setPlayerX(nextX);
      setPlayerZ(nextZ);

      // Handle continuous camera view alignment
      if (cameraRef.current) {
        cameraRef.current.position.set(nextX, playerYRef.current, nextZ);
        
        // Pivot lookAt vector
        const lookX = nextX + Math.sin(angle);
        const lookZ = nextZ - Math.cos(angle);
        const lookY = playerYRef.current + Math.sin(pitch);
        cameraRef.current.lookAt(lookX, lookY, lookZ);
      }
    };

    moveLoop();
    return () => cancelAnimationFrame(loopId);
  }, [currentMap]);


  // Virtual keyboard buttons triggers
  const triggerMovementButton = (direction: 'forward' | 'backward' | 'left' | 'right') => {
    let dx = 0;
    let dz = 0;
    const step = 1.5;

    if (direction === 'forward') {
      dx += Math.sin(cameraAngle) * step;
      dz -= Math.cos(cameraAngle) * step;
    } else if (direction === 'backward') {
      dx -= Math.sin(cameraAngle) * step;
      dz += Math.cos(cameraAngle) * step;
    } else if (direction === 'left') {
      dx -= Math.cos(cameraAngle) * step;
      dz -= Math.sin(cameraAngle) * step;
    } else if (direction === 'right') {
      dx += Math.cos(cameraAngle) * step;
      dz += Math.sin(cameraAngle) * step;
    }

    let limitValue = 38;
    if (currentMap === 'cabin') limitValue = 5;

    let nextX = Math.max(-limitValue, Math.min(limitValue, playerX + dx));
    let nextZ = Math.max(-limitValue, Math.min(limitValue, playerZ + dz));

    // Calculate proximity
    let foundNear: InteractiveNode3D | null = null;
    activeNodes.forEach(node => {
      const dist = Math.sqrt(Math.pow(nextX - node.x, 2) + Math.pow(nextZ - node.z, 2));
      if (dist < 2.5) foundNear = node;
    });

    setNearNode(foundNear);
    setPlayerX(nextX);
    setPlayerZ(nextZ);
  };

  const triggerRotationButton = (dir: 'left' | 'right') => {
    const angleStep = 0.5; // rotate 30 degrees
    if (dir === 'left') setCameraAngle(prev => prev + angleStep);
    else setCameraAngle(prev => prev - angleStep);
  };


  // Interact on Near Node Trigger
  const handleInteractNearNode = async () => {
    if (!nearNode) return;

    // Trigger audio feedback chime
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (_) {}

    // Router
    if (nearNode.type === 'synth') {
      setActiveOverlay('syntonia');
    } else if (nearNode.type === 'anvil') {
      setActiveOverlay('crafting');
    } else if (nearNode.type === 'bookshelf') {
      setActiveOverlay('codex');
    } else if (nearNode.type === 'nitz_npc') {
      setActiveOverlay('interactive_pet_chat');
    } else if (nearNode.type === 'house_plot') {
      // Praise neighbor houseplot
      if (nearNode.plotOwnerId) {
        try {
          const neighborRef = doc(db, 'users', nearNode.plotOwnerId);
          await updateDoc(neighborRef, {
            likesCount: increment(1)
          });
          triggerNotification(`💖 ¡Has alabado la estética de la cabaña! Le otorgaste +1 Corazón al Nitz compañero.`);
        } catch (err) {
          console.error("Error giving companion heart:", err);
          triggerNotification("💖 ¡Has elogiado su cabaña! Vínculo afectuoso forjado con el vecino.");
        }
      }
    } else if (nearNode.type === 'door_vecindario') {
      setCurrentMap('neighborhood');
      triggerNotification("🏘️ Has entrado al Vecindario de la Aldea Estelar");
    } else if (nearNode.type === 'door_cabin') {
      setCurrentMap('cabin');
      triggerNotification("🏠 Entrando a tu Cabaña de Origen...");
    } else if (nearNode.type === 'door_lobby') {
      setCurrentMap('lobby');
      triggerNotification("💎 Entrando a la Gran Plaza Central del Lobby");
    } else if (nearNode.type === 'door_map1') {
      setCurrentMap('map1');
      triggerNotification("🌲 Has viajado al Bosque Seguro (Fácil/Seguro)");
    } else if (nearNode.type === 'door_map2') {
      setCurrentMap('map2');
      triggerNotification("🪨 Has viajado a la Cantera Estelar (Medio/Materiales)");
    } else if (nearNode.type === 'door_map3') {
      setCurrentMap('map3');
      triggerNotification("💀 ¡ALERTA! Has entrado a la Zona de Bruma de Sangre (Zona Roja: Elite/PvP)");
    } else if (nearNode.type === 'door_arena') {
      setActiveOverlay('arena');
    } else if (nearNode.type === 'tree' || nearNode.type === 'ore') {
      // Trigger Nitz companion strike animation in 3D
      if (progress.companionSummoned) {
        strikeNodeRef.current = nearNode;
        setTimeout(() => {
          strikeNodeRef.current = null;
        }, 800);
      }

      // Click mining actions directly in 3D
      setActiveNodes(prev => prev.map(n => {
        if (n.id === nearNode.id) {
          const nextClicks = (n.clicksCurrent || 0) + (progress.companionSummoned ? 2 : 1);
          const req = n.clicksRequired || 4;

          if (nextClicks >= req) {
            // Reward materials
            setTempBag(tb => {
              const b = { ...tb };
              const matType = n.type === 'tree' ? 'wood' : 'stone';
              const rarityValue = n.rarity || 'common';
              b[matType][rarityValue] += Math.floor(Math.random() * 2) + 1;
              return b;
            });

            // EXP
            const expVal = n.rarity === 'common' ? 4 : n.rarity === 'rare' ? 10 : n.rarity === 'epic' ? 22 : 45;
            onSaveProgress({
              ...progress,
              exp: progress.exp + expVal
            });

            triggerNotification(`⭐ ¡Nodo purificado${progress.companionSummoned ? ' con ayuda de tu Nitz' : ''}! Recibes materiales y +${expVal} EXP.`);
            return { ...n, clicksCurrent: 0 };
          }
          return { ...n, clicksCurrent: nextClicks };
        }
        return n;
      }));
    }
  };
  handleInteractNearNodeRef.current = handleInteractNearNode;

  // Launch PvP Duel vs other active player in Map 3 (Zona Roja)
  const handleLaunchPvPDuel = async (rival: OnlinePlayer) => {
    if (currentMap !== 'map3') return;
    if (!pvpEnabled) {
      triggerNotification("⚠️ Debes activar tu flag de Modo Hostíl para batallar en PvP");
      return;
    }
    if (!rival.pvpEnabled) {
      triggerNotification(`⚠️ El jugador ${rival.username} tiene la hostilidad apagada`);
      return;
    }

    const weapons = progress.craftedItems.filter(item => item.subType === 'weapon');
    const shields = progress.craftedItems.filter(item => item.subType === 'shield');
    const armors = progress.craftedItems.filter(item => item.subType === 'armor');

    const activeWeapon = progress.craftedItems.find(item => item.subType === 'weapon' && item.equipped) || weapons[0];
    const activeShield = progress.craftedItems.find(item => item.subType === 'shield' && item.equipped) || shields[0];
    const activeArmor = progress.craftedItems.find(item => item.subType === 'armor' && item.equipped) || armors[0];

    const cWeapon = activeWeapon ? activeWeapon.name : '';
    const cShieldItem = activeShield ? activeShield.name : '';
    const cArmor = activeArmor ? activeArmor.name : '';

    const newSession = {
      status: 'pending',
      challengerId: auth.currentUser!.uid,
      challengerName: progress.username || 'Guardián',
      challengerHp: 150 + progress.phase * 30,
      challengerMaxHp: 150 + progress.phase * 30,
      challengerShield: 80,
      challengerMaxShield: 80,
      challengerWeapon: cWeapon,
      challengerShieldItem: cShieldItem,
      challengerArmor: cArmor,
      challengerLoot: tempBag,

      defenderId: rival.id,
      defenderName: rival.username,
      defenderHp: 150 + rival.phase * 30,
      defenderMaxHp: 150 + rival.phase * 30,
      defenderShield: 80,
      defenderMaxShield: 80,
      defenderWeapon: '',
      defenderShieldItem: '',
      defenderArmor: '',

      logs: [`⚔️ ¡DUELO DE SABLES SOLICITADO! Has retado a ${rival.username} a un duelo territorial de sables en la bruma.`],
      createdAt: new Date().toISOString()
    };

    try {
      const pvpRef = collection(db, 'pvp_duels');
      const docRef = await addDoc(pvpRef, newSession);
      setActiveDuelId(docRef.id);
      triggerNotification("⚔️ Solicitud de duelo enviada. Esperando aceptación...");
    } catch (err) {
      console.error("Error creating duel challenge:", err);
      triggerNotification("⚠️ Error al crear desafío de duelo.");
    }
  };

  const handleAcceptDuel = async () => {
    if (!pendingDuelInvite) return;
    
    const docRef = doc(db, 'pvp_duels', pendingDuelInvite.id);
    const weapons = progress.craftedItems.filter(item => item.subType === 'weapon');
    const shields = progress.craftedItems.filter(item => item.subType === 'shield');
    const armors = progress.craftedItems.filter(item => item.subType === 'armor');

    const activeWeapon = progress.craftedItems.find(item => item.subType === 'weapon' && item.equipped) || weapons[0];
    const activeShield = progress.craftedItems.find(item => item.subType === 'shield' && item.equipped) || shields[0];
    const activeArmor = progress.craftedItems.find(item => item.subType === 'armor' && item.equipped) || armors[0];

    const dWeapon = activeWeapon ? activeWeapon.name : '';
    const dShieldItem = activeShield ? activeShield.name : '';
    const dArmor = activeArmor ? activeArmor.name : '';

    try {
      await updateDoc(docRef, {
        status: 'active',
        defenderWeapon: dWeapon,
        defenderShieldItem: dShieldItem,
        defenderArmor: dArmor,
        defenderLoot: tempBag,
        logs: arrayUnion(`⚔️ ${progress.username || 'Defender'} ha aceptado el duelo. ¡Que comience el combate!`)
      });
      setActiveDuelId(pendingDuelInvite.id);
      setPendingDuelInvite(null);
    } catch (err) {
      console.error("Error accepting duel:", err);
    }
  };

  const handleDeclineDuel = async () => {
    if (!pendingDuelInvite) return;
    const docRef = doc(db, 'pvp_duels', pendingDuelInvite.id);
    try {
      await updateDoc(docRef, {
        status: 'rejected'
      });
      setPendingDuelInvite(null);
    } catch (err) {
      console.error("Error declining duel:", err);
    }
  };

  const resolveDuelRound = async (docRef: any, data: any) => {
    const cId = data.challengerId;
    const dId = data.defenderId;
    let cHp = data.challengerHp;
    let dHp = data.defenderHp;
    let cShield = data.challengerShield;
    let dShield = data.defenderShield;
    
    const cAction = data.challengerAction;
    const dAction = data.defenderAction;

    const cWeapon = data.challengerWeapon || '';
    const cShieldItem = data.challengerShieldItem || '';
    const cArmor = data.challengerArmor || '';

    const dWeapon = data.defenderWeapon || '';
    const dShieldItem = data.defenderShieldItem || '';
    const dArmor = data.defenderArmor || '';

    const logs: string[] = [...(data.logs || [])];
    logs.push(`--- RONDA RESOLUCIÓN ---`);

    let cBurn = data.challengerBurnTicks || 0;
    let dBurn = data.defenderBurnTicks || 0;
    let cMit = data.challengerMitigation || false;
    let dMit = data.defenderMitigation || false;

    // Challenger Action Resolution
    let cDmg = 0;
    let cShieldRegen = 0;
    let cHeal = 0;
    let cLog = '';

    if (cAction === 'attack') {
      if (cWeapon.includes('Sable del Alba')) {
        cDmg = 110;
        dBurn = 2;
        cLog = `⚔️ ${data.challengerName} desata [IRA SOLAR] con Sable del Alba Legendario (110 daño + 2 turnos de quemadura).`;
      } else if (cWeapon.includes('Mandoble')) {
        cDmg = 70;
        dShield = Math.max(0, dShield - 15);
        cLog = `⚔️ ${data.challengerName} ejecuta [TAJO SOMBRÍO] con Mandoble de Bruma Astral (70 daño + drena 15 de escudo).`;
      } else {
        cDmg = 40;
        cLog = `⚔️ ${data.challengerName} ataca con [CORTE RÁPIDO] (40 daño).`;
      }
    } else if (cAction === 'shield') {
      if (cShieldItem.includes('Estelares')) {
        cShieldRegen = 50;
        cLog = `🛡️ ${data.challengerName} activa [BARRERA RÚNICA] (+50 Escudo).`;
      } else {
        cShieldRegen = 30;
        cLog = `🛡️ ${data.challengerName} levanta [GUARDIA SIMPLE] (+30 Escudo).`;
      }
    } else if (cAction === 'armor') {
      if (cArmor.includes('Escamas')) {
        cMit = true;
        cHeal = 45;
        cLog = `🛡️ ${data.challengerName} endurece su [ESCAMA SAGRADA] (+45 HP, mitigará 50% de daño en este turno).`;
      } else {
        cHeal = 25;
        cLog = `🛡️ ${data.challengerName} se refugia con [REFUGIO COMÚN] (+25 HP).`;
      }
    }

    // Defender Action Resolution
    let dDmg = 0;
    let dShieldRegen = 0;
    let dHeal = 0;
    let dLog = '';

    if (dAction === 'attack') {
      if (dWeapon.includes('Sable del Alba')) {
        dDmg = 110;
        cBurn = 2;
        dLog = `⚔️ ${data.defenderName} desata [IRA SOLAR] con Sable del Alba Legendario (110 daño + 2 turnos de quemadura).`;
      } else if (dWeapon.includes('Mandoble')) {
        dDmg = 70;
        cShield = Math.max(0, cShield - 15);
        dLog = `⚔️ ${data.defenderName} ejecuta [TAJO SOMBRÍO] con Mandoble de Bruma Astral (70 daño + drena 15 de escudo).`;
      } else {
        dDmg = 40;
        dLog = `⚔️ ${data.defenderName} ataca con [CORTE RÁPIDO] (40 daño).`;
      }
    } else if (dAction === 'shield') {
      if (dShieldItem.includes('Estelares')) {
        dShieldRegen = 50;
        dLog = `🛡️ ${data.defenderName} activa [BARRERA RÚNICA] (+50 Escudo).`;
      } else {
        dShieldRegen = 30;
        dLog = `🛡️ ${data.defenderName} levanta [GUARDIA SIMPLE] (+30 Escudo).`;
      }
    } else if (dAction === 'armor') {
      if (dArmor.includes('Escamas')) {
        dMit = true;
        dHeal = 45;
        dLog = `🛡️ ${data.defenderName} endurece su [ESCAMA SAGRADA] (+45 HP, mitigará 50% de daño en este turno).`;
      } else {
        dHeal = 25;
        dLog = `🛡️ ${data.defenderName} se refugia con [REFUGIO COMÚN] (+25 HP).`;
      }
    }

    logs.push(cLog);
    logs.push(dLog);

    // Apply heals
    cHp = Math.min(data.challengerMaxHp, cHp + cHeal);
    dHp = Math.min(data.defenderMaxHp, dHp + dHeal);

    // Apply shields
    cShield = Math.min(data.challengerMaxShield, cShield + cShieldRegen);
    dShield = Math.min(data.defenderMaxShield, dShield + dShieldRegen);

    // Apply damage to Defender
    if (cDmg > 0) {
      let finalDmg = cDmg;
      if (dMit) finalDmg = Math.floor(finalDmg * 0.5);
      let absorbed = 0;
      if (dShield > 0) {
        if (dShield >= finalDmg) {
          dShield -= finalDmg;
          absorbed = finalDmg;
          finalDmg = 0;
        } else {
          absorbed = dShield;
          finalDmg -= dShield;
          dShield = 0;
        }
      }
      dHp = Math.max(0, dHp - finalDmg);
      logs.push(`💥 ${data.defenderName} recibe ${cDmg} daño total (${absorbed > 0 ? `${absorbed} absorbido por escudo, ` : ''}${finalDmg} restado de HP).`);
    }

    // Apply damage to Challenger
    if (dDmg > 0) {
      let finalDmg = dDmg;
      if (cMit) finalDmg = Math.floor(finalDmg * 0.5);
      let absorbed = 0;
      if (cShield > 0) {
        if (cShield >= finalDmg) {
          cShield -= finalDmg;
          absorbed = finalDmg;
          finalDmg = 0;
        } else {
          absorbed = cShield;
          finalDmg -= cShield;
          cShield = 0;
        }
      }
      cHp = Math.max(0, cHp - finalDmg);
      logs.push(`💥 ${data.challengerName} recibe ${dDmg} daño total (${absorbed > 0 ? `${absorbed} absorbido por escudo, ` : ''}${finalDmg} restado de HP).`);
    }

    // Apply burn damage
    if (cBurn > 0) {
      cHp = Math.max(0, cHp - 15);
      cBurn--;
      logs.push(`🔥 Quemadura solar inflige 15 de daño continuo a ${data.challengerName}. Ticks restantes: ${cBurn}`);
    }
    if (dBurn > 0) {
      dHp = Math.max(0, dHp - 15);
      dBurn--;
      logs.push(`🔥 Quemadura solar inflige 15 de daño continuo a ${data.defenderName}. Ticks restantes: ${dBurn}`);
    }

    let status = 'active';
    let winnerId = '';
    if (cHp <= 0 && dHp <= 0) {
      status = 'finished';
      winnerId = 'draw';
      logs.push("💀 Duelo finalizado. Ambos combatientes han colapsado en la bruma.");
    } else if (cHp <= 0) {
      status = 'finished';
      winnerId = dId;
      logs.push(`🏆 ¡Combate terminado! ${data.defenderName} derrota a ${data.challengerName}.`);
    } else if (dHp <= 0) {
      status = 'finished';
      winnerId = cId;
      logs.push(`🏆 ¡Combate terminado! ${data.challengerName} derrota a ${data.defenderName}.`);
    }

    await updateDoc(docRef, {
      challengerHp: cHp,
      defenderHp: dHp,
      challengerShield: cShield,
      defenderShield: dShield,
      challengerAction: '',
      defenderAction: '',
      challengerBurnTicks: cBurn,
      defenderBurnTicks: dBurn,
      challengerMitigation: false,
      defenderMitigation: false,
      logs,
      status,
      winnerId
    });
  };

  const playPvPRound = async (action: 'attack' | 'shield' | 'armor') => {
    if (!activeDuelId) return;

    const docRef = doc(db, 'pvp_duels', activeDuelId);
    try {
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      const isChallenger = data.challengerId === auth.currentUser?.uid;

      if (isChallenger && data.challengerAction) {
        triggerNotification("⏳ Esperando acción del oponente...");
        return;
      }
      if (!isChallenger && data.defenderAction) {
        triggerNotification("⏳ Esperando acción del oponente...");
        return;
      }

      if (isChallenger) {
        await updateDoc(docRef, { challengerAction: action });
      } else {
        await updateDoc(docRef, { defenderAction: action });
      }

      // Check if both actions are present now
      const freshSnap = await getDoc(docRef);
      const freshData = freshSnap.data()!;
      if (freshData.challengerAction && freshData.defenderAction) {
        // Deterministic single resolver based on lexicographical uid ordering
        const rivalId = isChallenger ? freshData.defenderId : freshData.challengerId;
        const shouldResolve = auth.currentUser!.uid < rivalId;
        if (shouldResolve) {
          await resolveDuelRound(docRef, freshData);
        }
      } else {
        triggerNotification("⏳ Acción registrada. Esperando a tu rival...");
      }
    } catch (err) {
      console.error("Error playing PvP round:", err);
    }
  };

  const weapons = progress.craftedItems.filter(item => item.subType === 'weapon');
  const shields = progress.craftedItems.filter(item => item.subType === 'shield');
  const armors = progress.craftedItems.filter(item => item.subType === 'armor');

  const activeWeapon = progress.craftedItems.find(item => item.subType === 'weapon' && item.equipped) || weapons[0];
  const activeShield = progress.craftedItems.find(item => item.subType === 'shield' && item.equipped) || shields[0];
  const activeArmor = progress.craftedItems.find(item => item.subType === 'armor' && item.equipped) || armors[0];

  const activeWeaponSkillName = activeWeapon?.name.includes('Sable del Alba') ? 'Ira Solar' : activeWeapon?.name.includes('Mandoble') ? 'Tajo Sombrío' : 'Corte Rápido';
  const activeShieldSkillName = activeShield?.name.includes('Estelares') ? 'Barrera Rúnica' : 'Guardia Simple';
  const activeArmorSkillName = activeArmor?.name.includes('Escamas') ? 'Escama Sagrada' : 'Refugio Común';

  const distanceToBeacon = currentMap === 'map3' ? Math.sqrt(Math.pow(playerX, 2) + Math.pow(playerZ - (-10), 2)) : 999;
  const isNearBeacon = distanceToBeacon <= 5.0;

  return (
    <div className="w-full relative bg-[#090a14] rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col" style={{ height: '780px' }}>
      
      {/* Immersive HUD Top bar */}
      <div className="bg-black/85 border-b border-white/10 px-6 py-3.5 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Compass className="w-5 h-5 text-tertiary animate-spin" style={{ animationDuration: '40s' }} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-extrabold font-headline-md tracking-wider uppercase">
                {currentMap === 'cabin' && '🏠 Tu Cabaña'}
                {currentMap === 'neighborhood' && '🏘️ El Vecindario de la Aldea'}
                {currentMap === 'lobby' && '💎 Gran Plaza Central (Lobby)'}
                {currentMap === 'map1' && '🌲 Bosque Seguro de Resonancia'}
                {currentMap === 'map2' && '🪨 Cantera Celestial de Cristales'}
                {currentMap === 'map3' && '💀 Zona de Bruma de Sangre (ROJA/PVP)'}
              </span>
              <span className="text-[10px] bg-white/5 text-[#dec1ac] px-2 py-0.5 rounded-full font-mono">
                X: {playerX.toFixed(1)} | Z: {playerZ.toFixed(1)}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 block -mt-1 font-mono uppercase">
              {currentMap === 'cabin' && 'INTERIOR COZY • TU COMPAÑERO NITZ DESCANSA AQUÍ'}
              {currentMap === 'neighborhood' && 'COMPARTIENDO CON VECINOS • VERIFICA SUS DISEÑOS'}
              {currentMap === 'lobby' && 'NUCLEO SOCIAL • PORTALES DE AVENTURAS Y DUELOS DE ARENA'}
              {currentMap === 'map1' && 'RECOLECCIÓN SANA • RECURSOS BÁSICOS CON SEGURIDAD SIN CONFRONTACIONES'}
              {currentMap === 'map2' && 'ZONA MINERAL EN SINTONÍA • EXTRAE RECURSOS DE CRISTALES Y COBRE'}
              {currentMap === 'map3' && 'RIESGO TOTAL / BOTÍN VALIOSO • PORTAS MOCHILA SENSITIVA DE SAQUEO'}
            </span>
          </div>
        </div>

        {/* Global actions and PVP Toggles */}
        <div className="flex items-center gap-3">
          {/* Summon/Dismiss Nitz Companion (Palworld style) */}
          {currentMap !== 'cabin' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const nextSummoned = !progress.companionSummoned;
                  onSaveProgress({
                    ...progress,
                    companionSummoned: nextSummoned
                  });
                  // Trigger an immediate Firestore update so peers see it without 1.5s delay
                  if (auth.currentUser) {
                    const userRef = doc(db, 'users', auth.currentUser.uid);
                    updateDoc(userRef, {
                      companionSummoned: nextSummoned
                    }).catch(err => console.error("Error updating summon status in DB:", err));
                  }
                  triggerNotification(nextSummoned ? "🐾 ¡Nitz invocado! Te seguirá y te ayudará a recolectar recursos." : "🐾 Nitz regresó a descansar en tu cabaña.");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 uppercase ${
                  progress.companionSummoned 
                    ? 'bg-amber-600 border border-amber-500 text-white animate-pulse' 
                    : 'bg-black/50 border border-white/10 text-gray-400 hover:text-white'
                }`}
                title={progress.companionSummoned ? 'Desinvocar a tu compañero Nitz' : 'Invocar a tu compañero Nitz para ayudarte a recolectar'}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{progress.companionSummoned ? 'Nitz Invocado' : 'Invocar Nitz'}</span>
              </button>

              {progress.companionSummoned && (
                <button
                  onClick={() => {
                    const nextIndex = (activeNitzIndex + 1) % 3;
                    setActiveNitzIndex(nextIndex);
                    
                    const names = ["Nitz de Origen", "Nitz Ígneo", "Nitz Abisal"];
                    const themes: ("classic" | "solstice" | "abyssal")[] = ["classic", "solstice", "abyssal"];
                    
                    const chosenName = names[nextIndex];
                    const chosenTheme = themes[nextIndex];
                    
                    onSaveProgress({
                      ...progress,
                      avatar: {
                        ...progress.avatar,
                        name: chosenName,
                        colorTheme: chosenTheme
                      }
                    });

                    // Trigger immediate Firestore update so peers see it without 1.5s delay
                    if (auth.currentUser) {
                      const userRef = doc(db, 'users', auth.currentUser.uid);
                      updateDoc(userRef, {
                        activeNitzName: chosenName,
                        'avatar.name': chosenName,
                        'avatar.colorTheme': chosenTheme
                      }).catch(err => console.error("Error updating Nitz companion in DB:", err));
                    }
                    
                    triggerNotification(`🔄 Has cambiado a: ${chosenName}`);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-black/50 border border-white/10 text-gray-400 hover:text-white uppercase cursor-pointer"
                  title="Intercambiar dinámicamente tu compañero Nitz"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{progress.avatar.name || "Nitz de Origen"}</span>
                </button>
              )}
            </div>
          )}

          {currentMap === 'map3' && (
            <button
              onClick={() => {
                setPvpEnabled(!pvpEnabled);
                triggerNotification(pvpEnabled ? "🛡️ Modo Hostilidad DESACTIVADO" : "💀 MODO HOSTIL ACTIVADO: ¡Puedes atacar y ser atacado!");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 uppercase ${
                pvpEnabled 
                  ? 'bg-red-600 border border-red-500 text-white animate-pulse' 
                  : 'bg-black/50 border border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <Skull className="w-3.5 h-3.5" />
              <span>{pvpEnabled ? 'Modo Hostíl ON' : 'Apagado'}</span>
            </button>
          )}

          {/* Secure shipment button if they gathered anything */}
          {currentMap !== 'cabin' && currentMap !== 'neighborhood' && currentMap !== 'lobby' && (
            currentMap === 'map3' ? (
              <span className="text-[10px] bg-red-950/40 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg font-mono font-bold animate-pulse">
                💀 SE REQUIERE EXTRACCIÓN EN FARO
              </span>
            ) : (
              <button
                onClick={handleBankResourcesDirectly}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all shadow-md active:scale-95 border border-emerald-400/30"
                title="Guardar tus recursos conseguidos en el inventario duradero"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Guardar Botín</span>
              </button>
            )
          )}

          {/* Active players indicator counter */}
          <div className="bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-gray-300">
            <Users className="w-4 h-4 text-tertiary" />
            <span>Mundo: {onlinePlayers.filter(p => p.currentMap === currentMap).length + 1}</span>
          </div>
        </div>
      </div>

      {/* Primary 3D Space Canvas Viewport Container */}
      <div className="flex-1 w-full bg-slate-950 relative overflow-hidden flex" ref={mountRef}>
        
        {/* Dynamic HTML Nameplates overlay projected from 3D coords */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {onlinePlayers.filter(p => p.currentMap === currentMap).map(peer => {
            const colorsDictHex: Record<EmotionName, string> = {
              Ira: '#ef4444', Miedo: '#a855f7', Tristeza: '#3b82f6', Alegría: '#facc15',
              Confianza: '#4ade80', Sorpresa: '#f472b6', Amor: '#f43f5e', Orgullo: '#f97316', Serenidad: '#22d3ee'
            };
            const col = colorsDictHex[peer.dominantEmotion] || '#ffffff';
            const emotionTitles: Record<EmotionName, string> = {
              Ira: 'Guardián del Fuego',
              Miedo: 'Buscador de Sombras',
              Tristeza: 'Centinela de la Lluvia',
              Alegría: 'Heraldo de la Luz',
              Confianza: 'Protector de Almas',
              Sorpresa: 'Explorador Astral',
              Amor: 'Vinculador de Corazones',
              Orgullo: 'Paladín Celestial',
              Serenidad: 'Templario de la Calma'
            };
            const title = emotionTitles[peer.dominantEmotion] || 'Guardián Místico';
            
            return (
              <div
                key={peer.id}
                id={`nameplate-${peer.id}`}
                className="absolute -translate-x-1/2 -translate-y-full bg-black/85 border border-white/10 px-2.5 py-1 rounded-lg flex flex-col items-center gap-0.5 shadow-lg select-none text-center transition-opacity duration-150"
                style={{
                  display: 'none',
                }}
              >
                <span className="text-xs font-extrabold font-mono tracking-wide" style={{ color: col }}>
                  @{peer.username}
                </span>
                <span className="text-[8.5px] font-semibold text-[#dec1ac] uppercase tracking-wider">
                  {title}
                </span>
                {peer.companionSummoned && (
                  <span className="text-[7.5px] text-gray-400 font-mono italic">
                    🐾 {peer.activeNitzName || 'Nitz de Origen'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Float interactive notification panel overlay */}
        {notification && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-[#121528] border border-tertiary/40 px-5 py-2.5 rounded-full text-xs font-bold text-[#dec1ac] shadow-2xl flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4 text-tertiary animate-pulse" />
            <span>{notification}</span>
          </div>
        )}

        {/* Extraction Beacon Prompt (Arc Raiders style) */}
        {currentMap === 'map3' && isNearBeacon && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-black/95 border border-yellow-500/40 p-4 rounded-xl flex flex-col items-center gap-2 shadow-2xl text-center min-w-[280px] scale-105 transition-all animate-fade-in">
            <span className="text-[9px] text-[#dec1ac] uppercase tracking-widest font-mono font-bold animate-pulse">Punto de Extracción Activo</span>
            <span className="text-white text-xs font-bold font-mono">Faro de Evacuación de Almas</span>
            
            {extractionActive ? (
              <div className="space-y-2 w-full">
                <span className="text-emerald-400 font-extrabold text-xs font-mono block animate-pulse">EXTRAYENDO BOTÍN EN BRUMAS: {extractionTimeLeft}s</span>
                <div className="w-full bg-[#1e2030] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(extractionTimeLeft / 15) * 100}%` }} />
                </div>
                <span className="text-[8px] text-gray-500 block font-mono">¡PREPÁRATE PARA DEFENDER LA POSICIÓN!</span>
              </div>
            ) : (
              <button
                onClick={handleStartExtraction}
                disabled={!hasItemsInTempBag()}
                className={`font-extrabold text-xs px-5 py-2 rounded-md shadow flex items-center gap-1.5 transition-all active:scale-95 ${
                  hasItemsInTempBag()
                    ? 'bg-yellow-500 hover:bg-yellow-400 text-black cursor-pointer'
                    : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
                <span>INICIAR EXTRACCIÓN (15s)</span>
              </button>
            )}
          </div>
        )}

        {/* Current near point overlay notification banner */}
        {nearNode && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-black/90 border border-white/15 p-3 rounded-xl flex flex-col items-center gap-1.5 shadow-2xl text-center min-w-xs scale-105 transition-all">
            <span className="text-[9px] text-[#dec1ac] uppercase tracking-widest font-mono font-bold">Resonancia Cercana Detectada</span>
            <span className="text-white text-xs font-bold">{nearNode.name}</span>
            <button
              onClick={handleInteractNearNode}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs px-4 py-1.5 rounded-md shadow flex items-center gap-1"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Pulsa [E] o CLIC para Activar</span>
            </button>
          </div>
        )}

        {/* Online players local radar/list overlay inside active map */}
        <div className="absolute right-4 top-4 z-20 w-48 bg-black/80 border border-white/10 rounded-xl p-3 backdrop-blur-md space-y-2 select-none pointer-events-auto">
          <span className="text-[9px] uppercase font-bold tracking-wider text-tertiary block font-mono">📡 Radar de Navegantes</span>
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-[11px] text-emerald-400">
              <span className="truncate font-semibold">{progress.username || 'Tú'}</span>
              <span className="text-[8.5px] bg-emerald-500/10 px-1 rounded">MÍO</span>
            </div>
            {onlinePlayers.filter(p => p.currentMap === currentMap).length === 0 ? (
              <span className="text-[10px] text-gray-500 block italic">Solares desiertos...</span>
            ) : (
              onlinePlayers.filter(p => p.currentMap === currentMap).map(peer => (
                <div key={peer.id} className="flex items-center justify-between text-[11px] text-gray-300">
                  <span className="truncate">{peer.username}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] uppercase bg-white/5 text-gray-400 px-1 rounded">f{peer.phase}</span>
                    {currentMap === 'map3' && peer.pvpEnabled && (
                      <button
                        onClick={() => handleLaunchPvPDuel(peer)}
                        className="text-[9px] bg-red-600 hover:bg-red-500 text-white px-1.5 py-0.5 rounded font-bold animate-pulse"
                        title="Atacar en duelo PvP"
                      >
                        ⚔️
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Left side: Temp inventory panel tracking session cargo */}
        {(tempBag.wood.common > 0 || tempBag.stone.common > 0 || tempBag.wood.rare > 0 || tempBag.metal.rare > 0 || tempBag.wood.epic > 0 || tempBag.stone.epic > 0 || tempBag.wood.legendary > 0 || tempBag.stone.legendary > 0) && (
          <div className="absolute left-4 top-4 z-20 w-52 bg-[#090b14]/90 border border-white/5 rounded-xl p-3 backdrop-blur-md">
            <span className="text-[9px] text-[#dec1ac] uppercase tracking-wider font-bold block font-mono">💼 Mochila de Sesión</span>
            <div className="space-y-1.5 mt-2 text-xs">
              {tempBag.wood.common > 0 && <div className="flex justify-between"><span>🌲 Madera Común</span><span className="font-mono text-emerald-400">+{tempBag.wood.common}</span></div>}
              {tempBag.wood.rare > 0 && <div className="flex justify-between"><span>✨ Madera Rara</span><span className="font-mono text-cyan-400">+{tempBag.wood.rare}</span></div>}
              {tempBag.wood.epic > 0 && <div className="flex justify-between"><span>🔮 Madera Épica</span><span className="font-mono text-purple-400">+{tempBag.wood.epic}</span></div>}
              {tempBag.wood.legendary > 0 && <div className="flex justify-between"><span>👑 Madera Legendaria</span><span className="font-mono text-yellow-400">+{tempBag.wood.legendary}</span></div>}

              {tempBag.stone.common > 0 && <div className="flex justify-between"><span>🪨 Piedra Común</span><span className="font-mono text-emerald-400">+{tempBag.stone.common}</span></div>}
              {tempBag.stone.rare > 0 && <div className="flex justify-between"><span>⚡ Metal Raro</span><span className="font-mono text-cyan-400">+{tempBag.stone.rare}</span></div>}
              {tempBag.stone.epic > 0 && <div className="flex justify-between"><span>🔮 Cuarzo Épico</span><span className="font-mono text-purple-400">+{tempBag.stone.epic}</span></div>}
              {tempBag.stone.legendary > 0 && <div className="flex justify-between"><span>👑 Gema Alba</span><span className="font-mono text-yellow-400">+{tempBag.stone.legendary}</span></div>}
              
              <div className="border-t border-white/10 pt-1.5 flex justify-between text-[10px] text-gray-400 uppercase font-bold">
                <span>Total Cargado</span>
                <span>
                  {(Object.values(tempBag.wood) as number[]).reduce((a, b) => a + b, 0) + (Object.values(tempBag.stone) as number[]).reduce((a, b) => a + b, 0)} items
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Directional Pointer Keyboard & Touch panel hud helpers (Only on Desktop) */}
        {!isMobile && (
          <div className="absolute left-6 bottom-6 z-20 flex flex-col items-center gap-1.5 bg-black/60 p-2.5 rounded-xl border border-white/10 backdrop-blur pointer-events-auto">
            <span className="text-[8px] uppercase text-gray-400 block font-mono">Consola Guía</span>
            <div className="flex gap-1.5">
              <div className="w-8" />
              <button 
                onClick={() => triggerMovementButton('forward')} 
                className="w-9 h-9 bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white border border-white/5 rounded-lg font-bold"
                title="Avanzar [W]"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <div className="w-8" />
            </div>
            <div className="flex gap-1.5">
              <button 
                onClick={() => triggerRotationButton('left')} 
                className="w-9 h-9 bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white border border-white/5 rounded-lg font-bold"
                title="Rotar Izquierda [Girar]"
              >
                <ArrowLeft className="w-4 h-4 text-amber-300" />
              </button>
              <button 
                onClick={() => triggerMovementButton('backward')} 
                className="w-9 h-9 bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white border border-white/5 rounded-lg font-bold"
                title="Retroceder [S]"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button 
                onClick={() => triggerRotationButton('right')} 
                className="w-9 h-9 bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white border border-white/5 rounded-lg font-bold"
                title="Rotar Derecha [Girar]"
              >
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </button>
            </div>
            <span className="text-[7.5px] text-gray-500 font-mono tracking-wide -mb-1 mt-0.5">O usa WASD/Teclado</span>
          </div>
        )}

        {/* Floating Mobile Virtual Joystick and Action Buttons */}
        {isMobile && (
          <>
            {/* Joystick Zone (Left side) */}
            <div 
              className="absolute left-8 bottom-8 z-30 w-32 h-32 bg-black/60 border border-white/15 rounded-full flex items-center justify-center joystick-container touch-none select-none pointer-events-auto backdrop-blur-sm"
              onTouchStart={handleJoystickStart}
              onTouchMove={handleJoystickMove}
              onTouchEnd={handleJoystickEnd}
            >
              <div className="absolute inset-2 border border-white/5 rounded-full pointer-events-none" />
              <div 
                className="w-14 h-14 bg-gradient-to-br from-tertiary to-amber-600 border border-white/30 rounded-full shadow-2xl flex items-center justify-center active:brightness-110"
                style={{
                  transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                  transition: isJoystickActive ? 'none' : 'transform 0.15s ease-out'
                }}
              >
                <div className="w-3.5 h-3.5 bg-white/40 rounded-full" />
              </div>
            </div>

            {/* Mobile Action Buttons (Right side) */}
            <div className="absolute right-8 bottom-8 z-30 flex items-center gap-4 select-none touch-none pointer-events-auto">
              {/* Contextual Action Button */}
              {nearNode && (
                <button
                  onTouchStart={() => handleInteractNearNodeRef.current()}
                  className="mobile-btn w-16 h-16 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 border border-emerald-400/50 text-white font-extrabold text-[10px] shadow-2xl flex flex-col items-center justify-center active:scale-90 uppercase tracking-widest leading-none gap-0.5"
                >
                  <Play className="w-4 h-4 fill-current mb-0.5" />
                  Acción
                </button>
              )}

              {/* Jump Button */}
              <button
                onTouchStart={() => {
                  if (!isJumpingRef.current) {
                    velocityYRef.current = 6.0;
                    isJumpingRef.current = true;
                  }
                }}
                className="mobile-btn w-16 h-16 rounded-full bg-gradient-to-br from-cyan-600 to-cyan-500 border border-cyan-400/50 text-white font-extrabold text-[10px] shadow-2xl flex flex-col items-center justify-center active:scale-90 uppercase tracking-widest leading-none gap-0.5"
              >
                <ArrowUp className="w-4 h-4 mb-0.5" />
                Saltar
              </button>
            </div>
          </>
        )}

        {/* Interactive action instructions indicator */}
        <div className="absolute right-6 bottom-6 z-20 bg-black/75 p-3 rounded-xl border border-white/10 max-w-xs text-xs space-y-1.5 backdrop-blur">
          <span className="text-[9px] font-mono tracking-wider font-extrabold text-tertiary uppercase block">Ayuda Sensitiva</span>
          <p className="text-gray-300 leading-normal">
            ⚙️ <strong>Navega en 3D:</strong> Haz clic y arrastra mouse sobre la pantalla para mirar alrededor; pulsa <strong>W, A, S, D</strong> o las flechas de tu teclado para caminar.
          </p>
          <div className="flex items-center gap-1 text-[10px] text-[#dec1ac] font-bold">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Camina cerca de los objetos para abrir paneles.</span>
          </div>
        </div>

      </div>

      {/* RENDER IMMERSIVE GAME OVERLAYS ON SELECTION */}
      <AnimatePresence>
        {activeOverlay !== 'none' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="absolute inset-0 z-40 bg-black/90 p-4 md:p-8 overflow-y-auto flex flex-col justify-center items-center"
          >
            
            {/* Header control inside overlay */}
            <div className="w-full max-w-5xl flex justify-between items-center bg-[#151726] border-b border-white/15 px-6 py-4.5 rounded-t-xl shadow-xl">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-tertiary animate-pulse" />
                <span className="text-white text-sm font-semibold tracking-wide uppercase font-headline-md">
                  {activeOverlay === 'syntonia' && '🎼 Teclado de Sintonía Armónica Reciproco'}
                  {activeOverlay === 'crafting' && '🔨 Forja y Herrería de Elementos Tacticos'}
                  {activeOverlay === 'codex' && '📖 Gran Compendio y Códice de Arquetipos'}
                  {activeOverlay === 'arena' && '⚔️ Arena de Combate vs Nitz Korrumpido'}
                  {activeOverlay === 'interactive_pet_chat' && '🐾 Panel de Cuidados & Comunicación Holística de Nitz'}
                </span>
              </div>
              <button
                onClick={() => setActiveOverlay('none')}
                className="bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs px-4 py-1.5 rounded-lg font-bold uppercase transition-all"
              >
                Cerrar Estación X
              </button>
            </div>

            {/* Content overlay routers */}
            <div className="w-full max-w-5xl bg-[#0d0e1b] border-x border-b border-white/10 rounded-b-xl px-4 py-6 md:px-8 shadow-2xl relative min-h-[550px]">
              
              {activeOverlay === 'syntonia' && (
                <Minigame 
                  onReward={(woodDiff, stoneDiff) => {
                    const nextWood = progress.inventory.wood.common + (woodDiff * 2);
                    const nextStone = progress.inventory.stone.common + stoneDiff;
                    onSaveProgress({
                      ...progress,
                      inventory: {
                        ...progress.inventory,
                        wood: { ...progress.inventory.wood, common: nextWood },
                        stone: { ...progress.inventory.stone, common: nextStone }
                      }
                    });
                    triggerNotification(`🎁 Recolectas +${woodDiff * 2} maderas y +${stoneDiff} piedras en Sintonía`);
                  }}
                  onEmotionBoost={(emotion, extraPoints) => {
                    onUpdateEmotions(prev => ({
                      ...prev,
                      [emotion]: Math.min(100, (prev[emotion] || 10) + extraPoints)
                    }));
                  }}
                />
              )}

              {activeOverlay === 'crafting' && (
                <Crafting 
                  progress={progress}
                  onSaveProgress={onSaveProgress}
                />
              )}

              {activeOverlay === 'codex' && (
                <Codex 
                  unlockedArchetypes={progress.unlockedArchetypes}
                  currentDominant={currentDominant.name}
                />
              )}

              {activeOverlay === 'arena' && (
                <BattleArena 
                  progress={progress}
                  onSaveProgress={onSaveProgress}
                  onDefeat={handleDefeatInArena}
                />
              )}

              {activeOverlay === 'interactive_pet_chat' && (
                <MyHome 
                  playerProgress={progress}
                  onUpdateEmotions={onUpdateEmotions}
                  onEvolve={onEvolve}
                  onSpendGold={onSpendGold}
                />
              )}

            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* RENDER PVP ACTIVE BATTLE OVERLAY */}
      <AnimatePresence>
        {pvpDuel?.inCombat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 bg-[#16060c]/95 flex flex-col justify-center items-center p-6"
          >
            <div className="w-full max-w-xl bg-black/90 border border-red-500/30 rounded-2xl p-6 space-y-5 shadow-2xl">
              <div className="flex justify-between items-center border-b border-red-500/10 pb-3">
                <span className="text-red-500 text-xs font-mono font-bold tracking-widest uppercase flex items-center gap-1">
                  <Skull className="w-4 h-4 animate-bounce" /> Duelo de Bruma Hostíl (PVP)
                </span>
                <span className="text-[#dec1ac] text-[10px] font-semibold bg-white/5 px-2 py-0.5 rounded uppercase">Full Loot</span>
              </div>

              {/* Combatants Bars */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-emerald-400 text-[10px] uppercase font-mono block">Tú (Guardián)</span>
                  <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(pvpDuel.playerHp / pvpDuel.playerMaxHp) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">HP: {pvpDuel.playerHp} / {pvpDuel.playerMaxHp}</span>
                  {pvpDuel.playerHp > 0 && (
                    <div className="text-[9px] text-cyan-400">Escudo: {pvpDuel.playerShield}</div>
                  )}
                </div>

                <div className="space-y-1 text-right">
                  <span className="text-red-400 text-[10px] uppercase font-mono block">{pvpDuel.rivalName}</span>
                  <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-red-500 transition-all ml-auto" style={{ width: `${(pvpDuel.rivalHp / pvpDuel.rivalMaxHp) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">HP: {pvpDuel.rivalHp} / {pvpDuel.rivalMaxHp}</span>
                  {pvpDuel.rivalHp > 0 && (
                    <div className="text-[9px] text-orange-400">Escudo: {pvpDuel.rivalShield}</div>
                  )}
                </div>
              </div>

              {/* PvP Logs console layout */}
              <div className="bg-[#140b0e] border border-red-500/10 p-3 h-48 overflow-y-auto rounded-lg text-xs space-y-1.5 font-mono text-gray-300">
                {pvpDuel.logs.map((log, lIdx) => (
                  <p key={lIdx} className={log.includes('🏆') ? 'text-emerald-400 font-extrabold' : log.includes('💀') ? 'text-red-400' : 'text-gray-300'}>
                    {log}
                  </p>
                ))}
              </div>

              {/* Controls */}
              {pvpDuel.playerHp > 0 && pvpDuel.rivalHp > 0 ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => playPvPRound('attack')}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] py-2.5 rounded-xl border border-red-400/30 transition-all flex flex-col items-center justify-center gap-1 active:scale-95"
                  >
                    <Flame className="w-4 h-4" />
                    <span>{activeWeaponSkillName}</span>
                  </button>
                  <button
                    onClick={() => playPvPRound('shield')}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-[10px] py-2.5 rounded-xl border border-cyan-400/30 transition-all flex flex-col items-center justify-center gap-1 active:scale-95"
                  >
                    <Zap className="w-4 h-4" />
                    <span>{activeShieldSkillName}</span>
                  </button>
                  <button
                    onClick={() => playPvPRound('armor')}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] py-2.5 rounded-xl border border-emerald-400/30 transition-all flex flex-col items-center justify-center gap-1 active:scale-95"
                  >
                    <Shield className="w-4 h-4" />
                    <span>{activeArmorSkillName}</span>
                  </button>
                </div>
              ) : (
                <div className="text-center text-xs text-gray-500 italic">Terminando confrontación...</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* PENDING DUEL INVITE POPUP */}
      <AnimatePresence>
        {pendingDuelInvite && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-24 left-6 z-50 bg-[#16060c]/95 border-2 border-red-500/40 p-4 rounded-xl max-w-sm space-y-3 shadow-2xl text-xs backdrop-blur pointer-events-auto"
          >
            <div className="flex items-center gap-1.5 text-red-400 font-bold uppercase tracking-wider">
              <Skull className="w-4 h-4 animate-pulse" />
              <span>Desafío de Bruma Hostil</span>
            </div>
            <p className="text-gray-300">
              ⚔️ El guardián <strong>{pendingDuelInvite.challengerName}</strong> te ha retado a un duelo a muerte de sables. El perdedor perderá toda su mochila temporal.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAcceptDuel}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded font-bold transition-all"
              >
                Aceptar
              </button>
              <button
                onClick={handleDeclineDuel}
                className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 py-1.5 rounded font-bold transition-all"
              >
                Rechazar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
