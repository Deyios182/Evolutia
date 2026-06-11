import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Users, Sparkles, Send, Signal, Compass, Radio, Move, Map, Play, ShieldAlert, AlertTriangle } from 'lucide-react';
import * as THREE from 'three';
import { LobbyPlayer, ChatMessage } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, onSnapshot, query, limit } from 'firebase/firestore';

interface LobbyProps {
  playerUsername: string;
  playerPhase: number;
  playerDominant: string;
  onNavigateToView: (view: any) => void;
}

const INITIAL_PEERS: LobbyPlayer[] = [
  { id: 'p1', username: 'Guardián_Luz', avatarUrl: '', phase: 5, dominantEmotion: 'Orgullo', status: 'online' },
  { id: 'p2', username: 'AuraAnime', avatarUrl: '', phase: 3, dominantEmotion: 'Amor', status: 'online' },
  { id: 'p3', username: 'NitzLord', avatarUrl: '', phase: 2, dominantEmotion: 'Ira', status: 'in_battle' },
  { id: 'p4', username: 'Stellaria', avatarUrl: '', phase: 4, dominantEmotion: 'Serenidad', status: 'idle' },
  { id: 'p5', username: 'Astral_Bardo', avatarUrl: '', phase: 1, dominantEmotion: 'Sorpresa', status: 'online' },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: 'm1', sender: 'Guardián_Luz', avatarUrl: '', text: '¡Por fin logré evolucionar a mi Nitz a fase 5! La corona de Orgullo brilla espectacular.', timestamp: '14:32' },
  { id: 'm2', sender: 'AuraAnime', avatarUrl: '', text: '¿Alguien ha forjado el Altar de Serenidad para su casa? ¡Busco ideas de decoración!', timestamp: '14:33' },
  { id: 'm3', sender: 'Stellaria', avatarUrl: '', text: 'Ten mucho cuidado al recolectar en las Tierras de Bruma PvP, los acechadores te roban todo si te derrotan.', timestamp: '14:35' },
];

