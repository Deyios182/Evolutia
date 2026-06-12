import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Users, Sparkles, Heart, Plus, Trash2, ArrowLeft, Sofa, Star, MapPin, ZoomIn, RotateCw } from 'lucide-react';
import * as THREE from 'three';
import { PlayerProgress, CraftableItem, AvatarCustomization, EmotionName } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';

const EMOTION_COLORS: Record<EmotionName, number> = {
  Alegría: 0xffd700,    // Gold
  Amor: 0xff1493,       // Vibrant Pink
  Ira: 0xff3b30,        // Intense Red-Orange
  Miedo: 0x4b0082,      // Indigo / Deep Indigo
  Serenidad: 0x00e1d9,  // Emerald Sky Blue
  Tristeza: 0x3278ff,   // Royal Blue
  Confianza: 0x2cd178,  // Soft Emerald Green
  Sorpresa: 0xff9f29,   // Electric Amber/Orange
  Orgullo: 0xce7aff,    // Radiating Magenta/Violet
};

function createDetailedNitzMesh(
  avatar: AvatarCustomization,
  dominantEmotion: EmotionName,
  phase: number,
  customScale: number = 0.35
): THREE.Group {
  const group = new THREE.Group();

  // Resolve color
  let nColor = EMOTION_COLORS[dominantEmotion] || 0xfdcc15;
  if (avatar.colorTheme === 'abyssal') nColor = 0x8b5cf6;
  else if (avatar.colorTheme === 'solstice') nColor = 0xf59e0b;
  else if (avatar.colorTheme === 'primeval') nColor = 0xef4444;

  // 1. Body
  const bodyGeometry = new THREE.SphereGeometry(1.2, 24, 24);
  const bodyMaterial = new THREE.MeshPhongMaterial({
    color: 0xf5f8ff,
    emissive: 0x111422,
    shininess: 90,
  });
  const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 2. Eyes
  const eyesGroup = new THREE.Group();
  eyesGroup.position.set(0, 0.25, 1.0);
  group.add(eyesGroup);

  const eyeGeo = new THREE.SphereGeometry(0.18, 16, 16);
  const eyeMat = new THREE.MeshPhongMaterial({ color: 0x070912, shininess: 120 });
  const leftEyeSocket = new THREE.Mesh(eyeGeo, eyeMat);
  leftEyeSocket.position.set(-0.45, 0, 0.1);
  leftEyeSocket.scale.set(1.2, 1, 0.5);
  const rightEyeSocket = new THREE.Mesh(eyeGeo, eyeMat);
  rightEyeSocket.position.set(0.45, 0, 0.1);
  rightEyeSocket.scale.set(1.2, 1, 0.5);
  eyesGroup.add(leftEyeSocket, rightEyeSocket);

  // Pupils (dynamically colored by emotion/theme)
  const pupilGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const pupilMat = new THREE.MeshBasicMaterial({ color: nColor });
  const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
  leftPupil.position.set(-0.45, 0, 0.18);
  leftPupil.scale.set(1.1, 1.3, 0.4);
  const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
  rightPupil.position.set(0.45, 0, 0.18);
  rightPupil.scale.set(1.1, 1.3, 0.4);
  eyesGroup.add(leftPupil, rightPupil);

  // Shine Spots
  const shineGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const shineL = new THREE.Mesh(shineGeo, shineMat);
  shineL.position.set(-0.42, 0.05, 0.23);
  const shineR = new THREE.Mesh(shineGeo, shineMat);
  shineR.position.set(0.48, 0.05, 0.23);
  eyesGroup.add(shineL, shineR);

  // 3. Dynamic Tail
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, -0.6, -1.0);
  group.add(tailGroup);

  const segmentCount = 6;
  const segmentRadius = 0.18;
  let currentParent: THREE.Object3D = tailGroup;
  for (let i = 0; i < segmentCount; i++) {
    const sizeScale = 1.0 - (i / segmentCount) * 0.5;
    const length = 0.35;
    const tailSegGeo = new THREE.ConeGeometry(segmentRadius * sizeScale, length, 12);
    const tailSegMat = new THREE.MeshPhongMaterial({
      color: 0xf5f8ff,
      shininess: 60,
    });
    const tailSeg = new THREE.Mesh(tailSegGeo, tailSegMat);
    tailSeg.rotation.x = -Math.PI / 2;
    tailSeg.position.set(0, 0, -length * 0.6);

    const joint = new THREE.Group();
    joint.position.set(0, 0, i === 0 ? 0 : -length * 0.9);
    joint.add(tailSeg);
    currentParent.add(joint);
    currentParent = joint;
  }

  // 4. Ears (Phase 2+)
  const leftEarJoint = new THREE.Group();
  leftEarJoint.position.set(-0.6, 0.9, 0.2);
  leftEarJoint.rotation.set(0, 0.2, -0.4);
  group.add(leftEarJoint);

  const rightEarJoint = new THREE.Group();
  rightEarJoint.position.set(0.6, 0.9, 0.2);
  rightEarJoint.rotation.set(0, -0.2, 0.4);
  group.add(rightEarJoint);

  const earGeo = new THREE.ConeGeometry(0.28, 1.1, 12);
  earGeo.translate(0, 0.55, 0);
  const earInnerMat = new THREE.MeshPhongMaterial({ color: 0xff69b4 });
  const earOuterMat = new THREE.MeshPhongMaterial({ color: 0xf5f8ff });

  const leftEar = new THREE.Mesh(earGeo, earOuterMat);
  const leftEarInner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 12).translate(0, 0.45, 0.05), earInnerMat);
  leftEarJoint.add(leftEar, leftEarInner);

  const rightEar = new THREE.Mesh(earGeo, earOuterMat);
  const rightEarInner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 12).translate(0, 0.45, 0.05), earInnerMat);
  rightEarJoint.add(rightEar, rightEarInner);

  if (phase < 2) {
    leftEarJoint.visible = false;
    rightEarJoint.visible = false;
  }

  // 5. Crown / Halo / Accessories (Phase 5+ or specific accessory)
  const crownMat = new THREE.MeshPhongMaterial({
    color: 0xffd700,
    emissive: 0x5a4500,
    shininess: 120,
  });
  const crownGeo = new THREE.TorusGeometry(0.7, 0.05, 8, 24);
  const crownMesh = new THREE.Mesh(crownGeo, crownMat);
  crownMesh.rotation.x = Math.PI / 2.2;
  crownMesh.position.set(0, 1.7, -0.3);
  group.add(crownMesh);

  if (phase >= 4 || avatar.accessory === 'halo') {
    crownMesh.visible = true;
  } else if (avatar.accessory === 'horn_gold') {
    crownMesh.visible = true;
    crownMesh.material = new THREE.MeshPhongMaterial({ color: 0xffaa00, shininess: 200 });
  } else if (avatar.accessory === 'ribbon') {
    crownMesh.visible = true;
    crownMesh.material = new THREE.MeshPhongMaterial({ color: 0xff3b90, shininess: 100 });
  } else {
    crownMesh.visible = false;
  }

  // 6. Aura Outer Shell
  const auraGeo = new THREE.SphereGeometry(1.8, 24, 24);
  const auraMat = new THREE.MeshBasicMaterial({
    color: nColor,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
  });
  const auraMesh = new THREE.Mesh(auraGeo, auraMat);
  group.add(auraMesh);

  // Set visual scale
  const evolutionScale = 0.75 + phase * 0.22;
  group.scale.setScalar(customScale * evolutionScale);

  // Store references in userData for animation access in tick loops
  group.userData = {
    leftEar: leftEarJoint,
    rightEar: rightEarJoint,
    tail: tailGroup,
    aura: auraMesh,
    body: bodyMesh,
    crown: crownMesh,
    leftPupil,
    rightPupil,
    leftEyeSocket,
    rightEyeSocket,
    colorTheme: avatar.colorTheme,
    dominantEmotion,
    phase,
    accessory: avatar.accessory,
  };

  return group;
}

