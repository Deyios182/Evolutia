import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Sparkles, Shirt, Palette, ShieldAlert, Check, Mic, MicOff } from 'lucide-react';
import { PlayerProgress, PlayerAvatar } from '../types';
import { db, auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import * as THREE from 'three';

interface PlayerAvatarCustomizeUIProps {
  progress: PlayerProgress;
  onSaveProgress: (p: PlayerProgress) => void;
  onClose: () => void;
}

export function PlayerAvatarCustomizeUI({ progress, onSaveProgress, onClose }: PlayerAvatarCustomizeUIProps) {
  const currentAvatar = progress.playerAvatar || {
    style: 'style1',
    bodyColor: '#3b82f6',
    detailColor: '#f59e0b',
    accessory: 'none',
    eyeStyle: 'round',
    mouthStyle: 'happy',
    customized: false
  };

  const [style, setStyle] = useState<PlayerAvatar['style']>(currentAvatar.style || 'style1');
  const [bodyColor, setBodyColor] = useState(currentAvatar.bodyColor || '#3b82f6');
  const [detailColor, setDetailColor] = useState(currentAvatar.detailColor || '#f59e0b');
  const [accessory, setAccessory] = useState<PlayerAvatar['accessory']>(currentAvatar.accessory || 'none');
  const [eyeStyle, setEyeStyle] = useState<PlayerAvatar['eyeStyle']>(currentAvatar.eyeStyle || 'round');
  const [mouthStyle, setMouthStyle] = useState<PlayerAvatar['mouthStyle']>(currentAvatar.mouthStyle || 'happy');
  const [saving, setSaving] = useState(false);

  // Voice Proximity / Lipsync Test states
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSpeakingSimulated, setIsSpeakingSimulated] = useState(false);
  const [volume, setVolume] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const avatarGroupRef = useRef<THREE.Group | null>(null);
  const mouthMeshRef = useRef<THREE.Object3D | null>(null);

  // Audio mic nodes references
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Presets
  const stylesList: { id: PlayerAvatar['style']; label: string; desc: string }[] = [
    { id: 'style1', label: 'Estilo 1 (Humanoide)', desc: 'Chasis cibernético esbelto' },
    { id: 'style2', label: 'Estilo 2 (Túnica Astral)', desc: 'Líneas místicas flotantes' },
    { id: 'style3', label: 'Estilo 3 (Armadura Shard)', desc: 'Coraza robusta facetada' },
  ];

  const accessoriesList: { id: PlayerAvatar['accessory']; label: string; icon: string }[] = [
    { id: 'none', label: 'Ninguno', icon: '❌' },
    { id: 'halo', label: 'Halo Áureo', icon: '😇' },
    { id: 'cap', label: 'Gorra Táctica', icon: '🧢' },
    { id: 'glasses', label: 'Visor Holográfico', icon: '🕶️' },
    { id: 'backpack', label: 'Mochila Exploradora', icon: '🎒' },
  ];

  const eyesList: { id: PlayerAvatar['eyeStyle']; label: string; icon: string }[] = [
    { id: 'round', label: 'Ojos Circulares', icon: '👀' },
    { id: 'glow', label: 'Ojos Brillantes', icon: '✨' },
    { id: 'narrow', label: 'Ojos Rasgados', icon: '😑' },
  ];

  const mouthsList: { id: PlayerAvatar['mouthStyle']; label: string; icon: string }[] = [
    { id: 'happy', label: 'Sonriente', icon: '🙂' },
    { id: 'neutral', label: 'Serio', icon: '😐' },
    { id: 'sad', label: 'Triste', icon: '🙁' },
    { id: 'surprised', label: 'Sorprendido', icon: '😮' },
  ];

  const colorPresets = [
    '#3b82f6', // Ocean Blue
    '#ec4899', // Pink Cosmo
    '#10b981', // Forest Moss
    '#f59e0b', // Solar Gold
    '#8b5cf6', // Indigo Void
    '#ef4444', // Ruby Flame
    '#e2e8f0', // Pearl Light
    '#1e293b', // Deep Void
  ];

  const detailPresets = [
    '#f59e0b', '#00e1d9', '#ff3b30', '#a855f7', '#ffffff', '#10b981', '#fbbf24', '#ff85a2'
  ];

  // Mic access logic
  useEffect(() => {
    let animId = 0;
    if (isMicActive) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            streamRef.current = stream;
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            analyserRef.current = analyser;
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const sample = () => {
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
              }
              const avg = sum / bufferLength;
              setVolume(avg / 120); // normalized factor
              animId = requestAnimationFrame(sample);
            };
            sample();
          })
          .catch(err => {
            console.error("Error connecting to mic:", err);
            setIsMicActive(false);
          });
      }
    } else {
      setVolume(0);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isMicActive]);

  // Create avatar meshes locally inside canvas
  const buildAvatarMesh = () => {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4 });
    const detailMat = new THREE.MeshStandardMaterial({ color: detailColor, roughness: 0.3 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5f8ff, roughness: 0.4 });

    // --- BASE BODY STRUCTURE ---
    if (style === 'style2') {
      // Style 2: Robe/Sage Style
      const torsoGeo = new THREE.ConeGeometry(0.38, 1.1, 16);
      torsoGeo.translate(0, 0.55, 0);
      const torso = new THREE.Mesh(torsoGeo, bodyMat);
      torso.position.y = 0.1;
      group.add(torso);

      // Mystical shoulder overlay
      const shawlGeo = new THREE.CylinderGeometry(0.42, 0.45, 0.2, 16);
      const shawl = new THREE.Mesh(shawlGeo, detailMat);
      shawl.position.y = 1.05;
      group.add(shawl);

      // Flared sleeves
      const sleeveGeo = new THREE.CylinderGeometry(0.12, 0.06, 0.55, 8);
      sleeveGeo.translate(0, -0.27, 0);
      const leftArm = new THREE.Mesh(sleeveGeo, bodyMat);
      leftArm.name = 'leftArm';
      leftArm.position.set(-0.46, 0.95, 0);
      leftArm.rotation.z = 0.15;

      const rightArm = new THREE.Mesh(sleeveGeo, bodyMat);
      rightArm.name = 'rightArm';
      rightArm.position.set(0.46, 0.95, 0);
      rightArm.rotation.z = -0.15;

      group.add(leftArm, rightArm);
    } else if (style === 'style3') {
      // Style 3: Shard Knight
      const chestGeo = new THREE.BoxGeometry(0.55, 0.75, 0.45);
      const chest = new THREE.Mesh(chestGeo, bodyMat);
      chest.position.y = 0.55;
      group.add(chest);

      const plateGeo = new THREE.BoxGeometry(0.58, 0.25, 0.48);
      const plate = new THREE.Mesh(plateGeo, detailMat);
      plate.position.y = 0.65;
      group.add(plate);

      // Blocky shoulders
      const pauldronGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const pauldronL = new THREE.Mesh(pauldronGeo, detailMat);
      pauldronL.position.set(-0.35, 0.85, 0);
      const pauldronR = new THREE.Mesh(pauldronGeo, detailMat);
      pauldronR.position.set(0.35, 0.85, 0);
      group.add(pauldronL, pauldronR);

      // Armored limbs
      const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.12);
      armGeo.translate(0, -0.25, 0);
      const leftArm = new THREE.Mesh(armGeo, skinMat);
      leftArm.name = 'leftArm';
      leftArm.position.set(-0.42, 0.85, 0);

      const rightArm = new THREE.Mesh(armGeo, skinMat);
      rightArm.name = 'rightArm';
      rightArm.position.set(0.42, 0.85, 0);

      const legGeo = new THREE.BoxGeometry(0.14, 0.5, 0.14);
      legGeo.translate(0, -0.25, 0);
      const leftLeg = new THREE.Mesh(legGeo, bodyMat);
      leftLeg.name = 'leftLeg';
      leftLeg.position.set(-0.18, 0.22, 0);

      const rightLeg = new THREE.Mesh(legGeo, bodyMat);
      rightLeg.name = 'rightLeg';
      rightLeg.position.set(0.18, 0.22, 0);

      group.add(leftArm, rightArm, leftLeg, rightLeg);
    } else {
      // Style 1: Humanoid Robot (default)
      const bodyGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.8, 16);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.65;
      group.add(body);

      // Glowing core detail
      const coreGeo = new THREE.SphereGeometry(0.1, 12, 12);
      const core = new THREE.Mesh(coreGeo, detailMat);
      core.position.set(0, 0.75, 0.25);
      group.add(core);

      // Limbs
      const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.55, 8);
      armGeo.translate(0, -0.27, 0);
      const leftArm = new THREE.Mesh(armGeo, skinMat);
      leftArm.name = 'leftArm';
      leftArm.position.set(-0.42, 0.95, 0);

      const rightArm = new THREE.Mesh(armGeo, skinMat);
      rightArm.name = 'rightArm';
      rightArm.position.set(0.42, 0.95, 0);

      const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8);
      legGeo.translate(0, -0.25, 0);
      const leftLeg = new THREE.Mesh(legGeo, skinMat);
      leftLeg.name = 'leftLeg';
      leftLeg.position.set(-0.16, 0.22, 0);

      const rightLeg = new THREE.Mesh(legGeo, skinMat);
      rightLeg.name = 'rightLeg';
      rightLeg.position.set(0.16, 0.22, 0);

      group.add(leftArm, rightArm, leftLeg, rightLeg);
    }

    // --- HEAD & FACE ---
    const headGeo = new THREE.SphereGeometry(0.28, 24, 24);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf5f8ff, roughness: 0.3 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = style === 'style2' ? 1.25 : style === 'style3' ? 1.15 : 1.18;
    group.add(head);

    // Style 2 hood details
    if (style === 'style2') {
      const hoodGeo = new THREE.SphereGeometry(0.31, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.7);
      const hood = new THREE.Mesh(hoodGeo, bodyMat);
      hood.rotation.x = 0.25;
      hood.position.set(0, 0.02, -0.02);
      head.add(hood);
    }

    // Style 3 Visor Details
    if (style === 'style3') {
      const visorGeo = new THREE.BoxGeometry(0.42, 0.12, 0.2);
      const visor = new THREE.Mesh(visorGeo, detailMat);
      visor.position.set(0, 0.05, 0.2);
      head.add(visor);
    }

    // --- EYES ---
    const eyesGroup = new THREE.Group();
    eyesGroup.position.set(0, 0.05, 0.24);
    head.add(eyesGroup);

    let eyeGeo = new THREE.SphereGeometry(0.045, 12, 12);
    let eyeMat = new THREE.MeshBasicMaterial({ color: detailColor });

    if (eyeStyle === 'glow') {
      eyeGeo = new THREE.SphereGeometry(0.06, 12, 12);
      // Glowing core eyes
      eyeMat = new THREE.MeshBasicMaterial({ color: detailColor });
    } else if (eyeStyle === 'narrow') {
      eyeGeo = new THREE.BoxGeometry(0.08, 0.02, 0.02) as any;
    }

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.09, 0, 0);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.09, 0, 0);
    eyesGroup.add(eyeL, eyeR);

    // --- MOUTH ---
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.08, 0.24);
    head.add(mouthGroup);
    mouthGroup.name = 'mouth';

    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x27272a });

    if (mouthStyle === 'happy') {
      // Smile shape: thin curve
      const smileGeo = new THREE.BoxGeometry(0.09, 0.025, 0.02);
      const leftCorner = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.02), mouthMat);
      leftCorner.position.set(-0.045, 0.02, 0);
      const rightCorner = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.02), mouthMat);
      rightCorner.position.set(0.045, 0.02, 0);
      
      const smileBase = new THREE.Mesh(smileGeo, mouthMat);
      mouthGroup.add(smileBase, leftCorner, rightCorner);
    } else if (mouthStyle === 'neutral') {
      const lineGeo = new THREE.BoxGeometry(0.08, 0.025, 0.02);
      const mouth = new THREE.Mesh(lineGeo, mouthMat);
      mouthGroup.add(mouth);
    } else if (mouthStyle === 'sad') {
      // Frown shape
      const sadGeo = new THREE.BoxGeometry(0.09, 0.025, 0.02);
      const leftCorner = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.02), mouthMat);
      leftCorner.position.set(-0.045, -0.02, 0);
      const rightCorner = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.02), mouthMat);
      rightCorner.position.set(0.045, -0.02, 0);
      
      const sadBase = new THREE.Mesh(sadGeo, mouthMat);
      mouthGroup.add(sadBase, leftCorner, rightCorner);
    } else if (mouthStyle === 'surprised') {
      // Torus / O shape
      const circleGeo = new THREE.TorusGeometry(0.035, 0.015, 6, 12);
      const mouth = new THREE.Mesh(circleGeo, mouthMat);
      mouth.position.set(0, 0, 0.01);
      mouthGroup.add(mouth);
    }

    // Save mouth reference for scaling
    mouthMeshRef.current = mouthGroup;

    // --- HEAD ACCESSORIES ---
    if (accessory === 'halo') {
      const haloGeo = new THREE.TorusGeometry(0.18, 0.02, 8, 24);
      const haloMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 0.5,
        roughness: 0.1
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0, 0.45, 0);
      head.add(halo);
    } else if (accessory === 'cap') {
      const capMat = new THREE.MeshStandardMaterial({ color: detailColor, roughness: 0.6 });
      const capBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.12, 16), capMat);
      capBase.position.y = 0.22;
      
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.22), capMat);
      visor.position.set(0, 0.18, 0.18);
      head.add(capBase, visor);
    } else if (accessory === 'glasses') {
      const glassMat = new THREE.MeshBasicMaterial({ color: detailColor, transparent: true, opacity: 0.8 });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.04), glassMat);
      frame.position.set(0, 0.06, 0.25);
      head.add(frame);
    } else if (accessory === 'backpack') {
      const packMat = new THREE.MeshStandardMaterial({ color: detailColor, roughness: 0.7 });
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.2), packMat);
      pack.position.set(0, 0.6, -0.36);
      group.add(pack);
    }

    group.scale.setScalar(0.9);
    return group;
  };

  // Render initialization
  useEffect(() => {
    if (!canvasRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c16);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0.95, 2.2);
    camera.lookAt(0, 0.85, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(300, 300);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    // Setup group
    const avatarGroup = buildAvatarMesh();
    scene.add(avatarGroup);
    avatarGroupRef.current = avatarGroup;

    // Loop
    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

      // Rotate group
      if (avatarGroup) {
        avatarGroup.rotation.y = Math.sin(elapsed * 0.4) * 0.4;
        
        // Idle breathing effect
        const breath = 1.0 + Math.sin(elapsed * 1.8) * 0.02;
        avatarGroup.scale.set(0.9, 0.9 * breath, 0.9);
        
        // Walk preview if speaking or just wiggling
        const leftArm = avatarGroup.getObjectByName('leftArm');
        const rightArm = avatarGroup.getObjectByName('rightArm');
        const leftLeg = avatarGroup.getObjectByName('leftLeg');
        const rightLeg = avatarGroup.getObjectByName('rightLeg');

        if (leftArm && rightArm) {
          leftArm.rotation.x = Math.sin(elapsed * 2.0) * 0.08;
          rightArm.rotation.x = -Math.sin(elapsed * 2.0) * 0.08;
        }

        // Apply Lipsync basic scale Y
        const mouth = mouthMeshRef.current;
        if (mouth) {
          let scaleFactor = 1.0;
          if (isMicActive) {
            // Apply volume dynamically
            scaleFactor = 0.2 + volume * 2.5;
          } else if (isSpeakingSimulated) {
            // Apply simulated speaking oscillation
            scaleFactor = 0.3 + Math.abs(Math.sin(elapsed * 18)) * 1.6;
          }
          mouth.scale.y = scaleFactor;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [style, bodyColor, detailColor, accessory, eyeStyle, mouthStyle, isMicActive, isSpeakingSimulated, volume]);

  const handleSave = async () => {
    setSaving(true);
    const updatedAvatar: PlayerAvatar = {
      style,
      bodyColor,
      detailColor,
      accessory,
      eyeStyle,
      mouthStyle,
      customized: true
    };

    const newProgress: PlayerProgress = {
      ...progress,
      playerAvatar: updatedAvatar
    };

    onSaveProgress(newProgress);

    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      try {
        await updateDoc(userRef, {
          playerAvatar: updatedAvatar
        });
      } catch (err) {
        console.error("Error saving player avatar in database:", err);
      }
    }

    setSaving(false);
    onClose();
  };

  return (
    <div className="w-full max-w-4xl bg-[#090b11]/90 border border-indigo-500/35 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(79,70,229,0.15)] flex flex-col md:flex-row h-[85vh] text-white">
      {/* 3D Preview Panel (Left) */}
      <div className="w-full md:w-1/3 bg-[#0d111b]/80 border-b md:border-b-0 md:border-r border-indigo-500/20 p-6 flex flex-col items-center justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.08)_0%,transparent_70%)] pointer-events-none" />

        <div className="text-center z-10 w-full">
          <span className="text-indigo-400 text-xs font-mono font-bold tracking-widest uppercase">Personalización de Avatar</span>
          <h3 className="text-xl font-bold font-headline-md mt-1">Guardián</h3>
        </div>

        {/* 3D Canvas rendering container */}
        <div className="w-64 h-64 my-4 flex items-center justify-center relative z-10">
          <canvas ref={canvasRef} className="rounded-xl border border-white/5 bg-[#0a0c16] shadow-inner" style={{ width: '256px', height: '256px' }} />
        </div>

        {/* Lipsync basic testing controller panel */}
        <div className="w-full space-y-3 z-10">
          <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-2">
            <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-extrabold block">Prueba de Lipsync Vocal</span>
            <div className="flex gap-2 justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsMicActive(!isMicActive);
                  setIsSpeakingSimulated(false);
                }}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${
                  isMicActive 
                    ? 'bg-emerald-600 border-emerald-400 text-white' 
                    : 'bg-indigo-950/20 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/10'
                }`}
              >
                {isMicActive ? <Mic className="w-3.5 h-3.5 animate-pulse" /> : <MicOff className="w-3.5 h-3.5" />}
                <span>{isMicActive ? 'Micrófono ON' : 'Probar Mic'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSpeakingSimulated(!isSpeakingSimulated);
                  setIsMicActive(false);
                }}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center justify-center gap-1 ${
                  isSpeakingSimulated 
                    ? 'bg-amber-600 border-amber-400 text-white animate-pulse' 
                    : 'bg-indigo-950/20 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/10'
                }`}
              >
                <span>{isSpeakingSimulated ? '🗣️ Hablando' : 'Simular Voz'}</span>
              </button>
            </div>
            {/* Visualizer volume bar */}
            {(isMicActive || isSpeakingSimulated) && (
              <div className="space-y-1">
                <div className="w-full bg-[#151726] h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-400 h-full transition-all duration-75" 
                    style={{ width: `${Math.min(100, (isMicActive ? volume * 100 : (0.3 + Math.abs(Math.sin(Date.now() / 70)) * 0.7) * 100))}%` }} 
                  />
                </div>
                <span className="text-[8px] text-gray-500 block text-right font-mono">Modulando volumen vocal...</span>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl transition duration-200 border border-indigo-400/30 shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
          >
            {saving ? 'Guardando...' : 'Guardar Apariencia'}
          </button>
        </div>
      </div>

      {/* Editor Panel Selection Tabs (Right) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col justify-between">
        <div className="space-y-5">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold font-headline-md tracking-wider text-indigo-400">ESPEJO COSMÉTICO DEL GUARDIÁN</h2>
              <p className="text-gray-400 text-xs mt-0.5">Sintoniza el estilo, los colores corporales y accesorios de tu avatar 3D.</p>
            </div>
            {currentAvatar.customized && (
              <button
                onClick={onClose}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Style Base Select */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold tracking-widest text-indigo-400 uppercase block">Estilo Base del Chasis</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {stylesList.map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStyle(st.id)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 hover:bg-white/5 ${
                    style === st.id 
                      ? 'border-indigo-400 bg-indigo-950/20 shadow-[0_0_10px_rgba(99,102,241,0.15)]' 
                      : 'border-white/5 bg-black/30'
                  }`}
                >
                  <span className="text-xs font-bold flex items-center gap-1">
                    {st.label}
                    {style === st.id && <Check className="w-3 h-3 text-indigo-400" />}
                  </span>
                  <span className="text-[9px] text-gray-400 mt-1 block">{st.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Colors Presets & Custom Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold tracking-widest text-indigo-400 uppercase block">Color del Cuerpo</span>
              <div className="flex flex-wrap gap-1.5 items-center">
                {colorPresets.map(preset => (
                  <button
                    key={preset}
                    onClick={() => setBodyColor(preset)}
                    className={`w-7 h-7 rounded-full border transition-all ${
                      bodyColor === preset ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset }}
                  />
                ))}
                <input 
                  type="color" 
                  value={bodyColor} 
                  onChange={e => setBodyColor(e.target.value)} 
                  className="w-7 h-7 bg-transparent border-0 cursor-pointer p-0 shrink-0" 
                  title="Color personalizado"
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono font-bold tracking-widest text-indigo-400 uppercase block">Color de Detalles</span>
              <div className="flex flex-wrap gap-1.5 items-center">
                {detailPresets.map(preset => (
                  <button
                    key={preset}
                    onClick={() => setDetailColor(preset)}
                    className={`w-7 h-7 rounded-full border transition-all ${
                      detailColor === preset ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset }}
                  />
                ))}
                <input 
                  type="color" 
                  value={detailColor} 
                  onChange={e => setDetailColor(e.target.value)} 
                  className="w-7 h-7 bg-transparent border-0 cursor-pointer p-0 shrink-0" 
                  title="Color personalizado"
                />
              </div>
            </div>
          </div>

          {/* Accessories Select */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold tracking-widest text-indigo-400 uppercase block">Accesorios de Cabeza</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {accessoriesList.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => setAccessory(acc.id)}
                  className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                    accessory === acc.id 
                      ? 'border-indigo-400 bg-indigo-950/20 text-white font-bold' 
                      : 'border-white/5 bg-black/30 text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{acc.icon}</span>
                  <span className="text-[8.5px] truncate max-w-full">{acc.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Face: Eyes & Mouth Select */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Eyes selection */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold tracking-widest text-indigo-400 uppercase block">Estilo de Ojos</span>
              <div className="grid grid-cols-3 gap-2">
                {eyesList.map(eye => (
                  <button
                    key={eye.id}
                    onClick={() => setEyeStyle(eye.id)}
                    className={`p-2 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                      eyeStyle === eye.id 
                        ? 'border-indigo-400 bg-indigo-950/20 text-white font-bold' 
                        : 'border-white/5 bg-black/30 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">{eye.icon}</span>
                    <span className="text-[8.5px] truncate max-w-full">{eye.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mouth selection */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold tracking-widest text-indigo-400 uppercase block">Estilo de Boca Base</span>
              <div className="grid grid-cols-4 gap-1.5">
                {mouthsList.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMouthStyle(m.id)}
                    className={`p-2 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                      mouthStyle === m.id 
                        ? 'border-indigo-400 bg-indigo-950/20 text-white font-bold' 
                        : 'border-white/5 bg-black/30 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">{m.icon}</span>
                    <span className="text-[8.5px] truncate max-w-full">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        <div className="text-[10px] text-indigo-300/80 flex items-start gap-2 bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-3 mt-4">
          <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <span>Este avatar te representa en el mundo 3D inmersivo de Evolutia y es visible para todos los demás jugadores. La sincronización de lipsync por voz está activa en tiempo real al hablar.</span>
        </div>
      </div>
    </div>
  );
}
