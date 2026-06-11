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
import { collection, doc, query, onSnapshot, updateDoc, increment, getDoc, arrayUnion } from 'firebase/firestore';

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

  // PVP Battle State
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

  // UI feedback notifications
  const [notification, setNotification] = useState<string | null>(null);

  // Input controller states
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({});

  // Elements references for Three.js
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const keysDownRef = useRef<{ [key: string]: boolean }>({});

  // Setup initial key listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysDownRef.current[k] = true;
      setKeys({ ...keysDownRef.current });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysDownRef.current[k] = false;
      setKeys({ ...keysDownRef.current });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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
              pvpEnabled: data.pvpEnabled || false
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
          lastActive: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error syncing player positional stats:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [currentMap, playerX, playerZ, cameraAngle, pvpEnabled]);


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

    // Populate actual active online peers in the same room inside 3D space
    const peerMeshes: { id: string; mesh: THREE.Mesh }[] = [];
    onlinePlayers.forEach(peer => {
      if (peer.currentMap === currentMap) {
        // Render peer as a gorgeous floating diamond
        const peerGeo = new THREE.OctahedronGeometry(0.8, 0);
        const colorsDict: Record<EmotionName, number> = {
          Ira: 0xef4444, Miedo: 0xa855f7, Tristeza: 0x3b82f6, Alegría: 0xfacc15,
          Confianza: 0x4ade80, Sorpresa: 0xf472b6, Amor: 0xf43f5e, Orgullo: 0xf97316, Serenidad: 0x22d3ee
        };
        const col = colorsDict[peer.dominantEmotion] || 0xffffff;
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
        peerMeshes.push({ id: peer.id, mesh });
      }
    });

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Viewport mouse dragging to rotate CAMERA
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      setCameraAngle(prev => prev - deltaX * 0.0055);
      setCameraPitch(prev => Math.max(-0.6, Math.min(0.6, prev - deltaY * 0.0055)));
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

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

      // Float other players' avatars
      peerMeshes.forEach(pm => {
        pm.mesh.position.y = 1.2 + Math.sin(timer * 2.1 + pm.mesh.position.x) * 0.15;
        pm.mesh.rotation.y += 0.02;
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
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [currentMap, activeNodes, onlinePlayers]);

  // Motion processing cycle (frame controller loops updating coordinates)
  useEffect(() => {
    let loopId = 0;

    const moveLoop = () => {
      loopId = requestAnimationFrame(moveLoop);

      // Speed metrics
      const speed = 0.16;
      let dx = 0;
      let dz = 0;

      // WASD / Arrow checks
      if (keys['w'] || keys['arrowup']) {
        dx += Math.sin(cameraAngle);
        dz -= Math.cos(cameraAngle);
      }
      if (keys['s'] || keys['arrowdown']) {
        dx -= Math.sin(cameraAngle);
        dz += Math.cos(cameraAngle);
      }
      if (keys['a'] || keys['arrowleft']) {
        dx -= Math.cos(cameraAngle);
        dz -= Math.sin(cameraAngle);
      }
      if (keys['d'] || keys['arrowright']) {
        dx += Math.cos(cameraAngle);
        dz += Math.sin(cameraAngle);
      }

      // Safe bound clamps
      let limitValue = 38;
      if (currentMap === 'cabin') limitValue = 5;

      let nextX = Math.max(-limitValue, Math.min(limitValue, playerX + dx * speed));
      let nextZ = Math.max(-limitValue, Math.min(limitValue, playerZ + dz * speed));

      // Calculate proximity to interactive nodes
      let foundNear: InteractiveNode3D | null = null;
      activeNodes.forEach(node => {
        const dist = Math.sqrt(Math.pow(nextX - node.x, 2) + Math.pow(nextZ - node.z, 2));
        if (dist < 2.5) {
          foundNear = node;
        }
      });

      setNearNode(foundNear);
      setPlayerX(nextX);
      setPlayerZ(nextZ);

      // Handle continuous camera view alignment
      if (cameraRef.current) {
        cameraRef.current.position.set(nextX, 1.6, nextZ);
        
        // Pivot lookAt vector
        const lookX = nextX + Math.sin(cameraAngle);
        const lookZ = nextZ - Math.cos(cameraAngle);
        const lookY = 1.6 + Math.sin(cameraPitch);
        cameraRef.current.lookAt(lookX, lookY, lookZ);
      }
    };

    moveLoop();
    return () => cancelAnimationFrame(loopId);
  }, [keys, cameraAngle, cameraPitch, playerX, playerZ, activeNodes, currentMap]);


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
      // Click mining actions directly in 3D
      setActiveNodes(prev => prev.map(n => {
        if (n.id === nearNode.id) {
          const nextClicks = (n.clicksCurrent || 0) + 1;
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

            triggerNotification(`⭐ ¡Nodo purificado! Recibes materiales y +${expVal} EXP.`);
            return { ...n, clicksCurrent: 0 };
          }
          return { ...n, clicksCurrent: nextClicks };
        }
        return n;
      }));
    }
  };

  // Launch PvP Duel vs other active player in Map 3 (Zona Roja)
  const handleLaunchPvPDuel = (rival: OnlinePlayer) => {
    if (currentMap !== 'map3') return;
    if (!pvpEnabled) {
      triggerNotification("⚠️ Debes activar tu flag de Modo Hostíl para batallar en PvP");
      return;
    }
    if (!rival.pvpEnabled) {
      triggerNotification(`⚠️ El jugador ${rival.username} tiene la hostilidad apagada`);
      return;
    }

    // Set up PvP metrics based on weapon stats
    const pDmg = 30 + progress.phase * 5;
    const rDmg = 25 + rival.phase * 4;

    setPvpDuel({
      inCombat: true,
      rivalName: rival.username,
      rivalId: rival.id,
      rivalHp: 150 + rival.phase * 30,
      rivalMaxHp: 150 + rival.phase * 30,
      rivalShield: 60,
      playerHp: 150 + progress.phase * 30,
      playerMaxHp: 150 + progress.phase * 30,
      playerShield: 80,
      logs: [`⚔️ ¡DUELO DE SABLES ACTIVO! Has emboscado a ${rival.username} en la bruma.`]
    });
  };

  // Handle a single round of PvP
  const playPvPRound = (action: 'attack' | 'shield') => {
    if (!pvpDuel) return;

    const roundLogs: string[] = [];

    // ====== Player turn ======
    if (action === 'attack') {
      const rawDmg = 22 + Math.floor(Math.random() * 12) + progress.phase * 3;
      let dmgAbsorbed = 0;
      let finalHpDmg = rawDmg;

      let nextRivalShield = pvpDuel.rivalShield;
      if (nextRivalShield > 0) {
        if (nextRivalShield >= rawDmg) {
          nextRivalShield -= rawDmg;
          dmgAbsorbed = rawDmg;
          finalHpDmg = 0;
        } else {
          dmgAbsorbed = nextRivalShield;
          finalHpDmg = rawDmg - nextRivalShield;
          nextRivalShield = 0;
        }
      }

      const nextRivalHp = Math.max(0, pvpDuel.rivalHp - finalHpDmg);
      roundLogs.push(`⚔️ Blandes tu sable infligiendo ${rawDmg} de daño total (${dmgAbsorbed > 0 ? `${dmgAbsorbed} absorbido por escudo, ` : ''}${finalHpDmg} restado de HP!).`);

      if (nextRivalHp <= 0) {
        // Victory! Steal their temp gold + massive drops
        const goldStolen = Math.floor(Math.random() * 120) + 80;
        onSaveProgress({
          ...progress,
          gold: progress.gold + goldStolen,
          exp: progress.exp + 120
        });

        roundLogs.push(`🏆 ¡VICTORIA EXQUISITA! Has doblegado a ${pvpDuel.rivalName}. Le has despojado del mineral y ganado +${goldStolen}g de loot territorial.`);
        setPvpDuel(prev => prev ? {
          ...prev,
          rivalHp: 0,
          rivalShield: 0,
          logs: [...prev.logs, ...roundLogs]
        } : null);

        setTimeout(() => {
          setPvpDuel(null);
        }, 4000);
        return;
      }

      // ====== Enemy/Rival turn response ======
      const rivalRawDmg = 18 + Math.floor(Math.random() * 10);
      let pShieldAbs = 0;
      let pFinalDmg = rivalRawDmg;

      let nextPlayerShield = pvpDuel.playerShield;
      if (nextPlayerShield > 0) {
        if (nextPlayerShield >= rivalRawDmg) {
          nextPlayerShield -= rivalRawDmg;
          pShieldAbs = rivalRawDmg;
          pFinalDmg = 0;
        } else {
          pShieldAbs = nextPlayerShield;
          pFinalDmg = rivalRawDmg - nextPlayerShield;
          nextPlayerShield = 0;
        }
      }

      const nextPlayerHp = Math.max(0, pvpDuel.playerHp - pFinalDmg);
      roundLogs.push(`🌋 El rival ${pvpDuel.rivalName} responde ferozmente haciéndote ${rivalRawDmg} de daño (${pShieldAbs > 0 ? `${pShieldAbs} amortiguado por tu barrera` : ''}).`);

      if (nextPlayerHp <= 0) {
        // Lose! Clear cargo
        setTempBag({
          wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
          stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
          metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
          essence: { common: 0, rare: 0, epic: 0, legendary: 0 }
        });
        roundLogs.push(`💀 HAS SIDO DERROTADO... Escapas herido a tu cabaña y pierdes toda la carga de materiales que llevabas en la mochila.`);
        
        setPvpDuel(prev => prev ? {
          ...prev,
          playerHp: 0,
          playerShield: 0,
          logs: [...prev.logs, ...roundLogs]
        } : null);

        setTimeout(() => {
          setPvpDuel(null);
          setCurrentMap('cabin'); // teleport back to safe cabin!
        }, 4500);
        return;
      }

      setPvpDuel(prev => prev ? {
        ...prev,
        rivalHp: nextRivalHp,
        rivalShield: nextRivalShield,
        playerHp: nextPlayerHp,
        playerShield: nextPlayerShield,
        logs: [...prev.logs, ...roundLogs]
      } : null);

    } else {
      // Shield Regen Defense
      const regenera = 25 + progress.phase * 4;
      const nextShield = Math.min(pvpDuel.playerMaxShield, pvpDuel.playerShield + regenera);
      roundLogs.push(`🛡️ Te asguaras restaurando +${regenera} de Escudo Rúnico.`);

      // Rival counter
      const rivalRawDmg = 15 + Math.floor(Math.random() * 8);
      let pShieldAbs = 0;
      let pFinalDmg = rivalRawDmg;

      let nextPlayerShield = nextShield;
      if (nextPlayerShield > 0) {
        if (nextPlayerShield >= rivalRawDmg) {
          nextPlayerShield -= rivalRawDmg;
          pShieldAbs = rivalRawDmg;
          pFinalDmg = 0;
        } else {
          pShieldAbs = nextPlayerShield;
          pFinalDmg = rivalRawDmg - nextPlayerShield;
          nextPlayerShield = 0;
        }
      }

      const nextPlayerHp = Math.max(0, pvpDuel.playerHp - pFinalDmg);
      roundLogs.push(`🌋 El rival ${pvpDuel.rivalName} arremete con ráfaga por ${rivalRawDmg} de potencia.`);

      setPvpDuel(prev => prev ? {
        ...prev,
        playerHp: nextPlayerHp,
        playerShield: nextPlayerShield,
        logs: [...prev.logs, ...roundLogs]
      } : null);
    }
  };


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
            <button
              onClick={handleBankResourcesDirectly}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all shadow-md active:scale-95 border border-emerald-400/30"
              title="Guardar tus recursos conseguidos en el inventario duradero"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Guardar Botín</span>
            </button>
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
        
        {/* Float interactive notification panel overlay */}
        {notification && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-[#121528] border border-tertiary/40 px-5 py-2.5 rounded-full text-xs font-bold text-[#dec1ac] shadow-2xl flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4 text-tertiary animate-pulse" />
            <span>{notification}</span>
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
              <span>Pulsa [ENTER] o CLIC para Activar</span>
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

        {/* Directional Pointer Keyboard & Touch panel hud helpers */}
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
                <div className="flex gap-3">
                  <button
                    onClick={() => playPvPRound('attack')}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs py-3 rounded-xl border border-red-400/30 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Sword className="w-4 h-4" />
                    <span>EMBESTIDA CON SABLE</span>
                  </button>
                  <button
                    onClick={() => playPvPRound('shield')}
                    className="flex-1 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 text-white font-extrabold text-xs py-3 rounded-xl transition-all"
                  >
                    RESTAURAR ESCUDOS
                  </button>
                </div>
              ) : (
                <div className="text-center text-xs text-gray-500 italic">Terminando confrontación...</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