const dbRefPlaceholder = db;
import { collection, doc, query, limit, onSnapshot, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

interface VecindarioProps {
  progress: PlayerProgress;
  onSaveProgress: (newProg: PlayerProgress) => void;
}

interface Plot {
  id: string;
  ownerName: string;
  title: string;
  nitzName: string;
  emotions: string;
  isPlayer: boolean;
  builtDecorations: { name: string; slot: number; rarity: string; rotation?: number }[];
}

const NEIGHBOR_PLOTS: Plot[] = [
  {
    id: 'plot_player',
    ownerName: 'Tú',
    title: 'Tu Cabaña Sagrada',
    nitzName: '',
    emotions: 'Alegría/Serenidad',
    isPlayer: true,
    builtDecorations: []
  },
  {
    id: 'plot_luz',
    ownerName: 'Guardián_Luz',
    title: 'Catedral de Solsticio',
    nitzName: 'Solaria de Luz',
    emotions: 'Orgullo',
    isPlayer: false,
    builtDecorations: [
      { name: 'Trono del Rey Nitz', slot: 1, rarity: 'legendary', rotation: 0 },
      { name: 'Altar de Cristal de Serenidad', slot: 3, rarity: 'rare', rotation: Math.PI / 4 },
      { name: 'Estatua de Escamas Rutilantes', slot: 5, rarity: 'legendary', rotation: 0 }
    ]
  },
  {
    id: 'plot_anime',
    ownerName: 'AuraAnime',
    title: 'Cariñoso Jardín Astral',
    nitzName: 'KawaiNitz',
    emotions: 'Amor',
    isPlayer: false,
    builtDecorations: [
      { name: 'Sillón de Terciopelo Púrpura', slot: 2, rarity: 'epic', rotation: Math.PI / 2 },
      { name: 'Mesa de Cedro de los Vientos', slot: 4, rarity: 'common', rotation: 0 }
    ]
  },
  {
    id: 'plot_stellaria',
    ownerName: 'Stellaria',
    title: 'Santuario del Vacío',
    nitzName: 'StellarVoid',
    emotions: 'Serenidad',
    isPlayer: false,
    builtDecorations: [
      { name: 'Altar de Cristal de Serenidad', slot: 1, rarity: 'rare', rotation: 0 },
      { name: 'Sillón de Terciopelo Púrpura', slot: 5, rarity: 'epic', rotation: Math.PI }
    ]
  }
];

export const Vecindario: React.FC<VecindarioProps> = ({ progress, onSaveProgress }) => {
  const [visitedPlot, setVisitedPlot] = useState<Plot | null>(null);
  const [activeSlotToDecorate, setActiveSlotToDecorate] = useState<number | null>(null);
  const [socialHearts, setSocialHearts] = useState<Record<string, number>>({});
  const [syncedNeighbors, setSyncedNeighbors] = useState<Plot[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Rotate dictionaries for placed items to allow direct 3D orientation
  const [rotations, setRotations] = useState<Record<number, number>>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0
  });

  // Dynamic Real-time Neighbor Synchronization Listener from Firestore
  useEffect(() => {
    const qUsers = query(collection(db, 'users'), limit(20));
    const unsubscribe = onSnapshot(qUsers, (snapshot) => {
      const plotsList: Plot[] = [];
      
      // Always add the current player's plot first
      plotsList.push({
        id: 'plot_player',
        ownerName: progress.username || 'Tú',
        title: 'Tu Cabaña Sagrada',
        nitzName: progress.avatar.name || 'Tu Nitz de Origen',
        emotions: 'Alegría/Serenidad',
        isPlayer: true,
        builtDecorations: progress.houseDecorations.map(dec => {
          const item = progress.craftedItems.find(ci => ci.id === dec.itemId);
          return {
            name: item?.name || 'Mueble',
            slot: dec.slot,
            rarity: item?.rarity || 'common',
            rotation: rotations[dec.slot] || 0
          };
        })
      });

      snapshot.forEach((docSnap) => {
        if (docSnap.id === auth.currentUser?.uid) return; // skip self since it's already first
        const data = docSnap.data();
        
        // Find their built decorations
        const formattedDecs = (data.houseDecorations || []).map((dec: any) => {
          const item = (data.craftedItems || []).find((ci: any) => ci.id === dec.itemId);
          return {
            name: item?.name || 'Mueble',
            slot: dec.slot,
            rarity: item?.rarity || 'common',
            rotation: dec.rotation || 0
          };
        });

        // Set simulated names if needed
        plotsList.push({
          id: docSnap.id,
          ownerName: data.username || 'Guardián',
          title: `Cabaña de ${data.username || 'Guardián'}`,
          nitzName: data.avatar?.name || 'Nitz Místico',
          emotions: data.dominantEmotion || 'Serenidad',
          isPlayer: false,
          builtDecorations: formattedDecs
        });
      });

      // Merge with default offline mock neighbors so the neighborhood is beautifully populated
      const combined = [...plotsList];
      NEIGHBOR_PLOTS.forEach(staticPlot => {
        if (!staticPlot.isPlayer && !combined.some(p => p.ownerName === staticPlot.ownerName)) {
          combined.push(staticPlot);
        }
      });

      setSyncedNeighbors(combined);

      // Reactive Visitor Camera sync
      if (visitedPlot) {
        const updatedVisit = combined.find(p => p.id === visitedPlot.id);
        if (updatedVisit) {
          setVisitedPlot(updatedVisit);
        }
      }
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } catch (e) {
        // Keep caught silently to prevent UI-crash
      }
    });

    return () => unsubscribe();
  }, [progress.houseDecorations, progress.craftedItems, rotations, visitedPlot?.id]);

  // Camera Orbit states
  const cameraAngleRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: Math.PI / 4,
    phi: Math.PI / 6,
    radius: 9.5
  });
  const isDraggingRef = useRef<boolean>(false);
  const previousPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Three.js refs for interaction and raycasting tracking
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Clickable interactive slot bounds representation
  const slotInteractivesRef = useRef<{ slot: number; mesh: THREE.Mesh }[]>([]);
  const furnitureMeshesRef = useRef<{ slot: number; mesh: THREE.Mesh }[]>([]);

  // Trigger heart rating
  const handleLikeHouse = async (plotId: string) => {
    setSocialHearts(prev => ({
      ...prev,
      [plotId]: (prev[plotId] || 0) + 1
    }));
    onSaveProgress({
      ...progress,
      exp: progress.exp + 10
    });

    if (plotId !== 'plot_player' && !plotId.startsWith('plot_')) {
      try {
        const neighborRef = doc(db, 'users', plotId);
        await updateDoc(neighborRef, {
          likesCount: increment(1)
        });
      } catch (err) {
        console.error("Error giving companion heart:", err);
        try {
          handleFirestoreError(err, OperationType.WRITE, `users/${plotId}`);
        } catch (e) {
          // Keep it caught so it doesn't interrupt game play flow
        }
      }
    }
  };

  // Play a metallic toggle wood click
  const playPlacementChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(330, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(554, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
  };

  const handleSelectFurniture = (item: CraftableItem) => {
    if (!visitedPlot || activeSlotToDecorate === null) return;

    playPlacementChime();
    const nextDecorations = [...progress.houseDecorations];
    
    // Unplace existing slot item if any
    const existingIdx = nextDecorations.findIndex(d => d.slot === activeSlotToDecorate);
    if (existingIdx !== -1) {
      const removedItemId = nextDecorations[existingIdx].itemId;
      progress.craftedItems.forEach(ci => {
        if (ci.id === removedItemId) ci.placed = false;
      });
      nextDecorations.splice(existingIdx, 1);
    }

    // Place active item
    const itemToPlace = progress.craftedItems.find(ci => ci.id === item.id);
    if (itemToPlace) {
      itemToPlace.placed = true;
    }

    nextDecorations.push({ itemId: item.id, slot: activeSlotToDecorate });

    onSaveProgress({
      ...progress,
      houseDecorations: nextDecorations
    });
    setActiveSlotToDecorate(null);
  };

  const handleRemoveFurniture = (slot: number) => {
    playPlacementChime();
    const dec = progress.houseDecorations.find(d => d.slot === slot);
    if (!dec) return;

    const nextCrafted = progress.craftedItems.map(ci => {
      if (ci.id === dec.itemId) {
        return { ...ci, placed: false };
      }
      return ci;
    });

    const nextDecorations = progress.houseDecorations.filter(d => d.slot !== slot);

    onSaveProgress({
      ...progress,
      craftedItems: nextCrafted,
      houseDecorations: nextDecorations
    });
  };

  const handleRotateItem = (slot: number) => {
    playPlacementChime();
    setRotations(prev => ({
      ...prev,
      [slot]: (prev[slot] || 0) + Math.PI / 2
    }));
  };

  // Raycaster click listener on Canvas
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Filter target empty pads click
    const emptyPads = slotInteractivesRef.current.map(item => item.mesh);
    const intersectsPads = raycaster.intersectObjects(emptyPads);

    if (intersectsPads.length > 0) {
      const clickedMesh = intersectsPads[0].object as THREE.Mesh;
      const slotItem = slotInteractivesRef.current.find(item => item.mesh === clickedMesh);
      if (slotItem) {
        setActiveSlotToDecorate(slotItem.slot);
        playPlacementChime();
        return;
      }
    }

    // Filter items placed click to rotate or trigger operations
    const furnitureMeshes = furnitureMeshesRef.current.map(item => item.mesh);
    const intersectsFurniture = raycaster.intersectObjects(furnitureMeshes);

    if (intersectsFurniture.length > 0) {
      const clickedMesh = intersectsFurniture[0].object as THREE.Mesh;
      const furnItem = furnitureMeshesRef.current.find(item => item.mesh === clickedMesh);
      if (furnItem) {
        // Toggle rotational change or re-align
        handleRotateItem(furnItem.slot);
        return;
      }
    }
  };

  // Pointer camera drag handlers
  const handlePointerDown = (event: React.MouseEvent) => {
    isDraggingRef.current = true;
    previousPointerRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerMove = (event: React.MouseEvent) => {
    if (!isDraggingRef.current) return;

    const deltaX = event.clientX - previousPointerRef.current.x;
    const deltaY = event.clientY - previousPointerRef.current.y;

    previousPointerRef.current = { x: event.clientX, y: event.clientY };

    const angles = cameraAngleRef.current;
    angles.theta -= deltaX * 0.007; // rotate horizontal
    angles.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, angles.phi - deltaY * 0.007)); // vertical bound limit
  };

  const handlePointerUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Wheel to zoom in/out inside room
  const handleWheel = (event: React.WheelEvent) => {
    const delta = event.deltaY * 0.005;
    const angles = cameraAngleRef.current;
    angles.radius = Math.max(5.0, Math.min(18.0, angles.radius + delta));
  };

  // Three.js Render Lifecycle
  useEffect(() => {
    if (!visitedPlot || !canvasRef.current) return;

    const width = canvasRef.current.clientWidth || 500;
    const height = canvasRef.current.clientHeight || 400;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0c0d1b);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xdec1ac, 1.4, 25);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    // Room Floor (Wood tile grids)
    const floorGeo = new THREE.BoxGeometry(4.4, 0.15, 4.4);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x22130c, roughness: 0.95 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -0.075;
    scene.add(floorMesh);

    // Decorative grid helper on floor
    const gridHelper = new THREE.GridHelper(4.4, 10, 0xdec1ac, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Translucent Back Walls
    const wallMat = new THREE.MeshStandardMaterial({ 
      color: 0x0f1123, 
      roughness: 0.8,
      transparent: true,
      opacity: 0.85
    });

    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 4.4), wallMat);
    wallL.position.set(-2.2, 1.25, 0);
    scene.add(wallL);

    const wallR = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.5, 0.1), wallMat);
    wallR.position.set(0, 1.25, -2.2);
    scene.add(wallR);

    // Floating Nitz core avatar at height center
    let nitzMesh: THREE.Group | THREE.Mesh | null = null;
    if (visitedPlot.isPlayer) {
      let maxName: EmotionName = 'Alegría';
      let maxValue = -1;
      (Object.keys(progress.emotions) as EmotionName[]).forEach((key) => {
        if (progress.emotions[key] > maxValue) {
          maxValue = progress.emotions[key];
          maxName = key;
        }
      });
      
      nitzMesh = createDetailedNitzMesh(
        progress.avatar,
        maxName,
        progress.phase,
        0.35
      );
    } else {
      let mockAvatar: AvatarCustomization = {
        name: visitedPlot.nitzName || 'Nitz Vecino',
        accessory: 'none',
        auraType: 'none',
        colorTheme: 'classic',
        clothing: 'none'
      };
      let mockEmotion: EmotionName = 'Alegría';
      let mockPhase = 1;

      if (visitedPlot.ownerName === 'Guardián_Luz') {
        mockAvatar.accessory = 'halo';
        mockAvatar.colorTheme = 'solstice';
        mockEmotion = 'Orgullo';
        mockPhase = 5;
      } else if (visitedPlot.ownerName === 'AuraAnime') {
        mockAvatar.accessory = 'ribbon';
        mockEmotion = 'Amor';
        mockPhase = 3;
      } else if (visitedPlot.ownerName === 'Stellaria') {
        mockAvatar.colorTheme = 'abyssal';
        mockEmotion = 'Serenidad';
        mockPhase = 4;
      }

      nitzMesh = createDetailedNitzMesh(
        mockAvatar,
        mockEmotion,
        mockPhase,
        0.35
      );
    }
    
    nitzMesh.position.set(0, 1.3, 0);
    scene.add(nitzMesh);

    // COORDINATE SLOTS 1 to 5
    const SLOT_COORDS: Record<number, THREE.Vector3> = {
      1: new THREE.Vector3(-1.25, 0.08, 1.25),   // front-left
      2: new THREE.Vector3(1.25, 0.08, 1.25),    // front-right
      3: new THREE.Vector3(-1.25, 0.08, -1.25),  // back-left
      4: new THREE.Vector3(1.25, 0.08, -1.25),   // back-right
      5: new THREE.Vector3(0, 0.08, 1.35),       // front-center
    };

    // Grab current furnishings
    const activeDecorations = visitedPlot.isPlayer 
      ? progress.houseDecorations.map(d => {
          const item = progress.craftedItems.find(ci => ci.id === d.itemId);
          return { name: item?.name || 'Mesa', slot: d.slot, rarity: item?.rarity || 'common' };
        })
      : visitedPlot.builtDecorations;

    // Flush old trackers
    slotInteractivesRef.current = [];
    furnitureMeshesRef.current = [];

    // Place coordinates meshes
    [1, 2, 3, 4, 5].forEach((slot) => {
      const coord = SLOT_COORDS[slot];
      const dec = activeDecorations.find(d => d.slot === slot);

      if (dec) {
        // Render placing furniture
        let furnColor = 0x64748b;
        if (dec.rarity === 'common') furnColor = 0xb45309; // orange brown
        if (dec.rarity === 'rare') furnColor = 0x06b6d4;    // transparent blue
        if (dec.rarity === 'epic') furnColor = 0x8b5cf6;    // epic purple
        if (dec.rarity === 'legendary') furnColor = 0xd97706; // bright gold
        
        // Draw physical box model
        let furnGeo;
        if (dec.name.includes('Sillón') || dec.name.includes('Sofa')) {
          furnGeo = new THREE.BoxGeometry(0.85, 0.45, 0.6);
        } else if (dec.name.includes('Trono')) {
          furnGeo = new THREE.BoxGeometry(0.65, 1.15, 0.65);
        } else if (dec.name.includes('Altar')) {
          furnGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.68, 8);
        } else {
          furnGeo = new THREE.BoxGeometry(0.72, 0.52, 0.72);
        }

        const fMat = new THREE.MeshStandardMaterial({ 
          color: furnColor, 
          roughness: 0.35,
          metalness: dec.rarity === 'legendary' ? 0.75 : 0.1,
          emissive: furnColor,
          emissiveIntensity: dec.rarity === 'legendary' ? 0.25 : 0
        });

        const furnMesh = new THREE.Mesh(furnGeo, fMat);
        furnMesh.position.copy(coord);
        furnMesh.position.y += (furnGeo.type === 'CylinderGeometry') ? 0.34 : 0.26;

        // Apply rotation either from local state or friendly preset
        const itemRotation = visitedPlot.isPlayer ? (rotations[slot] || 0) : (dec.rotation || 0);
        furnMesh.rotation.y = itemRotation;

        scene.add(furnMesh);
        furnitureMeshesRef.current.push({ slot, mesh: furnMesh });

      } else if (visitedPlot.isPlayer) {
        // Empty slot in player house -> Draw high fidelity glowing holographic ring pad
        const ringGeoP = new THREE.RingGeometry(0.38, 0.48, 16);
        ringGeoP.rotateX(-Math.PI / 2); // lie horizontal
        const ringMatP = new THREE.MeshBasicMaterial({ 
          color: 0xdec1ac, 
          side: THREE.DoubleSide, 
          transparent: true, 
          opacity: 0.75 
        });

        const padMesh = new THREE.Mesh(ringGeoP, ringMatP);
        padMesh.position.copy(coord);
        padMesh.position.y += 0.05;

        scene.add(padMesh);
        slotInteractivesRef.current.push({ slot, mesh: padMesh });
      }
    });

    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const t = clock.getElapsedTime();

      // Flutuaciones for Nitz
      if (nitzMesh) {
        nitzMesh.position.y = 1.35 + Math.sin(t * 2.8) * 0.15;
        nitzMesh.rotation.y += 0.015;

        // Detailed animations from userData
        const ud = nitzMesh.userData;
        if (ud && ud.body) {
          // 1. Ear wiggles based on phase
          if (ud.leftEar && ud.rightEar && ud.phase >= 2) {
            ud.leftEar.rotation.z = -0.4 + Math.sin(t * 4) * 0.08;
            ud.rightEar.rotation.z = 0.4 - Math.sin(t * 4) * 0.08;
          }
          // 2. Elegant crown float
          if (ud.crown && ud.crown.visible) {
            ud.crown.position.y = 1.5 + Math.sin(t * 1.5) * 0.08;
            ud.crown.rotation.y = t * 0.8;
          }
          // 3. Body breathing
          const breath = 1.0 + Math.sin(t * 1.5) * 0.04;
          ud.body.scale.set(breath, 1.0 / breath, breath);
          // 4. Aura pulsing
          if (ud.aura) {
            const pulse = 1.05 + Math.sin(t * 4) * 0.06;
            ud.aura.scale.set(pulse, pulse, pulse);
          }
          // 5. Tail wagging based on emotional speed
          if (ud.tail) {
            let segment = ud.tail.children[0];
            let depth = 0;
            let speedMultiplier = 6.0;
            let amplitude = 0.25;
            if (ud.dominantEmotion === 'Ira') {
              speedMultiplier = 8.5;
              amplitude = 0.35;
            } else if (ud.dominantEmotion === 'Tristeza') {
              speedMultiplier = 1.5;
              amplitude = 0.08;
            }
            while (segment && depth < 6) {
              const waveAngle = Math.sin(t * speedMultiplier - depth * 0.5) * amplitude;
              segment.rotation.z = waveAngle;
              segment.rotation.y = Math.cos(t * 1.5 + depth * 0.3) * 0.05;
              
              const nextJoint = segment.parent?.children.find((c: any) => c !== segment);
              segment = nextJoint ? nextJoint.children[0] : null;
              depth++;
            }
          }
        }
      }

      // Pulse empty celestial holographic pads
      slotInteractivesRef.current.forEach(item => {
        const mesh = item.mesh;
        const scale = 1.0 + Math.sin(t * 4) * 0.08;
        mesh.scale.set(scale, scale, 1);
        
        // Flicker opacity
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.5 + Math.sin(t * 3) * 0.25;
      });

      // Update camera relative to Orbit angles
      const angles = cameraAngleRef.current;
      const radius = angles.radius;
      
      const px = radius * Math.sin(angles.theta) * Math.cos(angles.phi);
      const py = radius * Math.sin(angles.phi);
      const pz = radius * Math.cos(angles.theta) * Math.cos(angles.phi);

      camera.position.set(px, py, pz);
      camera.lookAt(0, 0.4, 0);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!canvasRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = canvasRef.current.clientWidth;
      const h = canvasRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      scene.clear();
    };
  }, [visitedPlot, progress.houseDecorations, progress.craftedItems, rotations]);

  const getUnplacedFurniture = (): CraftableItem[] => {
    return progress.craftedItems.filter(ci => ci.type === 'furniture' && !ci.placed);
  };

  const getPlacedItemInSlot = (slot: number): CraftableItem | undefined => {
    const decor = progress.houseDecorations.find(d => d.slot === slot);
    if (!decor) return undefined;
    return progress.craftedItems.find(ci => ci.id === decor.itemId);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      
      <AnimatePresence mode="wait">
        {!visitedPlot ? (
          /* REGULAR MAP NAVIGATION VIEW */
          <motion.div
            key="neighborhood_map"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            <div className="border-b border-white/5 pb-4">
              <h1 className="text-xl md:text-2xl font-bold text-white font-headline-lg flex items-center gap-2">
                <Users className="w-6 h-6 text-[#dec1ac]" />
                Vecindario de Cabañas Inmersivas 3D
              </h1>
              <p className="text-xs text-[#919097] uppercase tracking-wider">Explora el mapa del gremio, visita cabañas ajenas o amuebla la tuya de forma interactiva en 3D.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {syncedNeighbors.map((plot) => {
                const isMe = plot.isPlayer;
                const activeNitzName = isMe ? (progress.avatar.name || 'Nitz de Origen') : plot.nitzName;
                const likeCount = socialHearts[plot.id] || 0;

                return (
                  <div key={plot.id} className="glass-panel bg-[#121424]/90 rounded-xl p-5 border border-white/10 flex flex-col justify-between space-y-4 hover:border-tertiary transition-all shadow-xl group">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono text-tertiary uppercase tracking-widest flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-tertiary" /> Parcela #{plot.id.includes('_') ? plot.id.split('_')[1].toUpperCase() : plot.id.slice(0, 5).toUpperCase()}
                        </span>
                        <h3 className="text-lg font-bold text-white font-headline-lg">{isMe ? 'Mi Residencia Mística 3D' : plot.title}</h3>
                        <p className="text-xs text-[#919097] font-mono capitalize">Dueño: {isMe ? (progress.username || 'Guardian') : plot.ownerName}</p>
                      </div>

                      <button 
                        onClick={() => handleLikeHouse(plot.id)}
                        className="p-2 bg-pink-950/20 text-pink-400 border border-pink-500/20 hover:bg-pink-500/10 rounded-full flex items-center gap-1.5 text-xs transition-all active:scale-90"
                      >
                        <Heart className="w-3.5 h-3.5 fill-pink-500/40" />
                        <span>{likeCount}</span>
                      </button>
                    </div>

                    <div className="p-3 bg-black/40 rounded-lg text-xs leading-relaxed text-[#c4c5da] flex items-center justify-between">
                      <span>Nitz Habitante: <strong>{activeNitzName}</strong></span>
                      <span className="text-[10px] uppercase font-mono tracking-wider border border-white/5 py-0.5 px-2 rounded">
                        Fase {isMe ? progress.phase : 4}
                      </span>
                    </div>

                    <button
                      onClick={() => setVisitedPlot(plot)}
                      className="w-full py-3 bg-[#dec1ac] hover:bg-white text-black font-extrabold rounded-lg text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Home className="w-4 h-4" />
                      <span>ENTRAR Y EDITAR EN 3D</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          /* ACTIVE 3D CABIN VIEWPORT */
          <motion.div
            key="house_detail"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-4 flex-wrap gap-4">
              <button 
                onClick={() => setVisitedPlot(null)}
                className="flex items-center gap-1.5 text-xs text-[#dec1ac] hover:text-white transition-colors uppercase font-bold"
              >
                <ArrowLeft className="w-4 h-4" /> Volver al Map Vecindario
              </button>
              
              <div className="text-right">
                <h2 className="text-lg font-bold text-white font-headline-lg">
                  {visitedPlot.isPlayer ? 'Mi Casa Interactiva Real' : visitedPlot.title}
                </h2>
                <span className="text-[10px] text-[#919097] font-mono leading-none">
                  Viendo: {visitedPlot.isPlayer ? (progress.username || 'Guardador') : visitedPlot.ownerName}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Interactive 3D Room Studio */}
              <div className="lg:col-span-8 flex flex-col justify-between h-[500px] bg-gradient-to-b from-[#111326] to-[#04050d] rounded-xl border border-white/10 overflow-hidden relative shadow-2xl p-4">
                
                {/* Visual HUD overlays */}
                <div className="absolute top-4 left-4 z-10 pointer-events-none select-none">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-[#dec1ac] bg-black/65 border border-white/10 p-2 rounded block backdrop-blur-sm">
                    Estudio de Construcción 3D
                  </span>
                </div>

                <div className="absolute top-4 right-4 z-10 flex gap-2">
                  <div className="bg-black/65 border border-white/10 rounded-full px-3 py-1 text-[9.5px] text-gray-300 font-mono flex items-center gap-1.5 backdrop-blur-md">
                    <ZoomIn className="w-3.5 h-3.5 text-tertiary" />
                    <span>Arrastra para Orbitar &nbsp;•&nbsp; Scroll para Zoom</span>
                  </div>
                </div>

                {/* Canvas viewport Mount */}
                <canvas 
                  ref={canvasRef} 
                  onClick={handleCanvasClick}
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUpOrLeave}
                  onMouseLeave={handlePointerUpOrLeave}
                  onWheel={handleWheel}
                  className="w-full h-full rounded-lg cursor-grab active:cursor-grabbing" 
                />

                {/* Interactive help text overlay */}
                {visitedPlot.isPlayer && (
                  <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none text-center">
                    <p className="text-[10px] text-emerald-400 bg-black/80 border border-emerald-500/20 px-4 py-1.5 rounded-full inline-block font-mono uppercase tracking-wider shadow-lg">
                      👋 HAZ CLIC EN LOS ANILLOS BRILLANTES DEL PISO PARA COLOCAR MUEBLES, O EN LOS MUEBLES PARA ROTARLOS!
                    </p>
                  </div>
                )}
              </div>

              {/* Sidebar editing controllers panel */}
              <div className="lg:col-span-4 bg-[#121424]/95 rounded-xl border border-white/10 p-5 flex flex-col justify-between h-[500px] overflow-y-auto custom-scrollbar">
                
                {visitedPlot.isPlayer ? (
                  /* THE PLAYER BUILD CHANNELS EDITOR */
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5 border-b border-white/5 pb-2">
                      <h4 className="text-xs uppercase font-bold text-[#dec1ac] tracking-wide font-mono flex items-center gap-1.5">
                        <Sofa className="w-4 h-4 text-tertiary" /> Forjas Construidas
                      </h4>
                      <p className="text-[10.5px] text-gray-400 leading-relaxed">Las siguientes ranuras corresponden a los cuadrantes del plano de tu cabaña.</p>
                    </div>

                    {/* Ranuras status panels */}
                    <div className="space-y-2 flex-1 my-3 overflow-y-auto max-h-[300px] custom-scrollbar p-0.5">
                      {[1, 2, 3, 4, 5].map((slot) => {
                        const item = getPlacedItemInSlot(slot);
                        return (
                          <div key={slot} className="p-2 px-3 bg-black/45 border border-white/5 rounded-lg flex flex-col gap-2 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-[10.5px] text-emerald-400">Ranura Piso #{slot}</span>
                              {item && (
                                <button
                                  onClick={() => handleRotateItem(slot)}
                                  className="text-[10px] text-[#dec1ac] hover:text-white p-1 bg-white/5 rounded flex items-center gap-1 font-mono transition-colors"
                                  title="Rotar mueble 90º en 3D"
                                >
                                  <RotateCw className="w-3 h-3" />
                                  <span>Rotar (90º)</span>
                                </button>
                              )}
                            </div>

                            {item ? (
                              <div className="flex items-center justify-between bg-white/2 p-2 rounded border border-white/5">
                                <span className="font-semibold text-[11px] truncate">{item.name}</span>
                                <button
                                  onClick={() => handleRemoveFurniture(slot)}
                                  className="text-red-400 hover:text-red-300 p-1 bg-red-950/20 rounded transition-all ml-1"
                                  title="Retirar del mapa 3D"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setActiveSlotToDecorate(slot)}
                                className="w-full py-1.5 bg-[#dec1ac]/15 hover:bg-[#dec1ac]/25 text-tertiary rounded-md font-bold text-[10.5px] border border-tertiary/20 flex items-center justify-center gap-1 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" /> Colocar Accesorio
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[10px] text-gray-500 italic uppercase tracking-wider font-mono border-t border-white/5 pt-2">
                      Sugerencia: Cambia el ángulo orbitando la cámara de arriba a abajo.
                    </div>
                  </div>
                ) : (
                  /* VISITOR PANEL */
                  <div className="space-y-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div>
                        <span className="text-[9.5px] font-mono text-tertiary uppercase block">Inspección de Residencia 3D</span>
                        <h4 className="text-md font-bold text-white font-headline-lg">Cabaña de {visitedPlot.ownerName}</h4>
                      </div>

                      <p className="text-xs text-gray-300 leading-relaxed font-sans">
                        Has entrado en el santuario espiritual flotante de tu colega. Su Nitz vigila y brilla en sintonía con las frecuencias de {visitedPlot.emotions}.
                      </p>

                      <div className="space-y-2 pt-2">
                        <span className="text-[10px] font-mono text-[#919097] uppercase block">Inventarios colocados en sala:</span>
                        <div className="space-y-2">
                          {visitedPlot.builtDecorations.map((d, idx) => (
                            <div key={idx} className="p-2.5 bg-black/45 border border-white/5 rounded-lg text-xs flex justify-between items-center font-mono">
                              <span className="text-gray-200 font-semibold">{d.name}</span>
                              <span className="text-[9px] uppercase tracking-wider border border-white/10 px-2 py-0.5 rounded text-cyan-400 bg-cyan-950/15">
                                {d.rarity}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleLikeHouse(visitedPlot.id)}
                      className="w-full p-3 bg-pink-500 hover:bg-pink-400 text-white font-black rounded-lg text-xs transition active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Heart className="w-4 h-4 fill-white" />
                      <span>Dejar Regalo de Corazón (+10 EXP mística!)</span>
                    </button>
                  </div>
                )}

              </div>

            </div>

            {/* FLOATING UNPLACED FURNITURE ITEM SELECTOR POPUP */}
            <AnimatePresence>
              {activeSlotToDecorate !== null && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#121424] border border-white/10 p-5 rounded-2xl w-full max-w-md space-y-4"
                  >
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Forjas Desarmadas para Ranura #{activeSlotToDecorate}</h4>
                      <button 
                        onClick={() => setActiveSlotToDecorate(null)}
                        className="text-gray-400 hover:text-white transition-colors text-xs"
                      >
                        Cerrar
                      </button>
                    </div>

                    {getUnplacedFurniture().length > 0 ? (
                      <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar p-1">
                        {getUnplacedFurniture().map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSelectFurniture(item)}
                            className="w-full text-left p-3 bg-black/45 border border-white/5 rounded-lg hover:border-tertiary hover:bg-[#1c1e33] transition-all flex items-center justify-between text-xs"
                          >
                            <div className="space-y-0.5">
                              <span className="font-bold text-[#dbdbea] block">{item.name}</span>
                              <span className="text-[10px] text-gray-500 capitalize font-mono">Tipo: decoración • {item.rarity}</span>
                            </div>
                            <Plus className="w-4 h-4 text-tertiary" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 space-y-2">
                        <Sofa className="w-10 h-10 text-gray-500/40 mx-auto animate-pulse" />
                        <p className="text-xs text-gray-400">Ningún mueble místico disponible.</p>
                        <p className="text-[10px] text-[#dec1ac]">Usa tus materiales forjados en el Workbench para crear mesas o altar místico primero.</p>
                      </div>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