export const Lobby: React.FC<LobbyProps> = ({ 
  playerUsername, 
  playerPhase, 
  playerDominant, 
  onNavigateToView 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState<string>('');
  const [playersList, setPlayersList] = useState<LobbyPlayer[]>(INITIAL_PEERS);
  
  // Controls feedback State
  const [position2D, setPosition2D] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const [portalFocus, setPortalFocus] = useState<string | null>(null);

  const canvas3DRef = useRef<HTMLCanvasElement | null>(null);
  
  // ThreeJS runtime references
  const mainPlayerMeshRef = useRef<THREE.Mesh | null>(null);
  const peerMeshesRef = useRef<Record<string, THREE.Mesh>>({});
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Listen to Firestore real-time collections for global chat and players
  useEffect(() => {
    // 1. Live Chat listener
    const qChat = query(collection(db, 'chat'), limit(50));
    const unsubscribeChat = onSnapshot(qChat, (snapshot) => {
      const list: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          sender: data.sender || 'Guardián',
          avatarUrl: data.avatarUrl || '',
          text: data.text || '',
          timestamp: data.timestamp || '',
          isNitz: !!data.isNitz,
        });
      });
      if (list.length > 0) {
        // Sort list by string ID or custom rules to keep chronical order safely
        list.sort((a, b) => a.id.localeCompare(b.id));
        setMessages(list);
      } else {
        setMessages(INITIAL_MESSAGES);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chat');
    });

    // 2. Live lobby users list
    const qUsers = query(collection(db, 'users'), limit(30));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const livePeers: LobbyPlayer[] = [];
      snapshot.forEach((doc) => {
        if (doc.id === auth.currentUser?.uid) return; // exclude self
        const data = doc.data();
        livePeers.push({
          id: doc.id,
          username: data.username || 'Guardián',
          avatarUrl: data.avatarUrl || '',
          phase: data.phase || 1,
          dominantEmotion: data.dominantEmotion || 'Alegría',
          status: data.status || 'online',
        });
      });
      // Combine with mock peers so the lobby remains nicely populated even on empty servers
      const combined = [...livePeers, ...INITIAL_PEERS.filter(p => !livePeers.some(lp => lp.username === p.username))];
      setPlayersList(combined);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeChat();
      unsubscribeUsers();
    };
  }, []);

  // Auto-simulate chat conversations of peers online (only if offline/idle)
  useEffect(() => {
    if (auth.currentUser) return; // Disable local noise if connected to real server!

    const talkInterval = setInterval(() => {
      const activePeers = ['AuraAnime', 'Stellaria', 'Guardián_Luz', 'Astral_Bardo'];
      const randomPeerName = activePeers[Math.floor(Math.random() * activePeers.length)];
      const randomConversations = [
        '¡Sintonía perfecta en el minijuego! He conseguido 120 de Oro.',
        'Me derrotaron en la Zona Roja de Albion y perdí 15 de metal legendario... Me dolió muchísimo.',
        'Visiten mi Cabaña 3D en el vecindario, acabo de forjar el Sillón de Terciopelo Púrpura.',
        '¿Luchar contra los enemigos del Mundo Abierto requiere nivel alto?',
        'He desbloqueado la forma Nitz Sombrío en la cabaña.',
      ];
      const text = randomConversations[Math.floor(Math.random() * randomConversations.length)];
      const now = new Date();
      const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      setMessages((prev) => [
        ...prev,
        {
          id: `m_sim_${Date.now()}`,
          sender: randomPeerName,
          avatarUrl: '',
          text,
          timestamp,
        },
      ]);
    }, 15000);

    return () => clearInterval(talkInterval);
  }, []);

  // Three JS Scene Initialization for the 3D walkable Lobby
  useEffect(() => {
    if (!canvas3DRef.current) return;

    const width = canvas3DRef.current.clientWidth || 600;
    const height = canvas3DRef.current.clientHeight || 350;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0c16);
    scene.fog = new THREE.FogExp2(0x0a0c16, 0.08);

    // 2. Camera fixed top-down isometric style
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 10, 10);
    camera.lookAt(0, 0, -2);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvas3DRef.current, antialias: true });
    renderer.setSize(width, height);

    // 4. Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xa5b4fc, 1.25);
    sun.position.set(10, 20, 10);
    scene.add(sun);

    // 5. Ground Floor (Tile mesh styling representing Atrio de las Almas)
    const floorGeo = new THREE.PlaneGeometry(24, 24);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x14162e, 
      roughness: 0.9, 
      side: THREE.DoubleSide 
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = Math.PI / 2;
    scene.add(floor);

    // Grid details on floor to make it walkable visible
    const gridHelper = new THREE.GridHelper(24, 24, 0xdec1ac, 0x1d214a);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // 6. Central Magical Obelisk ( rotating crystal at center)
    const crystalGeo = new THREE.OctahedronGeometry(1.2, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xdec1ac,
      roughness: 0.1,
      metalness: 0.8,
      emissive: 0xdec1ac,
      emissiveIntensity: 0.4
    });
    const obelisk = new THREE.Mesh(crystalGeo, crystalMat);
    obelisk.position.set(0, 2.5, 0);
    scene.add(obelisk);

    // Base of obelisk
    const baseGeo = new THREE.CylinderGeometry(1.5, 1.8, 0.6, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x22264a, roughness: 0.7 });
    const obeliskBase = new THREE.Mesh(baseGeo, baseMat);
    obeliskBase.position.set(0, 0.3, 0);
    scene.add(obeliskBase);

    // 7. Interactive Portal Arches on different ends
    // NORTH: Open World Portal (Red color)
    const p1Geo = new THREE.TorusGeometry(1.3, 0.12, 8, 24);
    const p1Mat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const portalNorth = new THREE.Mesh(p1Geo, p1Mat);
    portalNorth.position.set(0, 1.4, -9);
    scene.add(portalNorth);

    // SOUTH: Neighborhood Portal (Cyan/Emerald)
    const p2Geo = new THREE.TorusGeometry(1.3, 0.12, 8, 24);
    const p2Mat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const portalSouth = new THREE.Mesh(p2Geo, p2Mat);
    portalSouth.position.set(0, 1.4, 9);
    scene.add(portalSouth);

    // EAST: Your House Door (Purple)
    const p3Geo = new THREE.TorusGeometry(1.3, 0.12, 8, 24);
    const p3Mat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6 });
    const portalEast = new THREE.Mesh(p3Geo, p3Mat);
    portalEast.rotation.y = Math.PI / 2;
    portalEast.position.set(9, 1.4, 0);
    scene.add(portalEast);

    // 8. Main local player customized sphere mesh
    const pGeo = new THREE.SphereGeometry(0.6, 24, 12);
    // Determine color based on dominant emotion
    const colorMapper: Record<string, number> = {
      Alegría: 0xfacc15, Serenidad: 0x38bdf8, Ira: 0xef4444, Miedo: 0x818cf8, 
      Tristeza: 0x60a5fa, Confianza: 0x34d399, Sorpresa: 0xf472b6, Amor: 0xec4899, Orgullo: 0xf59e0b
    };
    const localColor = colorMapper[playerDominant] || 0xdec1ac;

    const pMat = new THREE.MeshStandardMaterial({
      color: localColor,
      roughness: 0.3,
      emissive: localColor,
      emissiveIntensity: 0.25
    });
    const mainPlayer = new THREE.Mesh(pGeo, pMat);
    mainPlayer.position.set(0, 0.6, 4); // Start closer to south entrance
    scene.add(mainPlayer);
    mainPlayerMeshRef.current = mainPlayer;

    // Ring around player
    const pRingGeo = new THREE.TorusGeometry(0.72, 0.04, 4, 32);
    const pRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pRing = new THREE.Mesh(pRingGeo, pRingMat);
    pRing.rotation.x = Math.PI / 2;
    mainPlayer.add(pRing);

    // 9. Render Peer players walking randomly
    const peerColors = [0xec4899, 0xf59e0b, 0x3b82f6, 0x10b981];
    playersList.forEach((peer, index) => {
      const peerGeo = new THREE.SphereGeometry(0.6, 16, 12);
      const color = peerColors[index % peerColors.length];
      const peerMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
      const peerMesh = new THREE.Mesh(peerGeo, peerMat);
      
      // Sparsely scatter peers on the grid
      const spawnCoords = [
        new THREE.Vector3(-4, 0.6, -3),
        new THREE.Vector3(5, 0.6, -4),
        new THREE.Vector3(-6, 0.6, 5),
        new THREE.Vector3(6, 0.6, 4),
        new THREE.Vector3(-5, 0.6, 1),
        new THREE.Vector3(4, 0.6, 6),
        new THREE.Vector3(-3, 0.6, -7),
      ];
      peerMesh.position.copy(spawnCoords[index % spawnCoords.length]);
      scene.add(peerMesh);
      peerMeshesRef.current[peer.id] = peerMesh;

      // Cute indicator block
      const indicatorGeo = new THREE.BoxGeometry(0.15, 0.4, 0.15);
      const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
      indicator.position.y = 0.9;
      peerMesh.add(indicator);
    });

    // Keyboard controllers listener mapping
    const activeKeys: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      activeKeys[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Click on canvas to click-to-move pathing calculation
    const handleCanvasClick = (e: MouseEvent) => {
      if (!canvas3DRef.current || !mainPlayerMeshRef.current) return;
      const rect = canvas3DRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Map clean percentage to floor boundary [-12, +12]
      const scaleX = (clickX / rect.width) * 2 - 1; // [-1, +1]
      const scaleY = (clickY / rect.height) * 2 - 1; // [-1, +1]

      // Set coordinate on floor
      const destX = scaleX * 12;
      const destZ = scaleY * 12;

      // Set directly
      mainPlayerMeshRef.current.position.x = Math.max(-11.5, Math.min(11.5, destX));
      mainPlayerMeshRef.current.position.z = Math.max(-11.5, Math.min(11.5, destZ));
    };

    canvas3DRef.current.addEventListener('mousedown', handleCanvasClick);

    // 10. Animation render loop
    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

      // Rotate crystal central
      if (obelisk) {
        obelisk.rotation.y += 0.015;
        obelisk.rotation.z = Math.sin(elapsed) * 0.2;
        obelisk.position.y = 2.5 + Math.sin(elapsed * 2) * 0.2;
      }

      // Float portals
      if (portalNorth) portalNorth.rotation.z += 0.01;
      if (portalSouth) portalSouth.rotation.z -= 0.01;
      if (portalEast) portalEast.rotation.x += 0.01;

      // Keyboard movement processing
      if (mainPlayerMeshRef.current) {
        const speed = 0.15;
        let deltaX = 0;
        let deltaZ = 0;

        if (activeKeys['w'] || activeKeys['arrowup']) deltaZ -= speed;
        if (activeKeys['s'] || activeKeys['arrowdown']) deltaZ += speed;
        if (activeKeys['a'] || activeKeys['arrowleft']) deltaX -= speed;
        if (activeKeys['d'] || activeKeys['arrowright']) deltaX += speed;

        mainPlayerMeshRef.current.position.x = Math.max(-11.5, Math.min(11.5, mainPlayerMeshRef.current.position.x + deltaX));
        mainPlayerMeshRef.current.position.z = Math.max(-11.5, Math.min(11.5, mainPlayerMeshRef.current.position.z + deltaZ));

        // Synchronize 2D coordinates hook for feedback
        setPosition2D({ x: mainPlayerMeshRef.current.position.x, z: mainPlayerMeshRef.current.position.z });

        // PORTAL TRIGGERS CHECKING BOUNDARIES IN REAL-TIME
        const px = mainPlayerMeshRef.current.position.x;
        const pz = mainPlayerMeshRef.current.position.z;

        // North: Open world (x near 0, z < -8)
        if (Math.abs(px) < 2.5 && pz < -7.8) {
          setPortalFocus('north');
        } 
        // South: Vecindario (x near 0, z > 7.8)
        else if (Math.abs(px) < 2.5 && pz > 7.8) {
          setPortalFocus('south');
        }
        // East: My House (x > 7.8, z near 0)
        else if (px > 7.8 && Math.abs(pz) < 2.5) {
          setPortalFocus('east');
        }
        else {
          setPortalFocus(null);
        }
      }

      // Animate simulated other peers moving wiggles randomly
      Object.keys(peerMeshesRef.current).forEach((id, index) => {
        const peer = peerMeshesRef.current[id];
        if (peer) {
          // Add a waving/scaling animation
          peer.position.y = 0.6 + Math.sin(elapsed * 3 + index) * 0.08;
          // Slowly rotate
          peer.rotation.y += 0.01;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // CLEANUP
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (canvas3DRef.current) {
        canvas3DRef.current.removeEventListener('mousedown', handleCanvasClick);
      }
      renderer.dispose();
      scene.clear();
    };
  }, [playerDominant, playersList.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (auth.currentUser) {
      try {
        const chatRef = collection(db, 'chat');
        await addDoc(chatRef, {
          sender: playerUsername || auth.currentUser.displayName || 'Guardián',
          avatarUrl: auth.currentUser.photoURL || '',
          text: inputText,
          timestamp,
          userId: auth.currentUser.uid,
          isNitz: false
        });
        setInputText('');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'chat');
      }
    } else {
      // Local fallback simulation
      const newMsg: ChatMessage = {
        id: `m_user_${Date.now()}`,
        sender: playerUsername || 'Tú',
        avatarUrl: '',
        text: inputText,
        timestamp,
      };
      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      
      {/* Header bar and signals */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <Compass className="w-8 h-8 text-[#dec1ac] animate-spin" style={{ animationDuration: '30s' }} />
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-headline-lg text-white">Lobby Social 3D: Atrio de las Almas</h1>
            <p className="text-xs text-[#919097] uppercase tracking-wider">Muévete por el atrio 3D con WASD / flechas o haz click. Entra a portales o cambia de zona.</p>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => onNavigateToView('open_world')}
            className="px-3.5 py-2 bg-red-950/20 text-red-400 border border-red-500/30 text-xs font-bold rounded-lg hover:bg-red-500/10 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Mundo Abierto / PvP</span>
          </button>
          <button 
            onClick={() => onNavigateToView('vecindario')}
            className="px-3.5 py-2 bg-emerald-950/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-lg hover:bg-emerald-500/10 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Map className="w-4 h-4" />
            <span>Vecindario 3D</span>
          </button>
          <button 
            onClick={() => onNavigateToView('crafting')}
            className="px-3.5 py-2 bg-amber-950/20 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-lg hover:bg-amber-500/10 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>Forjar Ítems</span>
          </button>
        </div>
      </div>

      {/* 3D PLAYGROUND AND ACTIVE PORTALS PROMPTER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Walkable 3D Canvas center */}
        <div className="lg:col-span-8 flex flex-col justify-between h-[500px] bg-gradient-to-b from-[#111326] to-[#04050d] rounded-xl border border-white/10 overflow-hidden relative shadow-2xl p-4">
          
          {/* Controls feedback coordinate tag */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none text-[9px] font-mono uppercase bg-black/60 border border-white/5 py-1 px-2.5 rounded text-[#919097] flex items-center gap-2">
            <Move className="w-3.5 h-3.5 text-tertiary" />
            <span>COORD REAL: x: {position2D.x.toFixed(1)}, z: {position2D.z.toFixed(1)}</span>
          </div>

          <div className="absolute top-4 right-4 z-10 pointer-events-none text-[10px] font-bold text-eme-300">
            <span className="text-emerald-400 animate-pulse">&bull; CANAL DE VOZ SOCIAL LIVE</span>
          </div>

          {/* Canvas Mount */}
          <canvas ref={canvas3DRef} className="w-full h-full rounded-lg cursor-crosshair" />

          {/* Portal Approaching Dialog Alert */}
          <AnimatePresence>
            {portalFocus && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 w-80 bg-black/90 p-4 border rounded-xl shadow-2xl flex flex-col items-center text-center space-y-3"
                style={{
                  borderColor: portalFocus === 'north' ? '#ef4444' : portalFocus === 'south' ? '#10b981' : '#8b5cf6'
                }}
              >
                {portalFocus === 'north' && (
                  <>
                    <ShieldAlert className="w-7 h-7 text-red-500 animate-bounce" />
                    <h5 className="text-xs font-bold text-red-400 uppercase tracking-widest">Portal: Mundo Abierto & PvP</h5>
                    <p className="text-[10px] text-gray-400 leading-snug">Vuela a las tierras salvajes de Albion. Cosecha recursos raros y combate, ¡riesgo de pérdida de mochila!</p>
                    <button 
                      onClick={() => onNavigateToView('open_world')}
                      className="px-5 py-1.5 bg-red-500 text-white font-bold text-[10px] rounded-lg hover:bg-white hover:text-black transition-all"
                    >
                      CRUZAR PORTAL ROJO
                    </button>
                  </>
                )}
                {portalFocus === 'south' && (
                  <>
                    <Map className="w-7 h-7 text-emerald-400 animate-bounce" />
                    <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Portal: Vecindario 3D</h5>
                    <p className="text-[10px] text-gray-400 leading-snug">Visita las residencias de tus peers místicas o entra a tu plaza para colocar muebles modelados.</p>
                    <button 
                      onClick={() => onNavigateToView('vecindario')}
                      className="px-5 py-1.5 bg-emerald-500 text-black font-bold text-[10px] rounded-lg hover:bg-white transition-all"
                    >
                      ENTRAR AL VECINDARIO
                    </button>
                  </>
                )}
                {portalFocus === 'east' && (
                  <>
                    <Compass className="w-7 h-7 text-purple-400 animate-bounce" />
                    <h5 className="text-xs font-bold text-purple-400 uppercase tracking-widest">Portal: Tu Cabaña</h5>
                    <p className="text-[10px] text-gray-400 leading-snug">Regresa a tu refugio rutilante para alimentar o charlar directamente con tu Nitz de Origen.</p>
                    <button 
                      onClick={() => onNavigateToView('home')}
                      className="px-5 py-1.5 bg-purple-500 text-white font-bold text-[10px] rounded-lg hover:bg-white hover:text-black transition-all"
                    >
                      REGRESAR A CASA
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Under instruction tip */}
          <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
            <span className="text-[8px] font-mono uppercase text-gray-500">
              Usa WASD / Flechas o Click en el piso para aproximarte a los círculos de colores
            </span>
          </div>
        </div>

        {/* Action Chats world channel right side */}
        <div className="lg:col-span-4 flex flex-col h-[500px] bg-[#121424] rounded-xl border border-white/10 overflow-hidden shadow-xl">
          <div className="bg-[#1b1e32] border-b border-white/5 py-4 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <MessageSquare className="w-4 h-4 text-[#dec1ac]" />
              <span className="text-xs uppercase font-bold tracking-wider">Canal Aldea Central</span>
            </div>
            <span className="text-[9px] bg-white/5 text-[#c4c5da] px-2 py-0.5 rounded font-mono">PTP-GRID</span>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar flex flex-col">
            <div className="text-center text-[9px] text-[#919097] pb-2 border-b border-white/5 uppercase font-mono">
              Sintonizando canal auditivo seguro
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto max-h-[340px] custom-scrollbar">
              {messages.map((m) => {
                const isMe = m.sender === playerUsername || m.sender === 'Tú';
                return (
                  <div key={m.id} className="space-y-1">
                    <div className="flex items-baseline justify-between text-[11px] font-semibold text-[#dec1ac]">
                      <span className={isMe ? "text-tertiary" : ""}>{m.sender}</span>
                      <span className="text-[9px] text-[#919097] font-mono">{m.timestamp}</span>
                    </div>
                    <div className={`p-2.5 rounded-lg text-xs leading-relaxed ${isMe ? 'bg-[#1a1c32] text-white border border-white/5' : 'bg-white/2 text-[#c4c5da]'}`}>
                      {m.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Message input */}
          <form onSubmit={handleSendMessage} className="p-3 bg-[#111324] border-t border-white/5 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe en el chat global..."
              className="flex-1 bg-[#1c1e32] border border-white/10 p-3 rounded text-xs text-[#e0e0fa] placeholder-[#919097] outline-none focus:border-tertiary focus:bg-[#20223a] transition-all"
            />
            <button
              type="submit"
              className="p-3 bg-[#c4c5da] hover:bg-white text-black rounded-lg transition-all active:scale-95 flex items-center justify-center shadow-md font-bold"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>

    </div>
  );
};
