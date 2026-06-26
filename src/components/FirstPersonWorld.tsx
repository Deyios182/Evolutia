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
import { PlayerProgress, GatheringInventory, CraftableItem, EmotionName, AvatarCustomization, EquipmentSlots } from '../types';
import { db, auth } from '../firebase';

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
  const isOrit = avatar.name === 'Orit';
  let nColor = EMOTION_COLORS[dominantEmotion] || 0xfdcc15;
  if (isOrit) nColor = 0xffea70; // Dorado primordial
  else if (avatar.colorTheme === 'abyssal') nColor = 0x8b5cf6;
  else if (avatar.colorTheme === 'solstice') nColor = 0xf59e0b;
  else if (avatar.colorTheme === 'primeval') nColor = 0xef4444;

  // 1. Body
  const hasMetallic = avatar.traits?.includes('Escamas Metálicas');
  const bodyGeometry = new THREE.SphereGeometry(1.2, 24, 24);
  const bodyMaterial = new THREE.MeshPhongMaterial({
    color: isOrit ? 0xffea70 : 0xf5f8ff,
    emissive: isOrit ? 0xff9900 : 0x111422,
    emissiveIntensity: isOrit ? 0.95 : 0.2,
    transparent: isOrit,
    opacity: isOrit ? 0.85 : 1.0,
    shininess: isOrit ? 150 : (hasMetallic ? 150 : 90),
  });
  if (hasMetallic && !isOrit) {
    (bodyMaterial as any).metalness = 0.9;
    (bodyMaterial as any).roughness = 0.1;
  }
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
  const hasGlowingEyes = isOrit || avatar.traits?.includes('Ojos Rutilantes');
  const pupilGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const pupilMat = hasGlowingEyes 
    ? new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 })
    : new THREE.MeshBasicMaterial({ color: nColor });
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
  if (!isOrit) {
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

  if (phase < 2 || isOrit) {
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

  // Chaos Horn trait
  if (avatar.traits?.includes('Cuerno del Caos')) {
    const hornGeo = new THREE.ConeGeometry(0.2, 0.8, 16);
    const hornMat = new THREE.MeshPhongMaterial({ color: 0xffaa00, emissive: 0x5a4500, shininess: 150 });
    const hornMesh = new THREE.Mesh(hornGeo, hornMat);
    hornMesh.position.set(0, 1.2, 0.8);
    hornMesh.rotation.x = Math.PI / 3;
    group.add(hornMesh);
  }

  // 6. Aura Outer Shell
  const hasFieryAura = avatar.traits?.includes('Aura Ígnea');
  const auraGeo = new THREE.SphereGeometry(hasFieryAura ? 2.0 : 1.8, 24, 24);
  const auraMat = new THREE.MeshBasicMaterial({
    color: hasFieryAura ? 0xff0000 : nColor,
    transparent: true,
    opacity: hasFieryAura ? 0.25 : 0.15,
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

function createDetailedPlayerAvatar(
  avatar: AvatarCustomization,
  dominantEmotion: EmotionName,
  phase: number
): THREE.Group {
  const group = new THREE.Group();

  // Color Theme Resolver
  let themeColor = EMOTION_COLORS[dominantEmotion] || 0x00e1d9;
  if (avatar.colorTheme === 'abyssal') themeColor = 0x8b5cf6;
  else if (avatar.colorTheme === 'solstice') themeColor = 0xf59e0b;
  else if (avatar.colorTheme === 'primeval') themeColor = 0xef4444;
  else if (avatar.colorTheme === 'classic') themeColor = 0x00e1d9;

  // --- 1. BASE HUMANOID PARTS ---
  
  // Torso / Body (robe extends lower)
  const isRobe = avatar.clothing === 'robe_sage';
  const bodyHeight = isRobe ? 1.3 : 0.9;
  const bodyGeo = new THREE.CylinderGeometry(0.35, isRobe ? 0.55 : 0.35, bodyHeight, 16);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: themeColor,
    roughness: 0.4,
    metalness: avatar.clothing === 'armor_shard' ? 0.8 : 0.1
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = isRobe ? 0.45 : 0.65;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(0.32, 24, 24);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xf5f8ff,
    roughness: 0.3
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = isRobe ? 1.25 : 1.2;
  head.castShadow = true;
  group.add(head);

  // Eyes (Glowing spheres)
  const eyesGroup = new THREE.Group();
  eyesGroup.position.set(0, 0, 0.28);
  head.add(eyesGroup);

  const eyeGeo = new THREE.SphereGeometry(0.06, 12, 12);
  const eyeMat = new THREE.MeshBasicMaterial({ color: themeColor });

  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.11, 0, 0);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.11, 0, 0);
  eyesGroup.add(leftEye, rightEye);

  // --- 2. ACCESSORIES ON HEAD ---
  if (avatar.accessory === 'halo') {
    const haloGeo = new THREE.TorusGeometry(0.2, 0.025, 8, 24);
    const haloMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 0.6,
      roughness: 0.1
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 0.5, 0);
    head.add(halo);
  } else if (avatar.accessory === 'horn_gold') {
    const hornGeo = new THREE.ConeGeometry(0.07, 0.3, 12);
    hornGeo.translate(0, 0.15, 0);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.1 });
    
    const hornL = new THREE.Mesh(hornGeo, hornMat);
    hornL.position.set(-0.16, 0.22, 0);
    hornL.rotation.z = 0.35;
    
    const hornR = new THREE.Mesh(hornGeo, hornMat);
    hornR.position.set(0.16, 0.22, 0);
    hornR.rotation.z = -0.35;
    
    head.add(hornL, hornR);
  } else if (avatar.accessory === 'ribbon') {
    const ribMat = new THREE.MeshStandardMaterial({ color: 0xff3b90, roughness: 0.6 });
    const ribGroup = new THREE.Group();
    ribGroup.position.set(0, 0.28, -0.15);
    
    const node1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.06), ribMat);
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.06), ribMat);
    wingL.position.set(-0.12, 0, 0);
    wingL.rotation.z = 0.2;
    const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.06), ribMat);
    wingR.position.set(0.12, 0, 0);
    wingR.rotation.z = -0.2;
    
    ribGroup.add(node1, wingL, wingR);
    head.add(ribGroup);
  } else if (avatar.accessory === 'scarf_cozy') {
    const scarfGeo = new THREE.TorusGeometry(0.26, 0.06, 8, 16);
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
    const scarf = new THREE.Mesh(scarfGeo, scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.set(0, -0.32, 0);
    head.add(scarf);
  }

  // --- 3. CLOTHING/ARMOR OVERLAYS ---
  if (avatar.clothing === 'shawl') {
    const shawlGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.22, 16);
    const shawlMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
    const shawl = new THREE.Mesh(shawlGeo, shawlMat);
    shawl.position.y = 0.95;
    group.add(shawl);
  } else if (avatar.clothing === 'armor_shard') {
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
    const plateFront = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.15), armorMat);
    plateFront.position.set(0, isRobe ? 0.55 : 0.65, 0.22);
    const plateBack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.15), armorMat);
    plateBack.position.set(0, isRobe ? 0.55 : 0.65, -0.22);
    group.add(plateFront, plateBack);
  }

  // --- 4. LIMBS ---
  const limbMat = new THREE.MeshStandardMaterial({ color: 0xf5f8ff, roughness: 0.4 });
  const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
  armGeo.translate(0, -0.3, 0);

  const leftArm = new THREE.Mesh(armGeo, limbMat);
  leftArm.name = 'leftArm';
  leftArm.position.set(-0.46, 0.95, 0);
  
  const rightArm = new THREE.Mesh(armGeo, limbMat);
  rightArm.name = 'rightArm';
  rightArm.position.set(0.46, 0.95, 0);
  
  group.add(leftArm, rightArm);

  if (!isRobe) {
    const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.6, 8);
    legGeo.translate(0, -0.3, 0);

    const leftLeg = new THREE.Mesh(legGeo, limbMat);
    leftLeg.name = 'leftLeg';
    leftLeg.position.set(-0.16, 0.25, 0);
    
    const rightLeg = new THREE.Mesh(legGeo, limbMat);
    rightLeg.name = 'rightLeg';
    rightLeg.position.set(0.16, 0.25, 0);
    
    group.add(leftLeg, rightLeg);
  }

  group.scale.setScalar(0.75);
  return group;
}

// Interface for local NPC enemies
interface LocalEnemy {
  id: string;
  name: string;
  type: 'green_slime' | 'rock_golem' | 'abyss_demon';
  mesh: THREE.Group;
  spawnX: number;
  spawnZ: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  isDead: boolean;
  respawnTimer: number;
  lastAttackTime: number;
  wanderAngle: number;
  wanderTimer: number;
  flashTimer: number;
}

// Procedural ground canvas texture builder
function createProceduralFloorTexture(mapType: FPMapType): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (mapType === 'sanctuary') {
    // Serene emerald moss floor with concentric golden energy rings/lines
    ctx.fillStyle = '#062611';
    ctx.fillRect(0, 0, 512, 512);

    // Draw gold patterns / tree rings
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    for (let r = 60; r < 512; r += 90) {
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Add organic moss patches
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#0b3d1b' : '#041c0c';
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 15 + Math.random() * 25;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mapType === 'cabin') {
    // Wood floor planks
    ctx.fillStyle = '#1e1610';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#0d0a08';
    ctx.lineWidth = 4;
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    for (let y = 0; y < 512; y += 64) {
      const offset = (y / 64) % 2 === 0 ? 0 : 128;
      for (let x = offset; x < 512; x += 256) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 64);
        ctx.stroke();
      }
    }
  } else if (mapType === 'neighborhood') {
    // Stylized grass moss
    ctx.fillStyle = '#14301d';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1b4028' : '#0d2214';
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 10 + Math.random() * 20;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#225534';
    ctx.lineWidth = 2;
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y - 15);
      ctx.lineTo(x + 5, y - 15);
      ctx.stroke();
    }
  } else if (mapType === 'lobby') {
    // Stone tiles with glowing grid lines
    ctx.fillStyle = '#12131a';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#2c2e3d';
    ctx.lineWidth = 6;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    ctx.fillStyle = '#6366f1';
    for (let i = 0; i <= 512; i += 128) {
      for (let j = 0; j <= 512; j += 128) {
        ctx.beginPath();
        ctx.arc(i, j, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (mapType === 'map1') {
    // Mystical leafy green forest
    ctx.fillStyle = '#0a1d12';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 150; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#112c1b' : '#06140c';
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 15 + Math.random() * 30;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#4ade80';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.beginPath();
      ctx.arc(x, y, 2 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mapType === 'map2') {
    // Celestial stone quarries with mineral veins
    ctx.fillStyle = '#1e1c22';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#2d2833';
    ctx.lineWidth = 4;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 512, 0);
      ctx.lineTo(Math.random() * 512, 512);
      ctx.stroke();
    }
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(0, Math.random() * 512);
      ctx.lineTo(128 + Math.random() * 256, Math.random() * 512);
      ctx.lineTo(512, Math.random() * 512);
      ctx.stroke();
    }
  } else if (mapType === 'map3') {
    // Volcanic lava cracks
    ctx.fillStyle = '#1c080e';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 512, 0);
      ctx.bezierCurveTo(Math.random() * 512, 128, Math.random() * 512, 384, Math.random() * 512, 512);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  return texture;
}

// Procedural detailed enemy meshes
function createDetailedEnemyMesh(type: string): THREE.Group {
  const group = new THREE.Group();

  if (type === 'green_slime') {
    const bodyGeo = new THREE.SphereGeometry(1.0, 16, 16);
    bodyGeo.scale(1.2, 0.8, 1.2);
    const bodyMat = new THREE.MeshPhongMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      shininess: 80,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.8;
    group.add(body);

    const eyeGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.35, 0.9, 0.8);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.35, 0.9, 0.8);
    group.add(leftEye, rightEye);

    const leafGeo = new THREE.ConeGeometry(0.2, 0.6, 8);
    const leafMat = new THREE.MeshPhongMaterial({ color: 0x047857 });
    
    const leftLeaf = new THREE.Mesh(leafGeo, leafMat);
    leftLeaf.position.set(-0.4, 1.4, 0);
    leftLeaf.rotation.z = 0.4;
    
    const rightLeaf = new THREE.Mesh(leafGeo, leafMat);
    rightLeaf.position.set(0.4, 1.4, 0);
    rightLeaf.rotation.z = -0.4;
    group.add(leftLeaf, rightLeaf);

    group.scale.set(0.7, 0.7, 0.7);

  } else if (type === 'rock_golem') {
    const bodyGeo = new THREE.DodecahedronGeometry(1.1, 0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.2;
    group.add(body);

    const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 2.1, 0.1);
    group.add(head);

    const eyeGeo = new THREE.BoxGeometry(0.12, 0.08, 0.2);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.25, 2.15, 0.48);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.25, 2.15, 0.48);
    group.add(leftEye, rightEye);

    const armGeo = new THREE.IcosahedronGeometry(0.5, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      roughness: 0.1,
      metalness: 0.9
    });
    
    const leftArm = new THREE.Mesh(armGeo, crystalMat);
    leftArm.position.set(-1.4, 1.3, 0);
    
    const rightArm = new THREE.Mesh(armGeo, crystalMat);
    rightArm.position.set(1.4, 1.3, 0);
    group.add(leftArm, rightArm);

    group.userData = { leftArm, rightArm };
    group.scale.set(0.8, 0.8, 0.8);

  } else if (type === 'abyss_demon') {
    const bodyGeo = new THREE.IcosahedronGeometry(1.3, 1);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.4,
      metalness: 0.7,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.3;
    group.add(body);

    const hornGeo = new THREE.ConeGeometry(0.25, 1.2, 8);
    const hornMat = new THREE.MeshPhongMaterial({ color: 0xd97706, shininess: 120 });
    
    const leftHorn = new THREE.Mesh(hornGeo, hornMat);
    leftHorn.position.set(-0.6, 2.2, 0);
    leftHorn.rotation.z = 0.5;
    leftHorn.rotation.x = -0.2;

    const rightHorn = new THREE.Mesh(hornGeo, hornMat);
    rightHorn.position.set(0.6, 2.2, 0);
    rightHorn.rotation.z = -0.5;
    rightHorn.rotation.x = -0.2;
    group.add(leftHorn, rightHorn);

    const eyeGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.4, 1.5, 1.0);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.4, 1.5, 1.0);
    group.add(leftEye, rightEye);

    const ringGeo = new THREE.TorusGeometry(1.6, 0.08, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.3;
    group.add(ring);

    group.userData = { ring };
    group.scale.set(1.0, 1.0, 1.0);
  }

  group.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return group;
}

// Procedural sky dome canvas texture generator
function createProceduralSkyTexture(mapType: FPMapType): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createLinearGradient(0, 0, 0, 512);

  if (mapType === 'sanctuary') {
    // Golden rays and deep moss green sky
    gradient.addColorStop(0, '#041407');
    gradient.addColorStop(0.5, '#0b3012');
    gradient.addColorStop(1, '#22521c');
  } else if (mapType === 'cabin') {
    // Warm interior ceiling glow
    gradient.addColorStop(0, '#2e1910');
    gradient.addColorStop(1, '#0c0705');
  } else if (mapType === 'neighborhood') {
    // Dawn/Twilight sky
    gradient.addColorStop(0, '#0c0d1b');
    gradient.addColorStop(0.5, '#1e1c3a');
    gradient.addColorStop(1, '#3b2f4c');
  } else if (mapType === 'lobby') {
    // Starry outer cosmos sky
    gradient.addColorStop(0, '#030008');
    gradient.addColorStop(0.5, '#0c0a1e');
    gradient.addColorStop(1, '#1b1432');
  } else if (mapType === 'map1') {
    // Magical forest deep green sky
    gradient.addColorStop(0, '#021612');
    gradient.addColorStop(0.6, '#0b3026');
    gradient.addColorStop(1, '#165842');
  } else if (mapType === 'map2') {
    // Sapphire star dust sky
    gradient.addColorStop(0, '#020617');
    gradient.addColorStop(0.5, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
  } else if (mapType === 'map3') {
    // Volcanic red void sky
    gradient.addColorStop(0, '#0f0206');
    gradient.addColorStop(0.5, '#2e0813');
    gradient.addColorStop(1, '#581c2b');
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  // Add stars for non-cabin maps
  if (mapType !== 'cabin') {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 150; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 250;
      const r = Math.random() * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// Procedural detailed portal gates
function createDetailedGateMesh(type: string): THREE.Group {
  const group = new THREE.Group();

  if (type === 'door_cabin' || type === 'door_vecindario') {
    // Wooden door frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.9 });
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.0, 0.2), frameMat);
    postL.position.set(-0.9, 1.5, 0);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.0, 0.2), frameMat);
    postR.position.set(0.9, 1.5, 0);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 0.2), frameMat);
    lintel.position.set(0, 3.0, 0);
    group.add(postL, postR, lintel);

    // Hinge group at the left post
    const hinge = new THREE.Group();
    hinge.position.set(-0.8, 0, 0);

    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.8 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.8, 0.1), doorMat);
    panel.position.set(0.8, 1.4, 0); // Center relative to hinge
    hinge.add(panel);

    // Decorative vertical planks lines on the door
    for (let offset = -0.6; offset <= 0.6; offset += 0.3) {
      const lineGeo = new THREE.BoxGeometry(0.02, 2.6, 0.02);
      const lineMat = new THREE.MeshStandardMaterial({ color: 0x27160c, roughness: 0.9 });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(0.8 + offset, 1.4, 0.051); // slightly offset to front
      hinge.add(line);
    }

    // Lever handle
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 });
    const handleGroup = new THREE.Group();
    handleGroup.position.set(1.4, 1.3, 0);
    
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), handleMat);
    knob.rotation.x = Math.PI / 2;
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.02), handleMat);
    lever.position.set(0, -0.04, 0.07);
    handleGroup.add(knob, lever);
    panel.add(handleGroup);

    // Partially open angle
    hinge.rotation.y = 0.7; // partially open inside
    group.add(hinge);

  } else {
    // Magic/stone archways
    let stoneColor = 0x475569;
    let vortexColor = 0x6366f1;

    if (type === 'door_map1') {
      stoneColor = 0x14532d;
      vortexColor = 0x10b981;
    } else if (type === 'door_map2') {
      stoneColor = 0x1e3a8a;
      vortexColor = 0x0ea5e9;
    } else if (type === 'door_map3') {
      stoneColor = 0x1f1625;
      vortexColor = 0xef4444;
    }

    const archMat = new THREE.MeshStandardMaterial({ color: stoneColor, roughness: 0.8, metalness: 0.1 });
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.5, 0.4), archMat);
    p1.position.set(-1.2, 1.75, 0);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.5, 0.4), archMat);
    p2.position.set(1.2, 1.75, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 0.4), archMat);
    top.position.set(0, 3.5, 0);
    group.add(p1, p2, top);

    const vortexGeo = new THREE.RingGeometry(0.1, 1.0, 32);
    const vortexMat = new THREE.MeshBasicMaterial({
      color: vortexColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const vortex = new THREE.Mesh(vortexGeo, vortexMat);
    vortex.position.set(0, 1.75, 0);
    group.add(vortex);

    group.userData = { vortex };

    if (type === 'door_map1') {
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.6 });
      const leaf1 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), leafMat);
      leaf1.position.set(-1.0, 3.5, 0.15);
      const leaf2 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), leafMat);
      leaf2.position.set(1.0, 3.5, -0.15);
      const leaf3 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), leafMat);
      leaf3.position.set(0, 3.8, 0);
      group.add(leaf1, leaf2, leaf3);
    } else if (type === 'door_map2') {
      const crystalMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9, emissive: 0x0369a1 });
      const cry1 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 4), crystalMat);
      cry1.position.set(-1.3, 3.2, 0.2);
      cry1.rotation.z = -0.3;
      const cry2 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 4), crystalMat);
      cry2.position.set(1.3, 3.2, 0.2);
      cry2.rotation.z = 0.3;
      group.add(cry1, cry2);
    } else if (type === 'door_map3') {
      const spikeMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.3, metalness: 0.8 });
      const sp1 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.8, 4), spikeMat);
      sp1.position.set(-1.2, 3.6, 0);
      sp1.rotation.z = 0.5;
      const sp2 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.8, 4), spikeMat);
      sp2.position.set(1.2, 3.6, 0);
      sp2.rotation.z = -0.5;
      group.add(sp1, sp2);
    }
  }

  group.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return group;
}

import { collection, doc, query, onSnapshot, updateDoc, increment, getDoc, arrayUnion, addDoc } from 'firebase/firestore';

// Subcomponents to render as immersive overlays
import { MyHome } from './MyHome';
import { Codex } from './Codex';
import { BattleArena } from './BattleArena';
import { Marketplace } from './Marketplace';
import { Crafting } from './Crafting';
import { Vecindario } from './Vecindario';
import { StashUI } from './StashUI';
import { WorkbenchUI } from './WorkbenchUI';
import { RefinerUI } from './RefinerUI';
import { GeminiLiveChat } from './GeminiLiveChat';
import { AvatarCustomizeUI } from './AvatarCustomizeUI';
import { ArmoryUI } from './ArmoryUI';
import { OritDialogueUI } from './OritDialogueUI';
import { CabinSystem } from './CabinSystem';

interface FirstPersonWorldProps {
  progress: PlayerProgress;
  onSaveProgress: (newProg: PlayerProgress) => void;
  // Triggered when updating state inside App.tsx
  onUpdateEmotions: (updater: (prev: any) => any) => void;
  onEvolve: () => void;
  onSpendGold: (amount: number, expGained: number) => boolean;
}

export type FPMapType = 'cabin' | 'neighborhood' | 'lobby' | 'map1' | 'map2' | 'map3' | 'sanctuary';

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
  avatar?: AvatarCustomization;
  hp?: number;
  maxHp?: number;
  isSpeaking?: boolean;
}

interface InteractiveNode3D {
  id: string;
  name: string;
  x: number;
  z: number;
  type: 'tree' | 'ore' | 'synth' | 'anvil' | 'bookshelf' | 'door_vecindario' | 'door_cabin' | 'door_lobby' | 'door_map1' | 'door_map2' | 'door_map3' | 'door_arena' | 'nitz_npc' | 'orit_npc' | 'house_plot' | 'portal_praise' | 'marketplace' | 'stash' | 'forge' | 'weaver' | 'enchanter' | 'refiner' | 'wardrobe_mirror' | 'wardrobe_armory';
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  clicksRequired?: number;
  clicksCurrent?: number;
  label: string;
  plotOwnerId?: string; // For neighborhood houses
}

// Helper functions for equipment subtype filtering
export function getWeaponsList(craftedItems: any[]): any[] {
  return (craftedItems || []).filter(item => 
    item.subType === 'weapon' || 
    item.subType === 'weapon_1h' || 
    item.subType === 'weapon_2h' || 
    item.subType === 'ranged' || 
    item.subType === 'grimoire'
  );
}

export function getShieldsList(craftedItems: any[]): any[] {
  return (craftedItems || []).filter(item => item.subType === 'shield');
}

export function getArmorsList(craftedItems: any[]): any[] {
  return (craftedItems || []).filter(item => 
    item.subType === 'armor' || 
    item.subType === 'chest' || 
    item.subType === 'legs' || 
    item.subType === 'head'
  );
}

export function getActiveWeapon(craftedItems: any[]): any | undefined {
  const list = getWeaponsList(craftedItems);
  return list.find(item => item.equipped) || list[0];
}

export function getActiveShield(craftedItems: any[]): any | undefined {
  const list = getShieldsList(craftedItems);
  return list.find(item => item.equipped) || list[0];
}

export function getActiveArmor(craftedItems: any[]): any | undefined {
  const list = getArmorsList(craftedItems);
  return list.find(item => item.equipped) || list[0];
}

export function FirstPersonWorld({
  progress,
  onSaveProgress,
  onUpdateEmotions,
  onEvolve,
  onSpendGold
}: FirstPersonWorldProps) {
  // Navigation states
  const [currentMap, setCurrentMap] = useState<FPMapType>(() => {
    if (progress.worldPresentation && !progress.worldPresentation.completed) {
      return 'sanctuary';
    }
    return 'cabin';
  });
  const [playerX, setPlayerX] = useState<number>(0);
  const [playerZ, setPlayerZ] = useState<number>(() => {
    if (progress.worldPresentation && !progress.worldPresentation.completed) {
      return 15;
    }
    return 5;
  });
  const [mapTransitioning, setMapTransitioning] = useState<boolean>(false);
  const prevMapRef = useRef<FPMapType>('cabin');

  const changeMap = (nextMap: FPMapType) => {
    setMapTransitioning(true);
    setTimeout(() => {
      setCurrentMap(nextMap);
      setTimeout(() => {
        setMapTransitioning(false);
      }, 300);
    }, 300);
  };
  const [cameraAngle, setCameraAngle] = useState<number>(0); // in radians
  const [cameraPitch, setCameraPitch] = useState<number>(0); // up/down viewport

  // Active overlay modal state
  type OverlayType = 'none' | 'crafting' | 'syntonia' | 'codex' | 'arena' | 'interactive_pet_chat' | 'house_decorating' | 'marketplace' | 'stash' | 'workbench' | 'gemini_voice' | 'refiner' | 'avatar_customize' | 'armory' | 'orit_dialogue' | 'cabin_system';
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>('none');
  const [activeDialogueNodeId, setActiveDialogueNodeId] = useState<string | undefined>(undefined);
  const [activeWorkbenchType, setActiveWorkbenchType] = useState<'forge' | 'weaver' | 'enchanter'>('forge');

  // Refs for tracking attack cooldown and spatial proximity sound oscillators
  const lastPlayerAttackTimeRef = useRef<number>(0);
  const voiceAudioCtxRef = useRef<AudioContext | null>(null);
  const peerVoiceOscillatorsRef = useRef<Map<string, { osc: OscillatorNode; panner: StereoPannerNode; gain: GainNode }>>(new Map());

  const getVoiceAudioCtx = () => {
    if (!voiceAudioCtxRef.current) {
      voiceAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (voiceAudioCtxRef.current.state === 'suspended') {
      voiceAudioCtxRef.current.resume();
    }
    return voiceAudioCtxRef.current;
  };

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
  const [isProximityChatActive, setIsProximityChatActive] = useState<boolean>(false);

  // Input controller states
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({});

  // Coordinate & Camera Refs for frame-rate independent physics
  const playerXRef = useRef<number>(0);
  const playerZRef = useRef<number>(progress.worldPresentation && !progress.worldPresentation.completed ? 15 : 5);
  const cameraAngleRef = useRef<number>(0);
  const cameraPitchRef = useRef<number>(0);
  const onlinePlayersRef = useRef<OnlinePlayer[]>([]);
  const activeNodesRef = useRef<InteractiveNode3D[]>([]);
  const activeMeshesRef = useRef<THREE.Object3D[]>([]);
  const tempBagRef = useRef<GatheringInventory>(tempBag);
  const maxWeightRef = useRef<number>(30);
  const extractionXRef = useRef<number>(0);
  const extractionZRef = useRef<number>(-50);

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

  useEffect(() => {
    tempBagRef.current = tempBag;
  }, [tempBag]);

  useEffect(() => {
    maxWeightRef.current = progress.equipment?.backpack?.weightCapacity || 30;
  }, [progress.equipment?.backpack?.weightCapacity]);

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
  const currentMapRef = useRef(currentMap);
  useEffect(() => {
    activeOverlayRef.current = activeOverlay;
    currentMapRef.current = currentMap;
  }, [activeOverlay, currentMap]);

  const progressRef = useRef(progress);
  const onSaveProgressRef = useRef(onSaveProgress);
  useEffect(() => {
    progressRef.current = progress;
    onSaveProgressRef.current = onSaveProgress;
  }, [progress, onSaveProgress]);

  const handleInteractNearNodeRef = useRef<() => void>(() => {});
  const triggerSpecialSkillRef = useRef<() => void>(() => {});

  // Elements references for Three.js
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const keysDownRef = useRef<{ [key: string]: boolean }>({});
  const companionMeshRef = useRef<THREE.Group | THREE.Mesh | null>(null);
  const companionRingRef = useRef<THREE.Group | THREE.Mesh | null>(null);
  const strikeNodeRef = useRef<InteractiveNode3D | null>(null);

  // Action RPG States
  const [showQuickInventory, setShowQuickInventory] = useState<boolean>(false);
  const [selectedDollSlot, setSelectedDollSlot] = useState<'mainHand' | 'offHand' | 'chest' | 'legs' | 'head' | 'backpack' | 'axe' | 'pickaxe' | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<keyof EquipmentSlots | null>(null);
  const [activeInvTab, setActiveInvTab] = useState<'all' | 'weapons' | 'armor' | 'tools'>('all');
  const [dashCooldownLeft, setDashCooldownLeft] = useState<number>(0);
  const dashCooldownLeftRef = useRef<number>(0);
  const [skillCooldownLeft, setSkillCooldownLeft] = useState<number>(0);
  const skillCooldownLeftRef = useRef<number>(0);
  const isDodgingRef = useRef<boolean>(false);

  const handleEquipItemInWorld = (slot: keyof EquipmentSlots, item: CraftableItem | null) => {
    const currentEquipment = { ...(progress.equipment || {}) };
    
    const updatedCrafted = (progress.craftedItems || []).map(ci => {
      let belongsToCategory = false;
      if (slot === 'mainHand') {
        belongsToCategory = ci.subType === 'weapon' || ci.subType === 'weapon_1h' || ci.subType === 'weapon_2h' || ci.subType === 'ranged' || ci.subType === 'grimoire';
      } else if (slot === 'offHand') {
        belongsToCategory = ci.subType === 'shield';
      } else if (slot === 'chest') {
        belongsToCategory = ci.subType === 'chest' || ci.subType === 'armor';
      } else if (slot === 'legs') {
        belongsToCategory = ci.subType === 'legs';
      } else if (slot === 'head') {
        belongsToCategory = ci.subType === 'head';
      } else if (slot === 'backpack') {
        belongsToCategory = ci.subType === 'backpack';
      } else if (slot === 'axe') {
        belongsToCategory = ci.subType === 'axe';
      } else if (slot === 'pickaxe') {
        belongsToCategory = ci.subType === 'pickaxe';
      }

      if (belongsToCategory) {
        return { ...ci, equipped: item ? ci.id === item.id : false };
      }
      return ci;
    });

    if (item) {
      currentEquipment[slot] = { ...item, equipped: true };
    } else {
      currentEquipment[slot] = null;
    }

    let extraHp = 0;
    Object.values(currentEquipment).forEach(eqItem => {
      if (eqItem && eqItem.statBonus && eqItem.statBonus.startsWith('HP+')) {
        const hpVal = parseInt(eqItem.statBonus.replace('HP+', ''), 10);
        if (!isNaN(hpVal)) extraHp += hpVal;
      }
    });

    const baseMaxHp = 150 + progress.phase * 30;
    const newMaxHp = baseMaxHp + extraHp;

    const nextProg: PlayerProgress = {
      ...progress,
      equipment: currentEquipment,
      craftedItems: updatedCrafted,
      maxHp: newMaxHp,
      hp: Math.min(progress.hp, newMaxHp)
    };

    onSaveProgress(nextProg);
    
    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      updateDoc(userRef, {
        equipment: currentEquipment,
        craftedItems: updatedCrafted,
        maxHp: newMaxHp,
        hp: Math.min(progress.hp, newMaxHp)
      }).catch(err => console.error("Error updating equipment in DB:", err));
    }

    triggerNotification(item ? `🛡️ Te has equipado: ${item.name}` : `🛡️ Has desequipado la ranura ${slot.toUpperCase()}`);
  };

  const getAvatarColor = () => {
    const avatar = progress.avatar;
    let nColor = '#ffd700'; // Alegría / Default
    const dominantEmotion = progress.dominantEmotion || 'Alegría';
    
    const EMOTION_HEX: Record<string, string> = {
      Alegría: '#ffd700',
      Amor: '#ff1493',
      Ira: '#ff3b30',
      Miedo: '#4b0082',
      Serenidad: '#00e1d9',
      Tristeza: '#3278ff',
      Confianza: '#2cd178',
      Sorpresa: '#ff9f29',
      Orgullo: '#ce7aff',
    };

    if (avatar.colorTheme === 'abyssal') nColor = '#8b5cf6';
    else if (avatar.colorTheme === 'solstice') nColor = '#f59e0b';
    else if (avatar.colorTheme === 'primeval') nColor = '#ef4444';
    else if (EMOTION_HEX[dominantEmotion]) nColor = EMOTION_HEX[dominantEmotion];
    
    return nColor;
  };

  const handleDropEquip = (slot: keyof EquipmentSlots, item: CraftableItem) => {
    let isValid = false;
    if (slot === 'mainHand') {
      isValid = item.subType === 'weapon' || item.subType === 'weapon_1h' || item.subType === 'weapon_2h' || item.subType === 'ranged' || item.subType === 'grimoire';
    } else if (slot === 'offHand') {
      isValid = item.subType === 'shield';
    } else if (slot === 'chest') {
      isValid = item.subType === 'chest' || item.subType === 'armor';
    } else if (slot === 'legs') {
      isValid = item.subType === 'legs';
    } else if (slot === 'head') {
      isValid = item.subType === 'head';
    } else if (slot === 'backpack') {
      isValid = item.subType === 'backpack';
    } else if (slot === 'axe') {
      isValid = item.subType === 'axe';
    } else if (slot === 'pickaxe') {
      isValid = item.subType === 'pickaxe';
    }

    if (isValid) {
      handleEquipItemInWorld(slot, item);
    } else {
      triggerNotification(`⚠️ No puedes equipar ${item.name} en la ranura ${slot.toUpperCase()}`);
    }
  };

  const autoEquipItem = (item: CraftableItem) => {
    let slot: keyof EquipmentSlots | null = null;
    if (item.subType === 'weapon' || item.subType === 'weapon_1h' || item.subType === 'weapon_2h' || item.subType === 'ranged' || item.subType === 'grimoire') {
      slot = 'mainHand';
    } else if (item.subType === 'shield') {
      slot = 'offHand';
    } else if (item.subType === 'chest' || item.subType === 'armor') {
      slot = 'chest';
    } else if (item.subType === 'legs') {
      slot = 'legs';
    } else if (item.subType === 'head') {
      slot = 'head';
    } else if (item.subType === 'backpack') {
      slot = 'backpack';
    } else if (item.subType === 'axe') {
      slot = 'axe';
    } else if (item.subType === 'pickaxe') {
      slot = 'pickaxe';
    }

    if (slot) {
      handleEquipItemInWorld(slot, item);
    }
  };

  const renderDollSlot = (slot: keyof EquipmentSlots, label: string, defaultEmoji: string, equippedEmoji: string) => {
    const isSelected = selectedDollSlot === slot;
    const isDragOver = dragOverSlot === slot;
    const item = progress.equipment?.[slot];

    let bgClass = "bg-[#0a0b10]";
    let borderClass = "border-gray-700";

    if (isSelected) {
      bgClass = "bg-[#160b0f]";
      borderClass = "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]";
    } else if (isDragOver) {
      bgClass = "bg-[#221017]";
      borderClass = "border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.6)] scale-105";
    } else if (item) {
      bgClass = "bg-[#0d1b15]";
      borderClass = "border-emerald-500/40 hover:border-emerald-500";
    }

    return (
      <div 
        onClick={() => setSelectedDollSlot(isSelected ? null : slot)}
        onDragOver={(e) => {
          e.preventDefault();
          if (dragOverSlot !== slot) setDragOverSlot(slot);
        }}
        onDragLeave={() => {
          if (dragOverSlot === slot) setDragOverSlot(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverSlot(null);
          const data = e.dataTransfer.getData('text/plain');
          if (data.startsWith('equip:')) {
            const itemId = data.split(':')[1];
            const foundItem = (progress.craftedItems || []).find(ci => ci.id === itemId);
            if (foundItem) {
              handleDropEquip(slot, foundItem);
            }
          }
        }}
        draggable={!!item}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', `unequip:${slot}`);
        }}
        className={`w-16 h-16 border rounded-lg flex flex-col items-center justify-center p-1 relative group cursor-pointer transition-all ${bgClass} ${borderClass}`}
      >
        <span className="text-[7px] absolute top-1 text-gray-500 font-mono tracking-wider">{label}</span>
        <span className="text-xl mt-2 select-none">{item ? equippedEmoji : defaultEmoji}</span>
        {item && item.tier && (
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono font-bold text-amber-400 bg-black/60 px-0.5 rounded">
            T{item.tier}
          </span>
        )}
      </div>
    );
  };

  const render2DAvatar = () => {
    const avatarColor = getAvatarColor();
    const eq = progress.equipment || {};
    const hasGlowingEyes = progress.avatar.traits?.includes('Ojos Rutilantes');
    
    return (
      <div className="relative w-56 h-64 flex items-center justify-center bg-black/40 border border-white/5 rounded-2xl p-4 overflow-hidden shadow-inner group select-none">
        {/* Dynamic Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
        
        {/* Background Summon/Scanning Ring */}
        <div 
          className="absolute w-44 h-44 rounded-full border border-dashed border-red-500/20 animate-spin"
          style={{ animationDuration: '20s', borderColor: `${avatarColor}33` }}
        />
        <div 
          className="absolute w-36 h-36 rounded-full border border-red-500/10 animate-spin"
          style={{ animationDuration: '10s', animationDirection: 'reverse', borderColor: `${avatarColor}22` }}
        />
        
        {/* Glow Aura */}
        <div 
          className="absolute w-32 h-32 rounded-full blur-[40px] opacity-20 animate-pulse transition-all duration-1000"
          style={{ backgroundColor: avatarColor }}
        />

        {/* Interactive Doll Container with floating animation */}
        <div className="relative flex flex-col items-center justify-center w-full h-full animate-[bounce_3s_ease-in-out_infinite]">
          
          {/* BACKPACK LAYER (behind body) */}
          {eq.backpack && (
            <div className="absolute -translate-y-2 translate-x-1 z-0 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">
              <span className="text-4xl">🎒</span>
            </div>
          )}

          {/* MAIN BODY SPHERE */}
          <div 
            className="relative w-24 h-24 rounded-full border border-white/20 shadow-lg flex items-center justify-center z-10 transition-all duration-500 overflow-hidden"
            style={{
              background: `radial-gradient(circle at 35% 35%, #ffffff 0%, ${avatarColor}55 50%, #000000ee 100%)`,
              boxShadow: `0 0 20px ${avatarColor}33, inset 0 0 15px rgba(255,255,255,0.2)`
            }}
          >
            {/* Eyes Group */}
            <div className="flex gap-4 mb-2 z-20">
              <div 
                className={`w-3 h-3 rounded-full ${hasGlowingEyes ? 'bg-white shadow-[0_0_8px_#fff]' : ''}`}
                style={hasGlowingEyes ? {} : { backgroundColor: avatarColor }}
              />
              <div 
                className={`w-3 h-3 rounded-full ${hasGlowingEyes ? 'bg-white shadow-[0_0_8px_#fff]' : ''}`}
                style={hasGlowingEyes ? {} : { backgroundColor: avatarColor }}
              />
            </div>
          </div>

          {/* HEAD OVERLAY (Helmet/Hat) */}
          {eq.head ? (
            <div className="absolute top-4 z-20 animate-pulse drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
              <span className="text-4xl">🪖</span>
              {eq.head.tier && (
                <span className="absolute -top-1 -right-1 text-[8px] bg-amber-500 text-black px-1 rounded-full font-bold">
                  T{eq.head.tier}
                </span>
              )}
            </div>
          ) : (
            /* Default cute horns or halo if no headgear */
            <div className="absolute top-6 z-20 flex gap-8 select-none pointer-events-none opacity-40">
              <span className="text-xl rotate-[-20deg]">😈</span>
              <span className="text-xl rotate-[20deg]">😈</span>
            </div>
          )}

          {/* CHEST OVERLAY (Armor Rig) */}
          {eq.chest ? (
            <div className="absolute top-14 z-20 drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]">
              <span className="text-4xl">👕</span>
              {eq.chest.tier && (
                <span className="absolute -bottom-1 -right-1 text-[8px] bg-amber-500 text-black px-1 rounded-full font-bold">
                  T{eq.chest.tier}
                </span>
              )}
            </div>
          ) : (
            /* Default light wrap if no armor */
            <div className="absolute top-16 z-20 opacity-20">
              <span className="text-2xl">🧣</span>
            </div>
          )}

          {/* LEGS OVERLAY (Greaves/Boots) */}
          {eq.legs ? (
            <div className="absolute bottom-6 z-20 drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]">
              <span className="text-3xl">👖</span>
              {eq.legs.tier && (
                <span className="absolute -bottom-1 -right-1 text-[8px] bg-amber-500 text-black px-1 rounded-full font-bold">
                  T{eq.legs.tier}
                </span>
              )}
            </div>
          ) : (
            <div className="absolute bottom-8 z-15 opacity-30">
              <span className="text-xl">🥾</span>
            </div>
          )}

          {/* HELD WEAPON (Left Hand Side) */}
          <div className="absolute -left-8 top-16 z-25 flex items-center justify-center w-12 h-12 bg-white/5 border border-white/10 rounded-full backdrop-blur-md shadow-md animate-pulse">
            {eq.mainHand ? (
              <span className="text-2xl">
                {eq.mainHand.subType === 'ranged' ? '🔫' : eq.mainHand.subType === 'grimoire' ? '🔮' : '⚔️'}
              </span>
            ) : (
              <span className="text-sm text-gray-500">👊</span>
            )}
          </div>

          {/* HELD SHIELD / OFF HAND (Right Hand Side) */}
          <div className="absolute -right-8 top-16 z-25 flex items-center justify-center w-12 h-12 bg-white/5 border border-white/10 rounded-full backdrop-blur-md shadow-md animate-pulse">
            {eq.offHand ? (
              <span className="text-2xl">🛡️</span>
            ) : (
              <span className="text-sm text-gray-500">❌</span>
            )}
          </div>

        </div>

        {/* Hover Name Badge */}
        <div className="absolute bottom-2 bg-black/60 px-3 py-0.5 rounded-full border border-white/10 backdrop-blur-sm z-30">
          <span className="text-[10px] text-gray-300 font-mono tracking-wider font-bold uppercase">{progress.avatar.name || "Nitz Guardián"}</span>
        </div>
      </div>
    );
  };

  // Calculate Weapon Mastery Multiplier (+5% per mastery level above 1)
  const getWeaponMasteryMultiplier = (wepSubType: string | undefined): number => {
    const wm = progressRef.current.weaponMastery || {};
    let lvl = 1;
    if (wepSubType === 'weapon_1h' || wepSubType === 'weapon_2h' || wepSubType === 'weapon') {
      lvl = wm.sword || 1;
    } else if (wepSubType === 'ranged') {
      lvl = wm.ranged || 1;
    } else if (wepSubType === 'grimoire') {
      lvl = wm.grimoire || 1;
    } else {
      lvl = wm.fists || 1;
    }
    return 1.0 + (lvl - 1) * 0.05;
  };

  // Add Weapon Mastery Experience
  const addWeaponMasteryExp = (wepType: 'sword' | 'ranged' | 'grimoire' | 'fists', expGained: number) => {
    const currentProgress = progressRef.current;
    const wm = {
      sword: 1,
      ranged: 1,
      grimoire: 1,
      fists: 1,
      ...(currentProgress.weaponMastery || {})
    };
    const wmExp = {
      sword: 0,
      ranged: 0,
      grimoire: 0,
      fists: 0,
      ...(currentProgress.weaponMasteryExp || {})
    };

    let currentLvl = wm[wepType] || 1;
    let currentExp = wmExp[wepType] || 0;
    
    currentExp += expGained;
    
    const expThreshold = 500;
    let leveledUp = false;
    while (currentExp >= expThreshold) {
      currentExp -= expThreshold;
      currentLvl += 1;
      leveledUp = true;
    }

    const nextWm = { ...wm, [wepType]: currentLvl };
    const nextWmExp = { ...wmExp, [wepType]: currentExp };

    const updatedProg = {
      ...currentProgress,
      weaponMastery: nextWm,
      weaponMasteryExp: nextWmExp
    };

    onSaveProgressRef.current(updatedProg);
    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      updateDoc(userRef, {
        weaponMastery: nextWm,
        weaponMasteryExp: nextWmExp
      }).catch(err => console.error("Error updating weapon mastery in DB:", err));
    }
    
    if (leveledUp) {
      triggerNotification(`🎉 ¡Nivel de Maestría subido para ${wepType.toUpperCase()}! Nuevo Nivel: ${currentLvl}`);
    }
  };

  // Inject testing kit — DEV mode only, once per profile
  useEffect(() => {
    const isDev = import.meta.env.DEV;
    if (!isDev || progress.devKitInjected) return;

    const testingTools: CraftableItem[] = [
        { id: `t_axe1_test_${Date.now()}`, name: 'Hacha de Novicio (T1)', type: 'tool', subType: 'axe', rarity: 'common', tier: 1, weight: 2, equipped: false },
        { id: `t_pick1_test_${Date.now()}`, name: 'Pico de Novicio (T1)', type: 'tool', subType: 'pickaxe', rarity: 'common', tier: 1, weight: 2, equipped: false },
        { id: `t_axe2_test_${Date.now()}`, name: 'Hacha de Cobre (T2)', type: 'tool', subType: 'axe', rarity: 'rare', tier: 2, weight: 2, equipped: false },
        { id: `t_pick2_test_${Date.now()}`, name: 'Pico de Cobre (T2)', type: 'tool', subType: 'pickaxe', rarity: 'rare', tier: 2, weight: 2, equipped: false },
        { id: `t_axe3_test_${Date.now()}`, name: 'Hacha de Hierro (T3)', type: 'tool', subType: 'axe', rarity: 'epic', tier: 3, weight: 3, equipped: false },
        { id: `t_pick3_test_${Date.now()}`, name: 'Pico de Hierro (T3)', type: 'tool', subType: 'pickaxe', rarity: 'epic', tier: 3, weight: 3, equipped: false },
        { id: `t_axe4_test_${Date.now()}`, name: 'Hacha de Titanio (T4)', type: 'tool', subType: 'axe', rarity: 'legendary', tier: 4, weight: 4, equipped: false },
        { id: `t_pick4_test_${Date.now()}`, name: 'Pico de Titanio (T4)', type: 'tool', subType: 'pickaxe', rarity: 'legendary', tier: 4, weight: 4, equipped: false },
      ];

      let newGrid = [...(progress.stashGrid || [])];
      while (newGrid.length < 40) {
        newGrid.push(null);
      }

      const rawCategories = ['wood', 'stone', 'metal'] as const;
      const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
      let slotIdx = 0;

      rawCategories.forEach(cat => {
        rarities.forEach(rar => {
          while (slotIdx < newGrid.length && newGrid[slotIdx] !== null) {
            slotIdx++;
          }
          if (slotIdx < newGrid.length) {
            newGrid[slotIdx] = {
              id: `test_raw_${cat}_${rar}_${Date.now()}_${Math.random()}`,
              type: 'material',
              materialCategory: cat,
              materialRarity: rar,
              quantity: 99
            };
          }
        });
      });

      const refinedList = [
        { name: 'Tablón de Pino Refinado', subType: 'refined_wood' as const, rarity: 'common' as const, tier: 1 },
        { name: 'Tablón de Abedul Refinado', subType: 'refined_wood' as const, rarity: 'rare' as const, tier: 2 },
        { name: 'Tablón de Castaño Refinado', subType: 'refined_wood' as const, rarity: 'epic' as const, tier: 3 },
        { name: 'Tablón de Cedro Refinado', subType: 'refined_wood' as const, rarity: 'legendary' as const, tier: 4 },
        { name: 'Lingote de Cobre Refinado', subType: 'refined_metal' as const, rarity: 'rare' as const, tier: 2 },
        { name: 'Lingote de Hierro Refinado', subType: 'refined_metal' as const, rarity: 'epic' as const, tier: 3 },
        { name: 'Lingote de Titanio Refinado', subType: 'refined_metal' as const, rarity: 'legendary' as const, tier: 4 },
        { name: 'Bloque de Piedra Refinado', subType: 'refined_stone' as const, rarity: 'common' as const, tier: 1 },
        { name: 'Bloque de Granito Refinado', subType: 'refined_stone' as const, rarity: 'rare' as const, tier: 2 },
        { name: 'Bloque de Pizarra Refinado', subType: 'refined_stone' as const, rarity: 'epic' as const, tier: 3 },
        { name: 'Bloque de Mármol Refinado', subType: 'refined_stone' as const, rarity: 'legendary' as const, tier: 4 },
      ];

      const refinedCrafted: CraftableItem[] = refinedList.map(ref => ({
        id: `test_ref_${ref.subType}_t${ref.tier}_${Date.now()}_${Math.random()}`,
        name: ref.name,
        type: 'material',
        subType: ref.subType,
        rarity: ref.rarity,
        tier: ref.tier,
        quantity: 50
      }));

      const updatedCraftedList = [
        ...(progress.craftedItems || []),
        ...testingTools,
        ...refinedCrafted
      ];

      const nextProg = {
        ...progress,
        craftedItems: updatedCraftedList,
        stashGrid: newGrid,
        devKitInjected: true,
      };

      onSaveProgress(nextProg);
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        updateDoc(userRef, {
          craftedItems: updatedCraftedList,
          stashGrid: newGrid,
          devKitInjected: true,
        }).catch(err => console.error("Error applying testing kit in DB:", err));
      }
      triggerNotification("🎁 [DEV] Kit de Pruebas Inyectado: herramientas y materiales listos.");
  }, []);

  // Evade Dash trigger
  const triggerEvadeDash = () => {
    if (dashCooldownLeftRef.current > 0 || isDodgingRef.current) return;
    isDodgingRef.current = true;
    dashCooldownLeftRef.current = 3.0;
    setDashCooldownLeft(3.0);

    // Play whoosh sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (_) {}

    setTimeout(() => {
      isDodgingRef.current = false;
    }, 150);
  };

  // Setup initial key listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      
      if (k === 'tab') {
        e.preventDefault();
        if (activeOverlayRef.current === 'none') {
          setShowQuickInventory(prev => !prev);
        }
        return;
      }

      keysDownRef.current[k] = true;
      keysRef.current[k] = true;
      setKeys({ ...keysDownRef.current });

      // Action RPG Dodge (Shift key)
      if (k === 'shift') {
        e.preventDefault();
        if (dashCooldownLeftRef.current <= 0 && !isDodgingRef.current && activeOverlayRef.current === 'none') {
          triggerEvadeDash();
        }
      }

      // Special Ability (Q key)
      if (k === 'q') {
        e.preventDefault();
        if (skillCooldownLeftRef.current <= 0 && activeOverlayRef.current === 'none') {
          triggerSpecialSkillRef.current();
        }
      }

      // If user presses Control, release pointer lock
      if (e.key === 'Control') {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }

      // If user presses F, trigger interaction
      if ((e.key === 'f' || e.key === 'F') && activeOverlayRef.current === 'none') {
        handleInteractNearNodeRef.current();
      }

      // If user presses E, toggle Nitz summon state
      if ((e.key === 'e' || e.key === 'E') && activeOverlayRef.current === 'none') {
        const nextSummoned = !progressRef.current.companionSummoned;
        onSaveProgressRef.current({
          ...progressRef.current,
          companionSummoned: nextSummoned
        });
        if (auth.currentUser) {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          updateDoc(userRef, {
            companionSummoned: nextSummoned
          }).catch(err => console.error("Error updating summon status in DB:", err));
        }
        triggerNotification(nextSummoned ? `🐾 ¡${progressRef.current.avatar.name || 'Nitz'} invocado! Te seguirá y te ayudará.` : `🐾 ${progressRef.current.avatar.name || 'Nitz'} regresó a descansar.`);
      }

      // If user presses H, toggle Cabin System overlay
      if ((e.key === 'h' || e.key === 'H') && activeOverlayRef.current === 'none') {
        if (currentMapRef.current === 'cabin') {
          setActiveOverlay('cabin_system');
        } else {
          triggerNotification("🏠 El gestor de cabaña solo se puede abrir dentro de tu cabaña.");
        }
      }

      // If user presses V, activate proximity voice chat
      if ((e.key === 'v' || e.key === 'V') && activeOverlayRef.current === 'none') {
        setIsProximityChatActive(true);
        if (auth.currentUser) {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          updateDoc(userRef, { isSpeaking: true }).catch(err => {});
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysDownRef.current[k] = false;
      keysRef.current[k] = false;
      setKeys({ ...keysDownRef.current });

      if (e.key === 'v' || e.key === 'V') {
        setIsProximityChatActive(false);
        if (auth.currentUser) {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          updateDoc(userRef, { isSpeaking: false }).catch(err => {});
        }
      }
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
    const prevMap = prevMapRef.current;
    prevMapRef.current = currentMap;

    if (currentMap === 'sanctuary') {
      newNodes = [
        { id: 'sanctuary_exit', name: 'Puerta del Gran Árbol (Salida)', x: 0, z: 20, type: 'door_lobby', label: '🚪 Cruzar el umbral hacia el Lobby' },
        { id: 'shrine_emotions', name: 'Monolito de las Emociones', x: -10, z: -10, type: 'bookshelf', label: '✨ Meditar sobre el Sentimiento Primordial' },
        { id: 'shrine_bond', name: 'Altar del Vínculo Estelar', x: 10, z: -10, type: 'anvil', label: '🌟 Sintonizar la Alianza con tu Nitz' },
        { id: 'great_seed', name: 'Corazón del Árbol de la Vida', x: 0, z: -20, type: 'synth', label: '🌱 Observar la Semilla Primordial' },
      ];
      setPlayerX(0);
      setPlayerZ(15);
      playerXRef.current = 0;
      playerZRef.current = 15;
    } else if (currentMap === 'cabin') {
      newNodes = [
        // Orit NPC — always present in cabin
        { id: 'orit_mentor', name: 'Orit — El Nitz Mentor', x: -3, z: -2, type: 'orit_npc', label: '🌟 Hablar con Orit' },
        { id: 'stash', name: 'Almacén Táctico (Stash)', x: 4, z: 2, type: 'stash', label: '📦 Abrir Almacén Seguro' },
        { id: 'bookshelf', name: 'Terminal Códice de Arquetipos', x: -5, z: 2, type: 'bookshelf', label: '🖥️ Base de Datos de Nitz' },
        { id: 'companion_nitz', name: 'Tu Criatura Acompañante Nitz', x: 0, z: -1, type: 'nitz_npc', label: '🐾 Interactuar con Nitz' },
        { id: 'door_to_vecindario', name: 'Puerta Blindada (Salida)', x: 0, z: 6.5, type: 'door_vecindario', label: '🚪 Salir al Exterior' },
        // Workbenches: unlocked progressively by cabin level
        ...((progress.cabin?.level || 1) >= 2 ? [
          { id: 'workbench_forge', name: 'Herrería de Combate Pesado', x: 5, z: -3, type: 'forge' as const, label: '⚒️ Fabricar Armas y Blindaje' },
          { id: 'workbench_refiner', name: 'Refinería de Recursos Estelares', x: 2.5, z: -4.5, type: 'refiner' as const, label: '🔥 Refinar Madera, Metal y Piedra' },
        ] : []),
        ...((progress.cabin?.level || 1) >= 3 ? [
          { id: 'workbench_weaver', name: 'Telar de Supervivencia', x: -5, z: -3, type: 'weaver' as const, label: '🧵 Fabricar Mochilas y Tela' },
          { id: 'workbench_enchanter', name: 'Mesa de Arcanos', x: 0, z: -5, type: 'enchanter' as const, label: '🔮 Fabricar Grimorios y Joyas' },
        ] : []),
        ...((progress.cabin?.level || 1) >= 4 ? [
          { id: 'wardrobe_mirror', name: 'Espejo de Apariencia', x: -2.5, z: -4.5, type: 'wardrobe_mirror' as const, label: '🪞 Personalizar Apariencia del Avatar' },
          { id: 'wardrobe_armory', name: 'Armero de Pruebas', x: -2.5, z: -2.5, type: 'wardrobe_armory' as const, label: '⚔️ Probar Armas y Equipamiento' },
        ] : []),
      ];
      setPlayerX(0);
      setPlayerZ(4);
      playerXRef.current = 0;
      playerZRef.current = 4;
    } else if (currentMap === 'neighborhood') {
      newNodes = [
        { id: 'door_back_cabin', name: 'Tu Cabaña', x: 0, z: 25, type: 'door_cabin', label: '🏠 Entrar a tu Cabaña' },
        { id: 'road_to_lobby', name: 'Senda al Templo del Lobby', x: 0, z: -55, type: 'door_lobby', label: '💎 Viajar al Lobby Central' },
        // Static interactive houses of neighbors
        { id: 'plot_luz', name: 'C Cathedral de Guardián_Luz', x: -30, z: -10, type: 'house_plot', plotOwnerId: 'plot_luz', label: '🏰 Visitar / Alabar Nitz de Guardián_Luz' },
        { id: 'plot_anime', name: 'Cabaña de AuraAnime', x: 30, z: -10, type: 'house_plot', plotOwnerId: 'plot_anime', label: '🌸 Visitar / Alabar Nitz de AuraAnime' },
        { id: 'plot_stellaria', name: 'Cabaña de Stellaria', x: -20, z: -35, type: 'house_plot', plotOwnerId: 'plot_stellaria', label: '🌌 Visitar / Alabar Nitz de Stellaria' }
      ];
      setPlayerX(0);
      playerXRef.current = 0;
      if (prevMap === 'lobby') {
        setPlayerZ(-50); // Spawn near road_to_lobby (which is at z: -55)
        playerZRef.current = -50;
      } else {
        setPlayerZ(20); // Spawn near door_back_cabin (which is at z: 25)
        playerZRef.current = 20;
      }
    } else if (currentMap === 'lobby') {
      newNodes = [
        { id: 'marketplace', name: 'Gran Mercado Global', x: 12, z: 0, type: 'marketplace', label: '⚖️ Acceder al Mercado Vivo (Comprar/Vender)' },
        { id: 'gate_vecindario', name: 'Paso de Regreso a Vecindarios', x: 0, z: 45, type: 'door_vecindario', label: '🏘️ Regresar al Vecindario' },
        { id: 'gate_world1', name: 'Portal al Mapa 1: Bosque Seguro', x: -35, z: -20, type: 'door_map1', label: '🌲 Viajar al Bosque Seguro (Fácil/Seguro)' },
        { id: 'gate_world2', name: 'Portal al Mapa 2: Cantera de Caos', x: 35, z: -20, type: 'door_map2', label: '💎 Viajar al Cantera Estelar (Medio/Materiales)' },
        { id: 'gate_world3', name: 'Portal Celestial al Mapa 3: Zona de Bruma de Sangre', x: 0, z: -45, type: 'door_map3', label: '💀 Viajar a la Zona Roja (Elite/PvP / Full Loot!)' },
        { id: 'portal_arena', name: 'Portal de Duelos de Arena vs Rogue Nitz', x: 0, z: -5, type: 'door_arena', label: '⚔️ Iniciar Arena de Combates vs Rogue Nitz' }
      ];
      if (prevMap === 'neighborhood') {
        setPlayerX(0);
        setPlayerZ(40); // near gate_vecindario (z: 45)
        playerXRef.current = 0;
        playerZRef.current = 40;
      } else if (prevMap === 'map1') {
        setPlayerX(-35); // near gate_world1 (x: -35, z: -20)
        setPlayerZ(-12); // spawned in front of the portal
        playerXRef.current = -35;
        playerZRef.current = -12;
      } else if (prevMap === 'map2') {
        setPlayerX(35); // near gate_world2 (x: 35, z: -20)
        setPlayerZ(-12); // spawned in front of the portal
        playerXRef.current = 35;
        playerZRef.current = -12;
      } else if (prevMap === 'map3') {
        setPlayerX(0); // near gate_world3 (x: 0, z: -45)
        setPlayerZ(-35); // spawned in front of the portal
        playerXRef.current = 0;
        playerZRef.current = -35;
      } else {
        setPlayerX(0);
        setPlayerZ(10);
        playerXRef.current = 0;
        playerZRef.current = 10;
      }
    } else if (currentMap === 'map1') {
      // Safe gathering field
      newNodes = [
        { id: 'map1_exit', name: 'Portal de Escape al Lobby', x: 0, z: 80, type: 'door_lobby', label: '🚪 Regresar al Lobby Seguro' },
        { id: 'tr_c1', name: 'Arbusto Centelleante Común', x: -25, z: 10, type: 'tree', rarity: 'common', clicksRequired: 3, clicksCurrent: 0, label: '🌲 Recolectar Madera Común (+4 EXP)' },
        { id: 'tr_r2', name: 'Roble Ancestral de Aura', x: 25, z: -15, type: 'tree', rarity: 'rare', clicksRequired: 6, clicksCurrent: 0, label: '✨ Recolectar Madera Rara (+10 EXP)' },
        { id: 'tr_e1', name: 'Esencia de Bosque Resplandeciente', x: -10, z: -45, type: 'tree', rarity: 'epic', clicksRequired: 10, clicksCurrent: 0, label: '🔮 Recolectar Esencia Épica (+22 EXP)' }
      ];
      setPlayerX(0);
      setPlayerZ(70);
      playerXRef.current = 0;
      playerZRef.current = 70;
    } else if (currentMap === 'map2') {
      newNodes = [
        { id: 'map2_exit', name: 'Portal de Escape al Lobby', x: 0, z: 80, type: 'door_lobby', label: '🚪 Regresar al Lobby Seguro' },
        { id: 'or_c1', name: 'Fisura de Piedra Celestial', x: -30, z: 15, type: 'ore', rarity: 'common', clicksRequired: 4, clicksCurrent: 0, label: '🪨 Extraer Piedra Estelar (+4 EXP)' },
        { id: 'or_r1', name: 'Beta de Vena Metálica', x: 30, z: -10, type: 'ore', rarity: 'rare', clicksRequired: 8, clicksCurrent: 0, label: '⚡ Extraer Veta Metálica Rara (+10 EXP)' },
        { id: 'or_e1', name: 'Esencia de Falla Cósmica', x: 0, z: -40, type: 'tree', rarity: 'epic', clicksRequired: 11, clicksCurrent: 0, label: '🔮 Recolectar Esencia de Cuarzo Épico (+22 EXP)' }
      ];
      setPlayerX(0);
      setPlayerZ(70);
      playerXRef.current = 0;
      playerZRef.current = 70;
    } else if (currentMap === 'map3') {
      // Hard dangerous PvP Zone
      newNodes = [
        { id: 'map3_exit', name: 'Portal de Salvación al Lobby', x: 0, z: 80, type: 'door_lobby', label: '🚪 Regresar al Lobby de Enlace (Saca tu mochila!)' },
        { id: 'or_ep1', name: 'Hierro del Abismo Destructor', x: -35, z: 10, type: 'ore', rarity: 'epic', clicksRequired: 12, clicksCurrent: 0, label: '🔥 Extraer Hierro del Abismo Épico (+22 EXP)' },
        { id: 'or_ld1', name: 'Estatua del Alba Legendaria', x: 35, z: -20, type: 'ore', rarity: 'legendary', clicksRequired: 18, clicksCurrent: 0, label: '👑 Extraer Cristal de Alba Legendario (+45 EXP!)' },
        { id: 'tr_ld1', name: 'Neblina Astral de Caos', x: 0, z: -45, type: 'tree', rarity: 'legendary', clicksRequired: 17, clicksCurrent: 0, label: '🌌 Condensar Neblina Estelar Legendaria (+45 EXP!)' }
      ];
      // Randomize extraction coordinates
      extractionXRef.current = (Math.random() - 0.5) * 140;
      extractionZRef.current = (Math.random() - 0.5) * 140;
      while (Math.sqrt(Math.pow(extractionXRef.current, 2) + Math.pow(extractionZRef.current - 70, 2)) < 30) {
        extractionXRef.current = (Math.random() - 0.5) * 140;
        extractionZRef.current = (Math.random() - 0.5) * 140;
      }

      setPlayerX(0);
      setPlayerZ(70);
      playerXRef.current = 0;
      playerZRef.current = 70;
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
              activeNitzName: data.activeNitzName || data.avatar?.name || 'Nitz de Origen',
              avatar: data.avatar || {
                name: data.activeNitzName || 'Nitz de Origen',
                accessory: 'none',
                auraType: 'none',
                colorTheme: (data.activeNitzName === 'Nitz Ígneo' ? 'primeval' : data.activeNitzName === 'Nitz Abisal' ? 'abyssal' : 'classic'),
                clothing: 'none'
              }
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
          avatar: progress.avatar || null,
          isSpeaking: isProximityChatActive,
          lastActive: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error syncing player positional stats:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [currentMap, playerX, playerZ, cameraAngle, pvpEnabled, progress.companionSummoned, progress.avatar.name, isProximityChatActive]);

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
          changeMap('cabin');
          triggerNotification("💀 Duelo empatado. Ambos han colapsado y perdido sus recursos en la bruma.");
        } else {
          setTempBag({
            wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
            stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
            metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
            essence: { common: 0, rare: 0, epic: 0, legendary: 0 }
          });
          changeMap('cabin');
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

  // Player Death Listener
  useEffect(() => {
    if (progress.hp !== undefined && progress.hp <= 0) {
      const isRedZone = currentMap === 'map3';
      const isAdventure = currentMap === 'map1' || currentMap === 'map2' || currentMap === 'map3';
      
      if (isAdventure) {
        setTempBag({
          wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
          stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
          metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
          essence: { common: 0, rare: 0, epic: 0, legendary: 0 }
        });
      }

      // Reset HP and send back to cabin
      onSaveProgress({
        ...progress,
        hp: progress.maxHp || 100
      });
      if (auth.currentUser) {
        updateDoc(doc(db, 'users', auth.currentUser.uid), { hp: progress.maxHp || 100 });
      }

      changeMap('cabin');
      if (isRedZone) {
        triggerNotification("💀 HAS MUERTO. Fuiste derrotado en la Zona Roja y perdiste todo tu botín temporal.");
      } else if (isAdventure) {
        triggerNotification("💀 HAS MUERTO. Fuiste derrotado por criaturas hostiles y perdiste tu botín temporal.");
      } else {
        triggerNotification("💀 HAS MUERTO. Despertaste en tu cabaña.");
      }
    }
  }, [progress.hp, currentMap]);

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
    if (currentMap === 'map3' || currentMap === 'map1' || currentMap === 'map2') {
      setTempBag({
        wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
        stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
        metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
        essence: { common: 0, rare: 0, epic: 0, legendary: 0 }
      });
      changeMap('cabin');
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
      changeMap('lobby'); // return player safely to Lobby
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

    // Check if player moved out of extraction zone
    const distanceToBeacon = Math.sqrt(Math.pow(playerX - extractionXRef.current, 2) + Math.pow(playerZ - extractionZRef.current, 2));
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
    if (currentMap === 'sanctuary') {
      scene.background = new THREE.Color(0x0a1c0e); // Deep moss/nature theme
      scene.fog = new THREE.FogExp2(0x0a1c0e, 0.04);
    } else if (currentMap === 'cabin') {
      scene.background = new THREE.Color(0x050608); // Pitch black/tactical
      scene.fog = new THREE.FogExp2(0x050608, 0.08);
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
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 300);
    cameraRef.current = camera;
    scene.add(camera);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfcf8f2, 0.85);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Create Floor Grid and Landscape representation
    let floorSize = 80;
    let gridDivisions = 40;
    if (currentMap === 'sanctuary') {
      floorSize = 80;
      gridDivisions = 40;
    } else if (currentMap === 'lobby' || currentMap === 'neighborhood') {
      floorSize = 160;
      gridDivisions = 80;
    } else if (currentMap === 'map1' || currentMap === 'map2' || currentMap === 'map3') {
      floorSize = 180;
      gridDivisions = 90;
    }

    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize, 20, 20);
    floorGeo.rotateX(-Math.PI / 2);

    const floorTexture = createProceduralFloorTexture(currentMap);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: currentMap === 'cabin' ? 0.4 : 0.8,
      metalness: currentMap === 'cabin' ? 0.3 : 0.1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    scene.add(floorMesh);

    // Sky Dome
    const skyGeo = new THREE.SphereGeometry(175, 32, 15);
    const skyMat = new THREE.MeshBasicMaterial({
      map: createProceduralSkyTexture(currentMap),
      side: THREE.BackSide,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    skyDome.scale.set(-1, 1, 1);
    scene.add(skyDome);

    // In Map 3, draw the Extraction Beacon
    let extractionBeaconMesh: THREE.Mesh | null = null;
    let extractionZoneRing: THREE.Mesh | null = null;
    let extractionShieldMesh: THREE.Mesh | null = null;

    if (currentMap === 'map3') {
      const eX = extractionXRef.current;
      const eZ = extractionZRef.current;

      // Beacon pole
      const poleGeo = new THREE.CylinderGeometry(0.2, 0.25, 3.5, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
      extractionBeaconMesh = new THREE.Mesh(poleGeo, poleMat);
      extractionBeaconMesh.position.set(eX, 1.75, eZ);
      scene.add(extractionBeaconMesh);

      // Glowing light at the top of the beacon
      const lightGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const lightMat = new THREE.MeshBasicMaterial({
        color: extractionActive ? 0x10b981 : 0xef4444,
      });
      const topLight = new THREE.Mesh(lightGeo, lightMat);
      topLight.position.y = 1.85;
      extractionBeaconMesh.add(topLight);

      // Giant glowing light beam shooting to the sky
      const beamGeo = new THREE.CylinderGeometry(0.4, 0.4, 60, 16);
      const beamMat = new THREE.MeshBasicMaterial({
        color: extractionActive ? 0x10b981 : 0xef4444,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide
      });
      const skyBeam = new THREE.Mesh(beamGeo, beamMat);
      skyBeam.position.set(0, 30, 0); // Local to beacon
      extractionBeaconMesh.add(skyBeam);

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
      extractionZoneRing.position.set(eX, 0.05, eZ);
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
        extractionShieldMesh.position.set(eX, 0, eZ);
        scene.add(extractionShieldMesh);
      }
    }

    // Render floor grids details
    const gridHelper = new THREE.GridHelper(floorSize, gridDivisions, 0xdec1ac, 0x3e425e);
    gridHelper.position.y = 0.01;
    if (gridHelper.material instanceof THREE.Material) {
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.15;
    }
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
    const activeMeshes: THREE.Object3D[] = [];

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
        const nitzGroup = createDetailedNitzMesh(
          progress.avatar,
          currentDominant.name as EmotionName,
          progress.phase,
          0.45
        );
        nitzGroup.position.set(node.x, 0.45, node.z);
        nitzGroup.name = node.id;
        scene.add(nitzGroup);
        activeMeshes.push(nitzGroup);
        return; // Skip normal mesh instantiation below
      } else if (node.type === 'house_plot') {
        // Neighborhood houses
        geo = new THREE.BoxGeometry(4, 3, 4);
        mat = new THREE.MeshStandardMaterial({ color: 0x2a2845, roughness: 0.6 });
      } else if (node.type.startsWith('door_')) {
        const gateGroup = createDetailedGateMesh(node.type);
        gateGroup.position.set(node.x, 0, node.z);
        if (node.type === 'door_map1' || node.type === 'door_map2') {
          gateGroup.rotation.y = Math.atan2(node.x, node.z) + Math.PI;
        } else if (node.type === 'door_lobby' && (currentMap === 'map1' || currentMap === 'map2' || currentMap === 'map3')) {
          gateGroup.rotation.y = Math.PI;
        }
        gateGroup.name = node.id;
        scene.add(gateGroup);
        activeMeshes.push(gateGroup);
        return;
      } else if (node.type === 'stash') {
        const chestGroup = new THREE.Group();
        const baseGeo = new THREE.BoxGeometry(1.6, 0.8, 1.0);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.4;
        chestGroup.add(base);

        const lidGeo = new THREE.BoxGeometry(1.64, 0.2, 1.04);
        const lidMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 });
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.position.y = 0.9;
        chestGroup.add(lid);

        const lockGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
        const lockMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.1 });
        const lock = new THREE.Mesh(lockGeo, lockMat);
        lock.position.set(0, 0.6, 0.52);
        chestGroup.add(lock);

        chestGroup.position.set(node.x, 0, node.z);
        chestGroup.name = node.id;
        scene.add(chestGroup);
        activeMeshes.push(chestGroup);
        return;
      } else if (node.type === 'forge') {
        const forgeGroup = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(1.8, 1.5, 1.2);
        const brickMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.9 });
        const body = new THREE.Mesh(bodyGeo, brickMat);
        body.position.y = 0.75;
        forgeGroup.add(body);
        
        const chimGeo = new THREE.CylinderGeometry(0.3, 0.3, 2.0, 8);
        const chim = new THREE.Mesh(chimGeo, brickMat);
        chim.position.set(0, 2.0, 0);
        forgeGroup.add(chim);

        const fireGeo = new THREE.BoxGeometry(1.2, 0.2, 0.8);
        const fireMat = new THREE.MeshBasicMaterial({ color: 0xff4500 });
        const fire = new THREE.Mesh(fireGeo, fireMat);
        fire.position.set(0, 0.9, 0.22);
        forgeGroup.add(fire);

        forgeGroup.position.set(node.x, 0, node.z);
        forgeGroup.name = node.id;
        scene.add(forgeGroup);
        activeMeshes.push(forgeGroup);
        return;
      } else if (node.type === 'weaver') {
        const loomGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.0, 0.15), woodMat);
        p1.position.set(-0.8, 1.0, -0.4);
        const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.0, 0.15), woodMat);
        p2.position.set(0.8, 1.0, -0.4);
        const p3 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.0, 0.15), woodMat);
        p3.position.set(-0.8, 1.0, 0.4);
        const p4 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.0, 0.15), woodMat);
        p4.position.set(0.8, 1.0, 0.4);
        
        const cb1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.15), woodMat);
        cb1.position.set(0, 1.9, 0);
        const cb2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.15), woodMat);
        cb2.position.set(0, 0.3, 0);
        
        const clothMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.9 });
        const clothRoller = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 12), clothMat);
        clothRoller.rotation.z = Math.PI / 2;
        clothRoller.position.set(0, 1.1, 0);

        loomGroup.add(p1, p2, p3, p4, cb1, cb2, clothRoller);
        loomGroup.position.set(node.x, 0, node.z);
        loomGroup.name = node.id;
        scene.add(loomGroup);
        activeMeshes.push(loomGroup);
        return;
      } else if (node.type === 'enchanter') {
        const enchGroup = new THREE.Group();
        const pedGeo = new THREE.CylinderGeometry(0.8, 1.0, 1.2, 16);
        const pedMat = new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.7 });
        const ped = new THREE.Mesh(pedGeo, pedMat);
        ped.position.y = 0.6;
        enchGroup.add(ped);

        const crystalGeo = new THREE.OctahedronGeometry(0.35, 0);
        const crystalMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x6b21a8, roughness: 0.1, metalness: 0.9 });
        const floatingCrystal = new THREE.Mesh(crystalGeo, crystalMat);
        floatingCrystal.position.set(0, 1.8, 0);
        enchGroup.add(floatingCrystal);
        
        enchGroup.userData = { floatingCrystal };

      } else if (node.type === 'refiner') {
        const refinerGroup = new THREE.Group();
        const baseGeo = new THREE.CylinderGeometry(0.9, 1.1, 1.2, 8);
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.9 });
        const base = new THREE.Mesh(baseGeo, stoneMat);
        base.position.y = 0.6;
        refinerGroup.add(base);

        const funnelGeo = new THREE.CylinderGeometry(0.7, 0.4, 0.6, 8, 1, true);
        const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8, roughness: 0.4 });
        const funnel = new THREE.Mesh(funnelGeo, ironMat);
        funnel.position.y = 1.3;
        refinerGroup.add(funnel);

        const flameGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(0, 1.5, 0);
        refinerGroup.add(flame);

        refinerGroup.userData = { flame };

        refinerGroup.position.set(node.x, 0, node.z);
        refinerGroup.name = node.id;
        scene.add(refinerGroup);
        activeMeshes.push(refinerGroup);
        return;
      } else if (node.type === 'wardrobe_mirror') {
        const mirrorGroup = new THREE.Group();
        // Wooden frame
        const frameGeo = new THREE.BoxGeometry(1.6, 2.4, 0.15);
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.8 });
        const frame = new THREE.Mesh(frameGeo, woodMat);
        frame.position.y = 1.2;
        mirrorGroup.add(frame);

        // Mirror glass
        const glassGeo = new THREE.PlaneGeometry(1.3, 2.0);
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0x86efac,
          roughness: 0.1,
          metalness: 0.9,
          emissive: 0x155e75,
          emissiveIntensity: 0.3
        });
        const glass = new THREE.Mesh(glassGeo, glassMat);
        glass.position.set(0, 1.2, 0.08); // slightly in front of frame
        mirrorGroup.add(glass);

        // Rotate mirror to face the center of the cabin
        mirrorGroup.rotation.y = Math.PI / 4;

        mirrorGroup.position.set(node.x, 0, node.z);
        mirrorGroup.name = node.id;
        scene.add(mirrorGroup);
        activeMeshes.push(mirrorGroup);
        return;
      } else if (node.type === 'wardrobe_armory') {
        const armoryGroup = new THREE.Group();
        // Stand/Backboard
        const boardGeo = new THREE.BoxGeometry(1.8, 2.2, 0.3);
        const boardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 });
        const board = new THREE.Mesh(boardGeo, boardMat);
        board.position.y = 1.1;
        armoryGroup.add(board);

        // Rack shelves
        const shelfGeo = new THREE.BoxGeometry(1.7, 0.1, 0.4);
        const ironMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
        
        const shelf1 = new THREE.Mesh(shelfGeo, ironMat);
        shelf1.position.set(0, 0.5, 0.2);
        const shelf2 = new THREE.Mesh(shelfGeo, ironMat);
        shelf2.position.set(0, 1.3, 0.2);
        armoryGroup.add(shelf1, shelf2);

        // Small decorative swords/items inside the armory
        // Sword mesh
        const wepGroup = new THREE.Group();
        const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.03), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 }));
        swordBlade.position.y = 0.6;
        const swordHilt = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
        swordHilt.position.y = 0.1;
        wepGroup.add(swordBlade, swordHilt);
        wepGroup.position.set(-0.4, 0.8, 0.2);
        wepGroup.rotation.z = Math.PI / 8;
        armoryGroup.add(wepGroup);

        // Grimoire mesh
        const bookMat = new THREE.MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.5 });
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.1), bookMat);
        book.position.set(0.4, 1.5, 0.25);
        book.rotation.y = -Math.PI / 6;
        armoryGroup.add(book);

        // Rotate armory to face the center of the cabin
        armoryGroup.rotation.y = Math.PI / 4;

        armoryGroup.position.set(node.x, 0, node.z);
        armoryGroup.name = node.id;
        scene.add(armoryGroup);
        activeMeshes.push(armoryGroup);
        return;
      } else if (node.type === 'marketplace') {
        const martGroup = new THREE.Group();
        const standMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
        
        const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.0), standMat);
        table.position.y = 0.4;
        martGroup.add(table);

        const postMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.9 });
        const postL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), postMat);
        postL.position.set(-1.1, 1.1, -0.4);
        const postR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), postMat);
        postR.position.set(1.1, 1.1, -0.4);
        martGroup.add(postL, postR);

        const canopyGeo = new THREE.BoxGeometry(2.6, 0.15, 1.4);
        const canopyMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.8 });
        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        canopy.position.set(0, 2.2, -0.2);
        canopy.rotation.x = 0.2;
        martGroup.add(canopy);

        martGroup.position.set(node.x, 0, node.z);
        martGroup.name = node.id;
        scene.add(martGroup);
        activeMeshes.push(martGroup);
        return;
      } else { // portals or doors or other interactive entities
        geo = new THREE.TorusGeometry(1.2, 0.15, 8, 24);
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

    // Spawn decorative obstacles/scenery based on map type to shape pathways
    if (currentMap === 'map1' || currentMap === 'map2' || currentMap === 'map3') {
      const obstacleCount = currentMap === 'map1' ? 45 : currentMap === 'map2' ? 40 : 35;
      const avoidanceRadius = 8;
      
      for (let i = 0; i < obstacleCount; i++) {
        let ox = (Math.random() - 0.5) * 160;
        let oz = (Math.random() - 0.5) * 160;

        const playerDist = Math.sqrt(ox * ox + Math.pow(oz - 75, 2));
        if (playerDist < 12) continue;

        let tooClose = false;
        activeNodes.forEach(node => {
          const nodeDist = Math.sqrt(Math.pow(ox - node.x, 2) + Math.pow(oz - node.z, 2));
          if (nodeDist < avoidanceRadius) {
            tooClose = true;
          }
        });

        if (currentMap === 'map3') {
          const beaconDist = Math.sqrt(Math.pow(ox - extractionXRef.current, 2) + Math.pow(oz - extractionZRef.current, 2));
          if (beaconDist < 10) tooClose = true;
        }

        if (tooClose) continue;

        if (currentMap === 'map1') {
          const treeGroup = new THREE.Group();
          const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.y = 0.6;
          treeGroup.add(trunk);

          const leavesGeo = new THREE.ConeGeometry(0.9, 2.5, 8);
          const leavesMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.8 });
          const leaves = new THREE.Mesh(leavesGeo, leavesMat);
          leaves.position.y = 2.25;
          treeGroup.add(leaves);
          
          treeGroup.position.set(ox, 0, oz);
          treeGroup.traverse(child => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          treeGroup.name = `deco_tree_${i}`;
          scene.add(treeGroup);
          activeMeshes.push(treeGroup as any);

        } else if (currentMap === 'map2') {
          const cryGeo = new THREE.ConeGeometry(0.35, 1.8, 5);
          const cryMat = new THREE.MeshStandardMaterial({
            color: 0x0ea5e9,
            emissive: 0x0369a1,
            roughness: 0.1,
            metalness: 0.9
          });
          const crystal = new THREE.Mesh(cryGeo, cryMat);
          crystal.position.set(ox, 0.9, oz);
          crystal.rotation.x = (Math.random() - 0.5) * 0.3;
          crystal.rotation.z = (Math.random() - 0.5) * 0.3;
          crystal.castShadow = true;
          crystal.receiveShadow = true;
          crystal.name = `deco_crystal_${i}`;
          scene.add(crystal);
          activeMeshes.push(crystal);

        } else if (currentMap === 'map3') {
          const spikeGeo = new THREE.ConeGeometry(0.5, 2.2, 4);
          const spikeMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            emissive: 0x991b1b,
            roughness: 0.4,
            metalness: 0.7
          });
          const spike = new THREE.Mesh(spikeGeo, spikeMat);
          spike.position.set(ox, 1.1, oz);
          spike.rotation.x = (Math.random() - 0.5) * 0.25;
          spike.rotation.z = (Math.random() - 0.5) * 0.25;
          spike.castShadow = true;
          spike.receiveShadow = true;
          spike.name = `deco_spike_${i}`;
          scene.add(spike);
          activeMeshes.push(spike);
        }
      }
    }

    activeMeshesRef.current = activeMeshes;

    // Define colors dictionary for emotion mappings
    const colorsDict: Record<EmotionName, number> = {
      Ira: 0xef4444, Miedo: 0xa855f7, Tristeza: 0x3b82f6, Alegría: 0xfacc15,
      Confianza: 0x4ade80, Sorpresa: 0xf472b6, Amor: 0xf43f5e, Orgullo: 0xf97316, Serenidad: 0x22d3ee
    };

    // Populate actual online peers dynamically in tick loop via onlinePlayersRef to prevent scene re-creation
    const peerMeshes: { id: string; mesh: THREE.Group | THREE.Mesh; companionMesh?: THREE.Group | THREE.Mesh | null; activeNitzName?: string; companionSummoned?: boolean }[] = [];

    // Render Player's Companion Nitz in Cabin (always visible there)
    // In other maps: only when companionSummoned === true
    let companionMesh: THREE.Group | THREE.Mesh | null = null;
    let companionRing: THREE.Mesh | null = null;
    const isOritCompanion = progress.worldPresentation?.active && progress.worldPresentation?.oritAsCompanion;

    if (isOritCompanion) {
      const oritAvatar: AvatarCustomization = {
        name: 'Orit',
        accessory: 'halo',
        auraType: 'sparkles',
        colorTheme: 'solstice',
        clothing: 'none',
        traits: ['Ojos Rutilantes'],
      };
      companionMesh = createDetailedNitzMesh(oritAvatar, 'Alegría', 3, 0.45);
      companionMesh.position.set(playerX + 1.2, 1.2, playerZ - 1.2);
      scene.add(companionMesh);
      companionMeshRef.current = companionMesh;
    } else if (currentMap === 'cabin') {
      // Always show player Nitz in cabin
      companionMesh = createDetailedNitzMesh(
        progress.avatar,
        currentDominant.name as EmotionName,
        progress.phase,
        0.38
      );
      companionMesh.position.set(0, 1.0, -1);
      scene.add(companionMesh);
      companionMeshRef.current = companionMesh;

      // Orit NPC mesh — golden mentor Nitz, always in cabin
      const oritAvatar: AvatarCustomization = {
        name: 'Orit',
        accessory: 'halo',
        auraType: 'sparkles',
        colorTheme: 'solstice',
        clothing: 'shawl',
        traits: ['Ojos Rutilantes'],
      };
      const oritMesh = createDetailedNitzMesh(oritAvatar, 'Alegría', 3, 0.55);
      oritMesh.position.set(-3, 1.2, -2);
      oritMesh.name = 'orit_mentor_mesh';
      scene.add(oritMesh);
      activeMeshes.push(oritMesh);
    } else if (progress.companionSummoned) {
      companionMesh = createDetailedNitzMesh(
        progress.avatar,
        currentDominant.name as EmotionName,
        progress.phase,
        0.35
      );
      companionMesh.position.set(playerX + 1.2, 1.2, playerZ - 1.2);
      scene.add(companionMesh);
      companionMeshRef.current = companionMesh;
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

    const activeProjectiles: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number; isNitz: boolean; isNebulaPulse?: boolean; isSpecial?: boolean; damage?: number }[] = [];
    let lastNitzAttack = 0;

    const activeEnemies: LocalEnemy[] = [];
    const activeCoins: { mesh: THREE.Mesh; value: number }[] = [];
    const customEffects: { mesh: THREE.Mesh; update: () => boolean }[] = [];

    // Helper to draw floating 3D health bar sprite above enemies
    const createEnemyHealthBarSprite = (enemy: LocalEnemy) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 16;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 128, 16);

      ctx.fillStyle = '#ef4444';
      const hpPercent = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillRect(0, 0, 128 * hpPercent, 16);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(1.5, 0.2, 1);
      sprite.position.copy(enemy.mesh.position);
      sprite.position.y += (enemy.type === 'rock_golem' ? 2.5 : enemy.type === 'green_slime' ? 1.4 : 2.8);
      
      scene.add(sprite);
      enemy.mesh.userData.healthBarSprite = sprite;
      enemy.mesh.userData.healthBarTexture = texture;
      enemy.mesh.userData.healthBarCanvas = canvas;
      enemy.mesh.userData.healthBarCtx = ctx;
    };

    // Helper to handle enemy defeat (coins, slimes splitting, resources)
    const handleEnemyDefeat = (enemy: LocalEnemy, isPlayerProjectile: boolean) => {
      enemy.isDead = true;
      enemy.respawnTimer = 0;
      enemy.mesh.visible = false;

      if (isPlayerProjectile) {
        const activeWep = progressRef.current.equipment?.mainHand?.subType;
        let wepType: 'sword' | 'ranged' | 'grimoire' | 'fists' = 'fists';
        if (activeWep === 'weapon_1h' || activeWep === 'weapon_2h' || activeWep === 'weapon') {
          wepType = 'sword';
        } else if (activeWep === 'ranged') {
          wepType = 'ranged';
        } else if (activeWep === 'grimoire') {
          wepType = 'grimoire';
        }
        addWeaponMasteryExp(wepType, 100);
      }
      
      let expGained = 15;
      let goldGained = 8;
      let resourceType: 'wood' | 'stone' | 'metal' | 'essence' = 'wood';
      let resourceRarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common';
      let resourceCount = 1;

      if (enemy.type === 'green_slime') {
        expGained = 18;
        goldGained = 10;
        resourceType = Math.random() > 0.5 ? 'wood' : 'essence';
        resourceRarity = Math.random() > 0.8 ? 'rare' : 'common';
        resourceCount = Math.floor(Math.random() * 2) + 1;
      } else if (enemy.type === 'rock_golem') {
        expGained = 35;
        goldGained = 25;
        resourceType = 'stone';
        resourceRarity = Math.random() > 0.7 ? 'epic' : 'rare';
        resourceCount = Math.floor(Math.random() * 2) + 1;
      } else if (enemy.type === 'abyss_demon') {
        expGained = 75;
        goldGained = 60;
        resourceType = 'metal';
        resourceRarity = Math.random() > 0.6 ? 'epic' : 'legendary';
        resourceCount = Math.floor(Math.random() * 2) + 1;
      }

      // 1. Drop physical 3D gold coins
      const coinsCount = Math.max(1, Math.floor(goldGained / 4));
      for (let c = 0; c < coinsCount; c++) {
        const coinGeo = new THREE.TorusGeometry(0.12, 0.04, 8, 16);
        const coinMat = new THREE.MeshStandardMaterial({
          color: 0xffd700,
          emissive: 0xd97706,
          metalness: 0.9,
          roughness: 0.1
        });
        const coinMesh = new THREE.Mesh(coinGeo, coinMat);
        coinMesh.position.set(
          enemy.mesh.position.x + (Math.random() - 0.5) * 1.5,
          0.3,
          enemy.mesh.position.z + (Math.random() - 0.5) * 1.5
        );
        coinMesh.rotation.x = Math.PI / 2;
        scene.add(coinMesh);
        activeCoins.push({
          mesh: coinMesh,
          value: Math.floor(goldGained / coinsCount)
        });
      }

      // 2. Slime splitting mechanic (Map 1)
      if (enemy.type === 'green_slime' && !enemy.id.includes('_mini')) {
        for (let s = 1; s <= 2; s++) {
          const miniId = `${enemy.id}_mini_${s}_${Date.now()}`;
          const miniConf = {
            id: miniId,
            name: 'Mini Slime Dividido',
            x: enemy.mesh.position.x + (s === 1 ? -1.0 : 1.0),
            z: enemy.mesh.position.z + (Math.random() - 0.5),
            hp: 25,
            maxHp: 25,
            damage: 3,
            speed: 3.0,
            type: 'green_slime' as const
          };

          const miniMesh = createDetailedEnemyMesh(miniConf.type);
          miniMesh.scale.set(0.35, 0.35, 0.35);
          miniMesh.position.set(miniConf.x, 0.3, miniConf.z);
          scene.add(miniMesh);

          const miniEnemy: LocalEnemy = {
            ...miniConf,
            mesh: miniMesh,
            spawnX: miniConf.x,
            spawnZ: miniConf.z,
            isDead: false,
            respawnTimer: -99999, // Mini slimes do not respawn
            lastAttackTime: timer,
            wanderAngle: Math.random() * Math.PI * 2,
            wanderTimer: 2.0,
            flashTimer: 0
          };
          
          activeEnemies.push(miniEnemy);
          createEnemyHealthBarSprite(miniEnemy);
        }
      }

      // Add resources
      setTempBag(tb => {
        const b = { ...tb };
        b[resourceType][resourceRarity] += resourceCount;
        return b;
      });

      onSaveProgressRef.current({
        ...progressRef.current,
        exp: progressRef.current.exp + expGained
      });

      triggerNotification(`⭐ ¡Derrotaste a ${enemy.name}! Recibes +${expGained} EXP y materiales.`);
    };

    // Special Skill Trigger Binding
    triggerSpecialSkillRef.current = () => {
      if (skillCooldownLeftRef.current > 0) return;

      const equippedWeapon = progressRef.current.equipment?.mainHand;
      const type = equippedWeapon?.subType; // weapon_1h, ranged, grimoire...

      setSkillCooldownLeft(8.0);
      skillCooldownLeftRef.current = 8.0;

      // Play special ability tone
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch (_) {}

      if (type === 'weapon_1h' || type === 'weapon_2h' || type === 'weapon') {
        // Sword Whirlwind
        const ringGeo = new THREE.RingGeometry(0.1, 5.0, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8
        });
        const spinRing = new THREE.Mesh(ringGeo, ringMat);
        spinRing.position.set(camera.position.x, 0.2, camera.position.z);
        scene.add(spinRing);

        const spinEffect = {
          mesh: spinRing,
          tick: 0,
          update() {
            this.tick += 1;
            this.mesh.scale.addScalar(0.1);
            if (this.mesh.material instanceof THREE.Material) {
              this.mesh.material.opacity = Math.max(0, 0.8 - this.tick * 0.05);
            }
            if (this.tick >= 16) {
              scene.remove(this.mesh);
              this.mesh.geometry.dispose();
              (this.mesh.material as THREE.Material).dispose();
              return true;
            }
            return false;
          }
        };
        customEffects.push(spinEffect);

        const masteryMult = getWeaponMasteryMultiplier(type);
        activeEnemies.forEach(enemy => {
          if (enemy.isDead) return;
          const dist = camera.position.distanceTo(enemy.mesh.position);
          if (dist <= 6.0) {
            const finalDmg = Math.round(50 * masteryMult);
            enemy.hp -= finalDmg;
            enemy.flashTimer = 0.3;
            enemy.mesh.scale.multiplyScalar(1.2);
            if (enemy.hp <= 0) {
              handleEnemyDefeat(enemy, true);
            }
          }
        });
        triggerNotification("⚔️ ¡Giro de Torbellino!");

      } else if (type === 'ranged') {
        // Rifle Spread
        const angles = [-0.25, 0, 0.25];
        const masteryMult = getWeaponMasteryMultiplier('ranged');
        angles.forEach(a => {
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);

          const pGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8);
          pGeo.rotateX(Math.PI / 2);
          const pMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
          const pMesh = new THREE.Mesh(pGeo, pMat);
          pMesh.position.set(camera.position.x, camera.position.y - 0.2, camera.position.z);
          pMesh.lookAt(pMesh.position.clone().add(dir));
          scene.add(pMesh);
          activeProjectiles.push({
            mesh: pMesh,
            vx: dir.x * 45.0,
            vy: dir.y * 45.0,
            vz: dir.z * 45.0,
            life: 80,
            isNitz: false,
            isSpecial: true,
            damage: Math.round(35 * masteryMult)
          });
        });
        triggerNotification("🔫 ¡Ráfaga de Plomo!");

      } else if (type === 'grimoire') {
        // Grimoire Exploding Nebula
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);

        const pGeo = new THREE.SphereGeometry(1.0, 16, 16);
        const pMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.9
        });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(camera.position.x, camera.position.y - 0.2, camera.position.z);
        scene.add(pMesh);

        const masteryMult = getWeaponMasteryMultiplier('grimoire');
        activeProjectiles.push({
          mesh: pMesh,
          vx: dir.x * 8.0,
          vy: dir.y * 8.0,
          vz: dir.z * 8.0,
          life: 90,
          isNitz: false,
          isNebulaPulse: true,
          isSpecial: true,
          damage: Math.round(50 * masteryMult)
        });
        triggerNotification("🔮 ¡Pulso de Nebulosa!");

      } else {
        // Fists Lunge
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        isDodgingRef.current = true;
        setTimeout(() => { isDodgingRef.current = false; }, 200);

        playerXRef.current += dir.x * 4.0;
        playerZRef.current += dir.z * 4.0;

        const masteryMult = getWeaponMasteryMultiplier('fists');
        activeEnemies.forEach(enemy => {
          if (enemy.isDead) return;
          const dist = camera.position.distanceTo(enemy.mesh.position);
          if (dist <= 4.0) {
            const finalDmg = Math.round(25 * masteryMult);
            enemy.hp -= finalDmg;
            enemy.flashTimer = 0.3;
            const knockDir = new THREE.Vector3().subVectors(enemy.mesh.position, camera.position).normalize();
            enemy.mesh.position.x += knockDir.x * 4.0;
            enemy.mesh.position.z += knockDir.z * 4.0;

            if (enemy.hp <= 0) {
              handleEnemyDefeat(enemy, true);
            }
          }
        });
        triggerNotification("👊 ¡Embestida de Fuerza!");
      }
    };

    // Spawn local NPC enemies depending on map
    let enemyConfigs: { id: string; name: string; x: number; z: number; hp: number; maxHp: number; damage: number; speed: number; type: 'green_slime' | 'rock_golem' | 'abyss_demon' }[] = [];
    
    if (currentMap === 'map1') {
      enemyConfigs = [
        { id: 'enemy_map1_1', name: 'Rogue Nitz Silvestre', x: -6, z: -2, hp: 50, maxHp: 50, damage: 6, speed: 2.2, type: 'green_slime' },
        { id: 'enemy_map1_2', name: 'Rogue Nitz Silvestre', x: 6, z: -5, hp: 50, maxHp: 50, damage: 6, speed: 2.2, type: 'green_slime' },
      ];
    } else if (currentMap === 'map2') {
      enemyConfigs = [
        { id: 'enemy_map2_1', name: 'Golem de Cristal Cantera', x: -7, z: 2, hp: 120, maxHp: 120, damage: 15, speed: 1.6, type: 'rock_golem' },
        { id: 'enemy_map2_2', name: 'Golem de Cristal Cantera', x: 7, z: -5, hp: 120, maxHp: 120, damage: 15, speed: 1.6, type: 'rock_golem' },
      ];
    } else if (currentMap === 'map3') {
      enemyConfigs = [
        { id: 'enemy_map3_1', name: 'Devorador Abisal de Sangre', x: -8, z: -8, hp: 220, maxHp: 220, damage: 28, speed: 2.5, type: 'abyss_demon' },
        { id: 'enemy_map3_2', name: 'Devorador Abisal de Sangre', x: 8, z: -5, hp: 220, maxHp: 220, damage: 28, speed: 2.5, type: 'abyss_demon' },
      ];
    }

    enemyConfigs.forEach(conf => {
      const mesh = createDetailedEnemyMesh(conf.type);
      mesh.position.set(conf.x, 0.4, conf.z);
      scene.add(mesh);

      activeEnemies.push({
        ...conf,
        mesh,
        spawnX: conf.x,
        spawnZ: conf.z,
        isDead: false,
        respawnTimer: 0,
        lastAttackTime: 0,
        wanderAngle: Math.random() * Math.PI * 2,
        wanderTimer: Math.random() * 2.0,
        flashTimer: 0
      });
    });

    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      const isLocked = document.pointerLockElement === renderer.domElement;
      
      if (!isLocked) {
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
      } else {
        // PLAYER ATTACK FIRE
        if (activeOverlayRef.current === 'none') {
          const activeWep = progressRef.current.equipment?.mainHand?.subType;
          
          // Enforce weapon-specific attack speeds/cooldowns
          const now = Date.now();
          let cooldown = 300;
          if (activeWep === 'weapon_1h' || activeWep === 'weapon_2h') cooldown = 500;
          else if (activeWep === 'ranged') cooldown = 220;
          else if (activeWep === 'grimoire') cooldown = 900;
          
          if (now - lastPlayerAttackTimeRef.current < cooldown) {
            return; // on cooldown
          }
          lastPlayerAttackTimeRef.current = now;

          // Sound effects tailored to each weapon type
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            if (activeWep === 'weapon_1h' || activeWep === 'weapon_2h') {
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(350, audioCtx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.12);
              gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            } else if (activeWep === 'ranged') {
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, audioCtx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.08);
              gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            } else if (activeWep === 'grimoire') {
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(120, audioCtx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
              gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
            } else {
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(250, audioCtx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.1);
              gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            }
            
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.22);
          } catch (_) {}

          // Spawn Player Projectile/Strike based on Equipped Weapon
          let pGeo: THREE.BufferGeometry;
          let pMat: THREE.MeshBasicMaterial;
          let speed = 15.0; // Base speed
          let life = 60; // Base life

          if (activeWep === 'weapon_1h' || activeWep === 'weapon_2h') {
            // Sweep wave
            pGeo = new THREE.BoxGeometry(1.6, 0.05, 0.3);
            pMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
            speed = 28.0;
            life = 9; // short range melee
          } else if (activeWep === 'ranged') {
            // Fast golden bullet
            pGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8);
            pGeo.rotateX(Math.PI / 2);
            pMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 }); // Gold bullet
            speed = 52.0; // very fast
            life = 75;
          } else if (activeWep === 'grimoire') {
            // Slow heavy magic orb
            pGeo = new THREE.SphereGeometry(0.55, 12, 12);
            pMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 }); // Purple plasma
            speed = 12.0; // slow moving orb
            life = 100;
          } else {
            // Concentric shockwave ring for fists/default
            pGeo = new THREE.TorusGeometry(0.3, 0.03, 8, 16);
            pGeo.rotateX(Math.PI / 2);
            pMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.8 }); // light blue ring
            speed = 18.0;
            life = 12; // very short range
          }

          const pMesh = new THREE.Mesh(pGeo, pMat);
          pMesh.position.set(camera.position.x, camera.position.y - 0.2, camera.position.z);
          scene.add(pMesh);

          // Direction from camera
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);

          // Rotate the meshes appropriately to face forward
          pMesh.lookAt(pMesh.position.clone().add(dir));

          const masteryMult = getWeaponMasteryMultiplier(activeWep);
          let baseDamage = 20;
          if (activeWep === 'weapon_1h' || activeWep === 'weapon_2h') baseDamage = 45;
          else if (activeWep === 'ranged') baseDamage = 25;
          else if (activeWep === 'grimoire') baseDamage = 60;

          const dmg = Math.round(baseDamage * masteryMult);

          activeProjectiles.push({
            mesh: pMesh,
            vx: dir.x * speed,
            vy: dir.y * speed,
            vz: dir.z * speed,
            life: life,
            isNitz: false,
            damage: dmg,
            isGrimoireSplash: activeWep === 'grimoire'
          });
        }
      }

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
        } else if (m.name === 'orit_mentor_mesh') {
          // Orit levitation + slow spin
          m.position.y = 1.2 + Math.sin(timer * 1.4) * 0.18;
          m.rotation.y += 0.008;
          // Animate Orit's aura pulsing
          const ud = m.userData;
          if (ud && ud.aura) {
            const pulse = 1.05 + Math.sin(timer * 3.5) * 0.08;
            ud.aura.scale.set(pulse, pulse, pulse);
          }
          if (ud && ud.crown && ud.crown.visible) {
            ud.crown.position.y = 1.5 + Math.sin(timer * 2.0) * 0.06;
            ud.crown.rotation.y = timer * 1.2;
          }
        } else if (m.userData && m.userData.vortex) {
          m.userData.vortex.rotation.z += 0.02;
        } else if (m.userData && m.userData.floatingCrystal) {
          m.userData.floatingCrystal.position.y = 1.8 + Math.sin(timer * 3.0) * 0.15;
          m.userData.floatingCrystal.rotation.y += 0.035;
          m.userData.floatingCrystal.rotation.x += 0.01;
        } else if (m.userData && m.userData.flame) {
          m.userData.flame.position.y = 1.4 + Math.sin(timer * 4.0) * 0.08;
          const s = 1.0 + Math.sin(timer * 10.0) * 0.15;
          m.userData.flame.scale.set(s, s, s);
        } else if (m.name === 'road_to_lobby' || m.name.startsWith('gate_') || m.name === 'portal_arena' || m.name === 'map3_exit' || m.name === 'map2_exit' || m.name === 'map1_exit') {
          m.rotation.z += 0.01;
        }
      });

      // Update Projectiles and check Hitboxes
      for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const p = activeProjectiles[i];
        p.mesh.position.x += p.vx * 0.04;
        p.mesh.position.y += p.vy * 0.04;
        p.mesh.position.z += p.vz * 0.04;
        p.life -= 1;

        // Simple Hitbox vs activeMeshes (Trees, Ores, Enemies)
        let hit = false;
        activeMeshes.forEach(nodeMesh => {
          if (hit) return;
          const dist = p.mesh.position.distanceTo(nodeMesh.position);
          if (dist < 1.5 && (nodeMesh.name.startsWith('tr_') || nodeMesh.name.startsWith('or_') || nodeMesh.name === 'plot_luz')) {
            // HIT DETECTED!
            hit = true;
            
            // Visual impact effect
            nodeMesh.scale.set(1.2, 1.2, 1.2);
            setTimeout(() => {
              if (nodeMesh) nodeMesh.scale.set(1, 1, 1);
            }, 100);

            // Trigger interaction via DOM event fallback to avoid breaking React scope closures
            if (!p.isNitz) {
              setNearNode({ id: nodeMesh.name } as any); // Force selection
              setTimeout(() => {
                handleInteractNearNodeRef.current(); // Mine/Hit
              }, 50);
            }
          }
        });

        // Hitbox vs local active NPC enemies
        if (!hit) {
          for (let j = 0; j < activeEnemies.length; j++) {
            const enemy = activeEnemies[j];
            if (enemy.isDead) continue;
            
            const dist = p.mesh.position.distanceTo(enemy.mesh.position);
            if (dist < 1.6) {
              hit = true;
              
              // Visual impact scale
              enemy.mesh.scale.multiplyScalar(1.25);
              setTimeout(() => {
                if (enemy.mesh) {
                  const baseScale = enemy.type === 'rock_golem' ? 0.8 : enemy.type === 'green_slime' ? 0.7 : 1.0;
                  enemy.mesh.scale.setScalar(baseScale);
                }
              }, 100);

              // Deal damage
              const isPlayerProjectile = !p.isNitz;
              let damageDealt = isPlayerProjectile ? 35 : (15 + progressRef.current.phase * 4);
              if (isPlayerProjectile && p.damage !== undefined) {
                damageDealt = p.damage;
              }
              enemy.hp -= damageDealt;

              if (p.isGrimoireSplash) {
                // Trigger splash damage to nearby enemies
                activeEnemies.forEach(otherEnemy => {
                  if (otherEnemy.id === enemy.id || otherEnemy.isDead) return;
                  const splashDist = otherEnemy.mesh.position.distanceTo(p.mesh.position);
                  if (splashDist < 3.0) {
                    otherEnemy.hp -= damageDealt;
                    otherEnemy.flashTimer = 0.3;
                    
                    otherEnemy.mesh.traverse(child => {
                      if (child instanceof THREE.Mesh && child.material) {
                        if (Array.isArray(child.material)) {
                          child.material.forEach(m => {
                            if ((m as any).emissive) (m as any).emissive.setHex(0xff0000);
                          });
                        } else {
                          if ((child.material as any).emissive) {
                            (child.material as any).emissive.setHex(0xff0000);
                          }
                        }
                      }
                    });

                    if (otherEnemy.hp <= 0) {
                      handleEnemyDefeat(otherEnemy, true);
                    }
                  }
                });

                // Spawn a visual explosion sphere that expands and fades
                const expGeo = new THREE.SphereGeometry(1.5, 16, 16);
                const expMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.7 });
                const expMesh = new THREE.Mesh(expGeo, expMat);
                expMesh.position.copy(p.mesh.position);
                scene.add(expMesh);
                
                let expScale = 0.1;
                const animateExp = () => {
                  expScale += 0.15;
                  expMesh.scale.setScalar(expScale);
                  expMat.opacity -= 0.05;
                  if (expMat.opacity > 0) {
                    requestAnimationFrame(animateExp);
                  } else {
                    scene.remove(expMesh);
                    expGeo.dispose();
                    expMat.dispose();
                  }
                };
                animateExp();
              }

              if (isPlayerProjectile) {
                const activeWep = progressRef.current.equipment?.mainHand?.subType;
                let wepType: 'sword' | 'ranged' | 'grimoire' | 'fists' = 'fists';
                if (activeWep === 'weapon_1h' || activeWep === 'weapon_2h' || activeWep === 'weapon') {
                  wepType = 'sword';
                } else if (activeWep === 'ranged') {
                  wepType = 'ranged';
                } else if (activeWep === 'grimoire') {
                  wepType = 'grimoire';
                }
                addWeaponMasteryExp(wepType, 15);
              }
              
              // Flash enemy red
              enemy.flashTimer = 0.3;
              enemy.mesh.traverse(child => {
                if (child instanceof THREE.Mesh && child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach(m => {
                      if ((m as any).emissive) (m as any).emissive.setHex(0xff0000);
                    });
                  } else {
                    if ((child.material as any).emissive) {
                      (child.material as any).emissive.setHex(0xff0000);
                    }
                  }
                }
              });
              
              // Hit sound
              try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(300, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.12);
              } catch (_) {}
              
              // Defeated check
              if (enemy.hp <= 0) {
                handleEnemyDefeat(enemy, isPlayerProjectile);
              }
              break;
            }
          }
        }

        // PvP Hitbox vs online peers (Only in Red Zone Map 3 and if pvpEnabled)
        if (!hit && currentMap === 'map3' && progressRef.current.pvpEnabled) {
          peerMeshes.forEach(pm => {
            if (hit) return;
            const dist = p.mesh.position.distanceTo(pm.mesh.position);
            // Hitting an enemy player!
            if (dist < 1.8) {
              hit = true;
              
              // Visual impact effect
              pm.mesh.scale.set(1.4, 1.4, 1.4);
              setTimeout(() => {
                if (pm.mesh) pm.mesh.scale.set(1, 1, 1);
              }, 120);

              // Only deal damage if WE fired the projectile (we own it locally)
              if (auth.currentUser) {
                // Determine damage
                const dmg = p.isNitz ? 15 + (progressRef.current.phase * 5) : (p.damage || 40);
                
                // Dispatch async damage to Firebase
                const enemyRef = doc(db, 'users', pm.id);
                updateDoc(enemyRef, {
                  hp: increment(-dmg)
                }).catch(err => console.error("Error applying PvP damage:", err));

                if (p.isGrimoireSplash) {
                  // Splash other PvP players nearby
                  peerMeshes.forEach(otherPm => {
                    if (otherPm.id === pm.id) return;
                    const splashDist = otherPm.mesh.position.distanceTo(p.mesh.position);
                    if (splashDist < 3.0) {
                      const otherEnemyRef = doc(db, 'users', otherPm.id);
                      updateDoc(otherEnemyRef, {
                        hp: increment(-dmg)
                      }).catch(err => {});
                    }
                  });
                }
              }
            }
          });
        }

        if (hit || p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          (p.mesh.material as THREE.Material).dispose();
          activeProjectiles.splice(i, 1);
        }
      }

      // Update local active enemies (AI tick)
      activeEnemies.forEach(enemy => {
        if (enemy.isDead) {
          enemy.respawnTimer += 0.016;
          if (enemy.respawnTimer > 8.0) {
            enemy.isDead = false;
            enemy.hp = enemy.maxHp;
            enemy.mesh.position.set(enemy.spawnX, 0.4, enemy.spawnZ);
            enemy.mesh.visible = true;
            
            // Recover scale
            const baseScale = enemy.type === 'rock_golem' ? 0.8 : enemy.type === 'green_slime' ? 0.7 : 1.0;
            enemy.mesh.scale.setScalar(baseScale);
          }
          return;
        }

        // Flash timer tick
        if (enemy.flashTimer > 0) {
          enemy.flashTimer -= 0.016;
          if (enemy.flashTimer <= 0) {
            enemy.mesh.traverse(child => {
              if (child instanceof THREE.Mesh && child.material) {
                let defaultEmissive = 0x000000;
                if (enemy.type === 'green_slime') defaultEmissive = 0x064e3b;
                if (Array.isArray(child.material)) {
                  child.material.forEach(m => {
                    if ((m as any).emissive) (m as any).emissive.setHex(defaultEmissive);
                  });
                } else {
                  if ((child.material as any).emissive) {
                    (child.material as any).emissive.setHex(defaultEmissive);
                  }
                }
              }
            });
          }
        }

        // Distance from enemy to player
        const dx = playerXRef.current - enemy.mesh.position.x;
        const dz = playerZRef.current - enemy.mesh.position.z;
        const distToPlayer = Math.sqrt(dx * dx + dz * dz);

        if (distToPlayer < 9.0) {
          // Chase player
          const angle = Math.atan2(dx, dz);
          enemy.mesh.position.x += Math.sin(angle) * enemy.speed * 0.016;
          enemy.mesh.position.z += Math.cos(angle) * enemy.speed * 0.016;
          enemy.mesh.rotation.y = angle;

          // Attack player
          if (distToPlayer < 1.7 && timer - enemy.lastAttackTime > 2.0) {
            enemy.lastAttackTime = timer;
            
            const nextHp = Math.max(0, progressRef.current.hp - enemy.damage);
            onSaveProgressRef.current({
              ...progressRef.current,
              hp: nextHp
            });
            if (auth.currentUser) {
              updateDoc(doc(db, 'users', auth.currentUser.uid), { hp: nextHp }).catch(err => console.error("Error applying NPC damage:", err));
            }
            triggerNotification(`💥 ¡El ${enemy.name} te ha atacado! Recibiste ${enemy.damage} de daño.`);

            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(150, audioCtx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);
              gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.25);
            } catch (_) {}
          }
        } else {
          // Wander around spawn point
          enemy.wanderTimer -= 0.016;
          if (enemy.wanderTimer <= 0) {
            enemy.wanderTimer = 1.5 + Math.random() * 2.0;
            const distFromSpawnX = enemy.mesh.position.x - enemy.spawnX;
            const distFromSpawnZ = enemy.mesh.position.z - enemy.spawnZ;
            const distFromSpawn = Math.sqrt(distFromSpawnX * distFromSpawnX + distFromSpawnZ * distFromSpawnZ);
            
            if (distFromSpawn > 5.0) {
              enemy.wanderAngle = Math.atan2(-distFromSpawnX, -distFromSpawnZ);
            } else {
              enemy.wanderAngle = Math.random() * Math.PI * 2;
            }
          }

          enemy.mesh.position.x += Math.sin(enemy.wanderAngle) * enemy.speed * 0.4 * 0.016;
          enemy.mesh.position.z += Math.cos(enemy.wanderAngle) * enemy.speed * 0.4 * 0.016;
          enemy.mesh.rotation.y = enemy.wanderAngle;
        }

        // Bobbing animation
        enemy.mesh.position.y = 0.4 + Math.sin(timer * 3) * 0.12;

        // Custom model animations
        if (enemy.type === 'rock_golem' && enemy.mesh.userData.leftArm && enemy.mesh.userData.rightArm) {
          enemy.mesh.userData.leftArm.rotation.z = Math.sin(timer * 2.5) * 0.3;
          enemy.mesh.userData.rightArm.rotation.z = -Math.sin(timer * 2.5) * 0.3;
        } else if (enemy.type === 'abyss_demon' && enemy.mesh.userData.ring) {
          enemy.mesh.userData.ring.rotation.z = timer * 1.5;
        }
      });

      // Nitz Auto-cast Logic
      if (companionMeshRef.current && (currentMap === 'map1' || currentMap === 'map2' || currentMap === 'map3')) {
        if (timer - lastNitzAttack > 3.0) { // Every 3 seconds
          lastNitzAttack = timer;
          
          const pGeo = new THREE.SphereGeometry(0.3, 12, 12);
          const pMat = new THREE.MeshBasicMaterial({ color: currentDominant.colorHex });
          const pMesh = new THREE.Mesh(pGeo, pMat);
          
          pMesh.position.copy(companionMeshRef.current.position);
          pMesh.position.y += 0.5; // from head
          scene.add(pMesh);

          // Aim at crosshair by default
          const dir = new THREE.Vector3();
          camera.getWorldDirection(dir);
          const speed = 12.0;

          // Target search logic (online players or local enemies)
          let nearestDist = Infinity;
          let targetPosition: THREE.Vector3 | null = null;

          if (currentMap === 'map3' && progressRef.current.pvpEnabled && peerMeshes.length > 0) {
            peerMeshes.forEach(pm => {
              const d = pMesh.position.distanceTo(pm.mesh.position);
              if (d < 15.0 && d < nearestDist) {
                nearestDist = d;
                targetPosition = pm.mesh.position;
              }
            });
          }

          if (!targetPosition && activeEnemies.length > 0) {
            activeEnemies.forEach(enemy => {
              if (enemy.isDead) return;
              const d = pMesh.position.distanceTo(enemy.mesh.position);
              if (d < 15.0 && d < nearestDist) {
                nearestDist = d;
                targetPosition = enemy.mesh.position;
              }
            });
          }

          if (targetPosition) {
            dir.subVectors(targetPosition, pMesh.position).normalize();
          }

          activeProjectiles.push({
            mesh: pMesh,
            vx: dir.x * speed,
            vy: dir.y * speed,
            vz: dir.z * speed,
            life: 80,
            isNitz: true
          });
        }
      }

      // Animate cabin companion Nitz if we are in Cabin
      if (currentMap === 'cabin') {
        const cabinNitz = activeMeshes.find(m => m.name === 'companion_nitz');
        if (cabinNitz) {
          const ud = cabinNitz.userData;
          if (ud && ud.body) {
            const breath = 1.0 + Math.sin(timer * 1.2) * 0.03;
            ud.body.scale.set(breath, 1.0 / breath, breath);
            if (ud.leftEar && ud.rightEar && ud.phase >= 2) {
              ud.leftEar.rotation.z = -0.4 + Math.sin(timer * 2) * 0.05;
              ud.rightEar.rotation.z = 0.4 - Math.sin(timer * 2) * 0.05;
            }
            if (ud.tail) {
              let segment = ud.tail.children[0];
              let depth = 0;
              while (segment && depth < 6) {
                segment.rotation.z = Math.sin(timer * 3 - depth * 0.5) * 0.15;
                const nextJoint = segment.parent?.children.find((c: any) => c !== segment);
                segment = nextJoint ? nextJoint.children[0] : null;
                depth++;
              }
            }
          }
        }
      }

      // Animate summoned companion follow behavior
      if (companionMesh) {
        let targetX = cameraRef.current ? cameraRef.current.position.x - Math.sin(cameraAngle) * 1.5 + Math.cos(cameraAngle) * 1.1 : playerX - Math.sin(cameraAngle) * 1.5 + Math.cos(cameraAngle) * 1.1;
        let targetZ = cameraRef.current ? cameraRef.current.position.z + Math.cos(cameraAngle) * 1.5 + Math.sin(cameraAngle) * 1.1 : playerZ + Math.cos(cameraAngle) * 1.5 + Math.sin(cameraAngle) * 1.1;
        
        const diffX = targetX - companionMesh.position.x;
        const diffZ = targetZ - companionMesh.position.z;
        const distance = Math.sqrt(diffX * diffX + diffZ * diffZ);
        const isMoving = distance > 0.3;

        let targetY = 1.35 + Math.sin(timer * (isMoving ? 8.0 : 2.5)) * (isMoving ? 0.25 : 0.1);

        if (strikeNodeRef.current) {
          targetX = strikeNodeRef.current.x;
          targetZ = strikeNodeRef.current.z;
          targetY = 1.0;
        }

        companionMesh.position.x += (targetX - companionMesh.position.x) * 0.08;
        companionMesh.position.z += (targetZ - companionMesh.position.z) * 0.08;
        companionMesh.position.y += (targetY - companionMesh.position.y) * 0.08;

        if (distance > 0.1) {
          const moveAngle = Math.atan2(diffX, diffZ);
          let diffRot = moveAngle - companionMesh.rotation.y;
          diffRot = Math.atan2(Math.sin(diffRot), Math.cos(diffRot));
          companionMesh.rotation.y += diffRot * 0.1;
        } else {
          // Look at player/camera
          const lookAtX = cameraRef.current ? cameraRef.current.position.x : playerX;
          const lookAtZ = cameraRef.current ? cameraRef.current.position.z : playerZ;
          const playerAngle = Math.atan2(lookAtX - companionMesh.position.x, lookAtZ - companionMesh.position.z);
          let diffRot = playerAngle - companionMesh.rotation.y;
          diffRot = Math.atan2(Math.sin(diffRot), Math.cos(diffRot));
          companionMesh.rotation.y += diffRot * 0.05;
        }

        // Detailed animation from userData
        const ud = companionMesh.userData;
        if (ud && ud.body) {
          // 1. Ear wiggles based on emotion intensity
          if (ud.leftEar && ud.rightEar && ud.phase >= 2) {
            ud.leftEar.rotation.z = -0.4 + Math.sin(timer * 4) * 0.08;
            ud.rightEar.rotation.z = 0.4 - Math.sin(timer * 4) * 0.08;
          }
          // 2. Elegant crown float
          if (ud.crown && ud.crown.visible) {
            ud.crown.position.y = 1.5 + Math.sin(timer * 1.5) * 0.08;
            ud.crown.rotation.y = timer * 0.8;
          }
          // 3. Body breathing
          const breath = 1.0 + Math.sin(timer * 1.5) * 0.04;
          ud.body.scale.set(breath, 1.0 / breath, breath);
          // 4. Aura pulsing
          if (ud.aura) {
            const pulse = 1.05 + Math.sin(timer * 4) * 0.06;
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
              const waveAngle = Math.sin(timer * speedMultiplier - depth * 0.5) * amplitude;
              segment.rotation.z = waveAngle;
              segment.rotation.y = Math.cos(timer * 1.5 + depth * 0.3) * 0.05;
              
              const nextJoint = segment.parent?.children.find((c: any) => c !== segment);
              segment = nextJoint ? nextJoint.children[0] : null;
              depth++;
            }
          }
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
          // Render peer as a gorgeous stylized humanoid avatar
          const mesh = createDetailedPlayerAvatar(
            peer.avatar || {
              name: peer.activeNitzName || 'Nitz de Origen',
              accessory: 'none',
              auraType: 'none',
              colorTheme: 'classic',
              clothing: 'none'
            },
            peer.dominantEmotion,
            peer.phase || 1
          );
          mesh.position.set(peer.posX || 0, 0.75, peer.posZ || 0);
          scene.add(mesh);

          // Render peer's companion Nitz if companionSummoned is true
          let peerNitzMesh: THREE.Group | THREE.Mesh | null = null;
          if (peer.companionSummoned) {
            peerNitzMesh = createDetailedNitzMesh(
              peer.avatar || {
                name: peer.activeNitzName || 'Nitz de Origen',
                accessory: 'none',
                auraType: 'none',
                colorTheme: (peer.activeNitzName === 'Nitz Ígneo' ? 'primeval' : peer.activeNitzName === 'Nitz Abisal' ? 'abyssal' : 'classic'),
                clothing: 'none'
              },
              peer.dominantEmotion,
              peer.phase || 1,
              0.25
            );
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
              pm.companionMesh = createDetailedNitzMesh(
                peer.avatar || {
                  name: peer.activeNitzName || 'Nitz de Origen',
                  accessory: 'none',
                  auraType: 'none',
                  colorTheme: (peer.activeNitzName === 'Nitz Ígneo' ? 'primeval' : peer.activeNitzName === 'Nitz Abisal' ? 'abyssal' : 'classic'),
                  clothing: 'none'
                },
                peer.dominantEmotion,
                peer.phase || 1,
                0.25
              );
              pm.companionMesh.position.copy(pm.mesh.position).add(new THREE.Vector3(0.8, 0.25, -0.8));
              scene.add(pm.companionMesh);
            }
            pm.companionSummoned = peer.companionSummoned;
            pm.activeNitzName = peer.activeNitzName;
          }
        }

        // Smoothly interpolate (lerp) peer mesh position
        const targetX = peer.posX || 0;
        const targetZ = peer.posZ || 0;
        const prevX = pm.mesh.position.x;
        const prevZ = pm.mesh.position.z;
        pm.mesh.position.x += (targetX - pm.mesh.position.x) * 0.15;
        pm.mesh.position.z += (targetZ - pm.mesh.position.z) * 0.15;
        
        // Float peer vertically (legs standing on ground level)
        pm.mesh.position.y = 0.75 + Math.sin(timer * 2.1 + pm.mesh.position.x) * 0.05;
        
        // swing arms/legs if moving
        const distMoved = Math.sqrt((pm.mesh.position.x - prevX) ** 2 + (pm.mesh.position.z - prevZ) ** 2);
        const isMoving = distMoved > 0.008;
        const leftArm = pm.mesh.getObjectByName('leftArm');
        const rightArm = pm.mesh.getObjectByName('rightArm');
        const leftLeg = pm.mesh.getObjectByName('leftLeg');
        const rightLeg = pm.mesh.getObjectByName('rightLeg');

        if (isMoving) {
          const swing = Math.sin(timer * 8);
          if (leftArm) leftArm.rotation.x = swing * 0.6;
          if (rightArm) rightArm.rotation.x = -swing * 0.6;
          if (leftLeg) leftLeg.rotation.x = -swing * 0.5;
          if (rightLeg) rightLeg.rotation.x = swing * 0.5;
          
          // Face moving direction
          const deltaX = targetX - prevX;
          const deltaZ = targetZ - prevZ;
          if (Math.abs(deltaX) > 0.005 || Math.abs(deltaZ) > 0.005) {
            pm.mesh.rotation.y = Math.atan2(deltaX, deltaZ);
          }
        } else {
          if (leftArm) leftArm.rotation.x = 0;
          if (rightArm) rightArm.rotation.x = 0;
          if (leftLeg) leftLeg.rotation.x = 0;
          if (rightLeg) rightLeg.rotation.x = 0;
          
          // Apply facing angle if idle
          if (peer.facingAngle !== undefined) {
            pm.mesh.rotation.y = peer.facingAngle;
          } else {
            pm.mesh.rotation.y += 0.02;
          }
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

          // Detailed animations for peer companion
          const ud = pm.companionMesh.userData;
          if (ud && ud.body) {
            if (ud.leftEar && ud.rightEar && ud.phase >= 2) {
              ud.leftEar.rotation.z = -0.4 + Math.sin(timer * 4) * 0.08;
              ud.rightEar.rotation.z = 0.4 - Math.sin(timer * 4) * 0.08;
            }
            if (ud.crown && ud.crown.visible) {
              ud.crown.position.y = 1.5 + Math.sin(timer * 1.5) * 0.08;
              ud.crown.rotation.y = timer * 0.8;
            }
            const breath = 1.0 + Math.sin(timer * 1.5) * 0.04;
            ud.body.scale.set(breath, 1.0 / breath, breath);
            if (ud.aura) {
              const pulse = 1.05 + Math.sin(timer * 4) * 0.06;
              ud.aura.scale.set(pulse, pulse, pulse);
            }
            if (ud.tail) {
              let segment = ud.tail.children[0];
              let depth = 0;
              while (segment && depth < 6) {
                segment.rotation.z = Math.sin(timer * 6 - depth * 0.5) * 0.25;
                const nextJoint = segment.parent?.children.find((c: any) => c !== segment);
                segment = nextJoint ? nextJoint.children[0] : null;
                depth++;
              }
            }
          }
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

      // 1. Update active coins (magnet auto-pickup)
      for (let i = activeCoins.length - 1; i >= 0; i--) {
        const coin = activeCoins[i];
        coin.mesh.rotation.y += 0.05;
        
        const distToPlayer = camera.position.distanceTo(coin.mesh.position);
        if (distToPlayer < 5.0) {
          const pullDir = new THREE.Vector3().subVectors(camera.position, coin.mesh.position).normalize();
          const pullSpeed = 0.25 + (1.0 - (distToPlayer / 5.0)) * 0.4;
          coin.mesh.position.addScaledVector(pullDir, pullSpeed);

          if (distToPlayer < 1.0) {
            scene.remove(coin.mesh);
            coin.mesh.geometry.dispose();
            (coin.mesh.material as THREE.Material).dispose();

            onSaveProgressRef.current({
              ...progressRef.current,
              gold: progressRef.current.gold + coin.value
            });
            triggerNotification(`🪙 Recogiste +${coin.value} de Oro.`);

            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(987.77, audioCtx.currentTime);
              osc.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.08);
              gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.3);
            } catch (_) {}

            activeCoins.splice(i, 1);
          }
        }
      }

      // Cooldowns countdown decrements
      if (dashCooldownLeftRef.current > 0) {
        dashCooldownLeftRef.current = Math.max(0, dashCooldownLeftRef.current - 0.04);
        setDashCooldownLeft(dashCooldownLeftRef.current);
      }
      if (skillCooldownLeftRef.current > 0) {
        skillCooldownLeftRef.current = Math.max(0, skillCooldownLeftRef.current - 0.04);
        setSkillCooldownLeft(skillCooldownLeftRef.current);
      }

      // 2. Update custom visual effects
      for (let i = customEffects.length - 1; i >= 0; i--) {
        if (customEffects[i].update()) {
          customEffects.splice(i, 1);
        }
      }

      // 3. Update local enemies health bars positions and redraw values
      activeEnemies.forEach(enemy => {
        if (enemy.isDead) {
          if (enemy.mesh.userData.healthBarSprite) {
            enemy.mesh.userData.healthBarSprite.visible = false;
          }
          return;
        }

        let sprite = enemy.mesh.userData.healthBarSprite;
        if (!sprite) {
          createEnemyHealthBarSprite(enemy);
          sprite = enemy.mesh.userData.healthBarSprite;
        }

        if (sprite) {
          sprite.visible = true;
          sprite.position.copy(enemy.mesh.position);
          sprite.position.y += (enemy.type === 'rock_golem' ? 2.5 : enemy.type === 'green_slime' ? 1.4 : 2.8);

          const canvas = enemy.mesh.userData.healthBarCanvas;
          const ctx = enemy.mesh.userData.healthBarCtx;
          const texture = enemy.mesh.userData.healthBarTexture;
          if (canvas && ctx && texture) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(0, 0, 128, 16);

            const pct = Math.max(0, enemy.hp / enemy.maxHp);
            ctx.fillStyle = pct > 0.5 ? '#10b981' : pct > 0.2 ? '#f59e0b' : '#ef4444';
            ctx.fillRect(2, 2, 124 * pct, 12);

            texture.needsUpdate = true;
          }
        }
      });

      // 4. Clean up dead mini-slimes from activeEnemies
      for (let i = activeEnemies.length - 1; i >= 0; i--) {
        const enemy = activeEnemies[i];
        if (enemy.isDead && enemy.respawnTimer === -99999) {
          scene.remove(enemy.mesh);
          if (enemy.mesh.userData.healthBarSprite) {
            scene.remove(enemy.mesh.userData.healthBarSprite);
          }
          activeEnemies.splice(i, 1);
        } else if (!enemy.isDead && enemy.id.includes('_mini')) {
          if (enemy.dissolveTimer === undefined) {
            enemy.dissolveTimer = 15.0;
          }
          enemy.dissolveTimer -= 0.04;
          if (enemy.dissolveTimer <= 0) {
            enemy.isDead = true;
            enemy.respawnTimer = -99999;
          }
        }
      }

      // --- SPATIAL VOICE CHAT SIMULATION TICK ---
      try {
        const audioCtx = getVoiceAudioCtx();
        const currentPeers = onlinePlayersRef.current.filter(p => p.currentMap === currentMap);
        
        // Remove voice oscillators for peers that are no longer here or not speaking
        peerVoiceOscillatorsRef.current.forEach((vo, peerId) => {
          const peer = currentPeers.find(p => p.id === peerId);
          if (!peer || !peer.isSpeaking) {
            try {
              vo.osc.stop();
              vo.osc.disconnect();
            } catch (_) {}
            peerVoiceOscillatorsRef.current.delete(peerId);
          }
        });

        // Add or update voice oscillators for speaking peers
        currentPeers.forEach(peer => {
          if (!peer.isSpeaking) return;
          const pm = peerMeshes.find(p => p.id === peer.id);
          if (!pm) return;

          const dist = camera.position.distanceTo(pm.mesh.position);
          const maxDist = 20;

          if (dist < maxDist) {
            let vo = peerVoiceOscillatorsRef.current.get(peer.id);
            if (!vo) {
              const osc = audioCtx.createOscillator();
              const panner = audioCtx.createStereoPanner();
              const gain = audioCtx.createGain();

              osc.type = 'triangle';
              osc.frequency.setValueAtTime(140 + Math.random() * 80, audioCtx.currentTime);

              const lfo = audioCtx.createOscillator();
              lfo.frequency.setValueAtTime(4 + Math.random() * 2, audioCtx.currentTime);
              const lfoGain = audioCtx.createGain();
              lfoGain.gain.setValueAtTime(0.04, audioCtx.currentTime);

              lfo.connect(lfoGain);
              lfoGain.connect(gain.gain);
              lfo.start();

              osc.connect(panner);
              panner.connect(gain);
              gain.connect(audioCtx.destination);

              osc.start();
              vo = { osc, panner, gain };
              peerVoiceOscillatorsRef.current.set(peer.id, vo);
            }

            // Update Panning
            const toPeer = new THREE.Vector3().subVectors(pm.mesh.position, camera.position).normalize();
            const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
            const panVal = Math.max(-1, Math.min(1, toPeer.dot(cameraRight)));
            vo.panner.pan.setValueAtTime(panVal, audioCtx.currentTime);

            // Update Volume/Gain (Linear distance attenuation)
            const volume = Math.max(0, 1 - (dist / maxDist));
            vo.gain.gain.setValueAtTime(volume * 0.12, audioCtx.currentTime);
          } else {
            const vo = peerVoiceOscillatorsRef.current.get(peer.id);
            if (vo) {
              try {
                vo.osc.stop();
                vo.osc.disconnect();
              } catch (_) {}
              peerVoiceOscillatorsRef.current.delete(peer.id);
            }
          }
        });
      } catch (_) {}

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
      // Stop and clean up all spatial voice chat oscillators
      peerVoiceOscillatorsRef.current.forEach(vo => {
        try {
          vo.osc.stop();
          vo.osc.disconnect();
        } catch (_) {}
      });
      peerVoiceOscillatorsRef.current.clear();

      activeMeshesRef.current = [];
      cancelAnimationFrame(animId);
      ob.disconnect();
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('touchstart', handleTouchStart);
      dom.removeEventListener('touchmove', handleTouchMove);
      dom.removeEventListener('touchend', handleTouchEnd);
      
      activeCoins.forEach(c => {
        scene.remove(c.mesh);
        c.mesh.geometry.dispose();
        (c.mesh.material as THREE.Material).dispose();
      });

      customEffects.forEach(e => {
        scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        (e.mesh.material as THREE.Material).dispose();
      });

      activeEnemies.forEach(e => {
        if (e.mesh.userData.healthBarSprite) {
          scene.remove(e.mesh.userData.healthBarSprite);
        }
      });

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

      // Weight penalty calculation
      const tb = tempBagRef.current;
      const cw = (tb.wood.common + tb.wood.rare + tb.wood.epic + tb.wood.legendary) * 1 +
                 (tb.stone.common + tb.stone.rare + tb.stone.epic + tb.stone.legendary) * 2 +
                 (tb.metal.common + tb.metal.rare + tb.metal.epic + tb.metal.legendary) * 3;
      
      let weightMultiplier = 1.0;
      if (cw >= maxWeightRef.current) weightMultiplier = 0.4; // 60% speed reduction if full
      else if (cw > maxWeightRef.current * 0.8) weightMultiplier = 0.7; // 30% reduction if heavy

      // Speed metrics: 4.5 units per second base speed
      const baseSpeed = 4.5;
      const isRunning = keysRef.current['shift'];
      const runMultiplier = 1.8;
      const dodgeMultiplier = isDodgingRef.current ? 4.0 : 1.0;
      const moveSpeed = baseSpeed * (isRunning ? runMultiplier : 1.0) * dodgeMultiplier * weightMultiplier * dt;

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
      else if (currentMap === 'lobby' || currentMap === 'neighborhood') limitValue = 78;
      else if (currentMap === 'map1' || currentMap === 'map2' || currentMap === 'map3') limitValue = 88;

      let nextX = Math.max(-limitValue, Math.min(limitValue, curX + dx));
      let nextZ = Math.max(-limitValue, Math.min(limitValue, curZ + dz));

      // Solid collision check for decorative elements and interactables
      activeMeshesRef.current.forEach(mesh => {
        if (mesh.name && (mesh.name.startsWith('deco_') || mesh.name.startsWith('tr_') || mesh.name.startsWith('or_') || mesh.name.startsWith('workbench_') || mesh.name === 'stash')) {
          const dist = Math.sqrt(Math.pow(nextX - mesh.position.x, 2) + Math.pow(nextZ - mesh.position.z, 2));
          const collisionDist = mesh.name.startsWith('deco_') ? 1.0 : 1.5;
          if (dist < collisionDist) {
            const angle = Math.atan2(nextZ - mesh.position.z, nextX - mesh.position.x);
            nextX = mesh.position.x + Math.cos(angle) * collisionDist;
            nextZ = mesh.position.z + Math.sin(angle) * collisionDist;
          }
        }
      });

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
    else if (currentMap === 'lobby' || currentMap === 'neighborhood') limitValue = 78;
    else if (currentMap === 'map1' || currentMap === 'map2' || currentMap === 'map3') limitValue = 88;

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

    // Sanctuary Node Interceptor
    if (currentMap === 'sanctuary') {
      if (nearNode.id === 'shrine_emotions' || nearNode.id === 'shrine_bond' || nearNode.id === 'great_seed') {
        setActiveDialogueNodeId(nearNode.id);
        setActiveOverlay('orit_dialogue');
        return;
      }
    }

    // Router
    if (nearNode.type === 'synth') {
      setActiveOverlay('syntonia');
    } else if (nearNode.type === 'marketplace') {
      setActiveOverlay('marketplace');
    } else if (nearNode.type === 'stash') {
      setActiveOverlay('stash');
    } else if (nearNode.type === 'forge' || nearNode.type === 'anvil') {
      setActiveWorkbenchType('forge');
      setActiveOverlay('workbench');
    } else if (nearNode.type === 'weaver') {
      setActiveWorkbenchType('weaver');
      setActiveOverlay('workbench');
    } else if (nearNode.type === 'enchanter') {
      setActiveWorkbenchType('enchanter');
      setActiveOverlay('workbench');
    } else if (nearNode.type === 'refiner') {
      setActiveOverlay('refiner');
    } else if (nearNode.type === 'wardrobe_mirror') {
      setActiveOverlay('avatar_customize');
    } else if (nearNode.type === 'wardrobe_armory') {
      setActiveOverlay('armory');
    } else if (nearNode.type === 'bookshelf') {
      setActiveOverlay('codex');
    } else if (nearNode.type === 'nitz_npc') {
      setActiveOverlay('interactive_pet_chat');
    } else if (nearNode.type === 'orit_npc') {
      setActiveDialogueNodeId(undefined);
      setActiveOverlay('orit_dialogue');
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
      changeMap('neighborhood');
      triggerNotification("🏘️ Has entrado al Vecindario de la Aldea Estelar");
    } else if (nearNode.type === 'door_cabin') {
      changeMap('cabin');
      triggerNotification("🏠 Entrando a tu Cabaña de Origen...");
    } else if (nearNode.type === 'door_lobby') {
      if (progress.worldPresentation?.active && !progress.worldPresentation?.completed) {
        triggerNotification("🔮 Orit: Aún debemos sintonizar tu alma con la Semilla antes de cruzar al exterior.");
        return;
      }
      changeMap('lobby');
      triggerNotification("💎 Entrando a la Gran Plaza Central del Lobby");
    } else if (nearNode.type === 'door_map1') {
      changeMap('map1');
      triggerNotification("🌲 Has viajado al Bosque Seguro (Fácil/Seguro)");
    } else if (nearNode.type === 'door_map2') {
      changeMap('map2');
      triggerNotification("🪨 Has viajado a la Cantera Estelar (Medio/Materiales)");
    } else if (nearNode.type === 'door_map3') {
      changeMap('map3');
      triggerNotification("💀 ¡ALERTA! Has entrado a la Zona de Bruma de Sangre (Zona Roja: Elite/PvP)");
    } else if (nearNode.type === 'door_arena') {
      setActiveOverlay('arena');
    } else if (nearNode.type === 'tree' || nearNode.type === 'ore') {
      const getRarityTier = (rarity: string | undefined): number => {
        if (rarity === 'rare') return 2;
        if (rarity === 'epic') return 3;
        if (rarity === 'legendary') return 4;
        return 1;
      };
      
      const nodeTier = getRarityTier(nearNode.rarity);
      if (nearNode.type === 'tree') {
        const axe = progress.equipment?.axe;
        if (!axe || (axe.tier || 0) < nodeTier) {
          triggerNotification(`⚠️ Requiere Hacha de Tier ${nodeTier} o superior equipada.`);
          return;
        }
      } else if (nearNode.type === 'ore') {
        const pickaxe = progress.equipment?.pickaxe;
        if (!pickaxe || (pickaxe.tier || 0) < nodeTier) {
          triggerNotification(`⚠️ Requiere Pico de Tier ${nodeTier} o superior equipado.`);
          return;
        }
      }

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
          let weaponHarvestPower = 1;
          const activeWep = progress.equipment?.mainHand?.subType;
          if (activeWep === 'weapon_1h' || activeWep === 'weapon_2h' || activeWep === 'weapon') {
            weaponHarvestPower = 2;
          } else if (activeWep === 'ranged') {
            weaponHarvestPower = 3;
          } else if (activeWep === 'grimoire') {
            weaponHarvestPower = 2;
          }

          const nextClicks = (n.clicksCurrent || 0) + weaponHarvestPower + (progress.companionSummoned ? 1 : 0);
          const req = n.clicksRequired || 4;

          if (nextClicks >= req) {
            
            // Validate Weight Capacity
            const cw = (tempBag.wood.common + tempBag.wood.rare + tempBag.wood.epic + tempBag.wood.legendary) * 1 +
                       (tempBag.stone.common + tempBag.stone.rare + tempBag.stone.epic + tempBag.stone.legendary) * 2 +
                       (tempBag.metal.common + tempBag.metal.rare + tempBag.metal.epic + tempBag.metal.legendary) * 3;
            
            if (cw >= maxWeightRef.current) {
              triggerNotification("⚠️ MOCHILA LLENA: Capacidad máxima superada. Vacía tus bolsillos.");
              return n; // Do not drop materials, keep node alive
            }

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

    const weapons = getWeaponsList(progress.craftedItems);
    const shields = getShieldsList(progress.craftedItems);
    const armors = getArmorsList(progress.craftedItems);

    const activeWeapon = getActiveWeapon(progress.craftedItems);
    const activeShield = getActiveShield(progress.craftedItems);
    const activeArmor = getActiveArmor(progress.craftedItems);

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
      challengerNitzName: progress.avatar.name || 'Nitz de Origen',
      challengerNitzTheme: progress.avatar.colorTheme || 'classic',
      challengerNitzPhase: progress.phase || 1,

      defenderId: rival.id,
      defenderName: rival.username,
      defenderHp: 150 + rival.phase * 30,
      defenderMaxHp: 150 + rival.phase * 30,
      defenderShield: 80,
      defenderMaxShield: 80,
      defenderWeapon: '',
      defenderShieldItem: '',
      defenderArmor: '',
      defenderNitzName: rival.activeNitzName || 'Nitz de Origen',
      defenderNitzTheme: rival.avatar?.colorTheme || (rival.activeNitzName === 'Nitz Ígneo' ? 'primeval' : rival.activeNitzName === 'Nitz Abisal' ? 'abyssal' : 'classic'),
      defenderNitzPhase: rival.phase || 1,

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
    const weapons = getWeaponsList(progress.craftedItems);
    const shields = getShieldsList(progress.craftedItems);
    const armors = getArmorsList(progress.craftedItems);

    const activeWeapon = getActiveWeapon(progress.craftedItems);
    const activeShield = getActiveShield(progress.craftedItems);
    const activeArmor = getActiveArmor(progress.craftedItems);

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
        defenderNitzName: progress.avatar.name || 'Nitz de Origen',
        defenderNitzTheme: progress.avatar.colorTheme || 'classic',
        defenderNitzPhase: progress.phase || 1,
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

    // Challenger Nitz Attack
    const cNitzTheme = data.challengerNitzTheme || 'classic';
    const cNitzName = data.challengerNitzName || 'Nitz';
    const cNitzPhase = data.challengerNitzPhase || 1;
    let cNitzDmg = 15 + cNitzPhase * 5;
    let cNitzBurn = 0;
    let cNitzShieldDrain = 0;
    let cNitzHeal = 0;
    let cNitzLog = '';

    if (cNitzTheme === 'primeval' || cNitzName.includes('Ígneo')) {
      cNitzBurn = 1;
      cNitzLog = `🔥 [Nitz Autómata] El compañero [${cNitzName}] de ${data.challengerName} ataca con [LLAMARADA ASTRAL] (${cNitzDmg} daño + 1 turno de quemadura).`;
    } else if (cNitzTheme === 'abyssal' || cNitzName.includes('Abisal')) {
      cNitzShieldDrain = 10;
      cNitzLog = `🌌 [Nitz Autómata] El compañero [${cNitzName}] de ${data.challengerName} ataca con [SPOIL DE VACÍO] (${cNitzDmg} daño + drena 10 de escudo).`;
    } else {
      cNitzDmg = Math.max(5, cNitzDmg - 2);
      cNitzHeal = 10;
      cNitzLog = `✨ [Nitz Autómata] El compañero [${cNitzName}] de ${data.challengerName} desata [DESTELLO ARMONIOSO] (${cNitzDmg} daño + cura 10 HP a su dueño).`;
    }

    // Defender Nitz Attack
    const dNitzTheme = data.defenderNitzTheme || 'classic';
    const dNitzName = data.defenderNitzName || 'Nitz';
    const dNitzPhase = data.defenderNitzPhase || 1;
    let dNitzDmg = 15 + dNitzPhase * 5;
    let dNitzBurn = 0;
    let dNitzShieldDrain = 0;
    let dNitzHeal = 0;
    let dNitzLog = '';

    if (dNitzTheme === 'primeval' || dNitzName.includes('Ígneo')) {
      dNitzBurn = 1;
      dNitzLog = `🔥 [Nitz Autómata] El compañero [${dNitzName}] de ${data.defenderName} ataca con [LLAMARADA ASTRAL] (${dNitzDmg} daño + 1 turno de quemadura).`;
    } else if (dNitzTheme === 'abyssal' || dNitzName.includes('Abisal')) {
      dNitzShieldDrain = 10;
      dNitzLog = `🌌 [Nitz Autómata] El compañero [${dNitzName}] de ${data.defenderName} ataca con [SPOIL DE VACÍO] (${dNitzDmg} daño + drena 10 de escudo).`;
    } else {
      dNitzDmg = Math.max(5, dNitzDmg - 2);
      dNitzHeal = 10;
      dNitzLog = `✨ [Nitz Autómata] El compañero [${dNitzName}] de ${data.defenderName} desata [DESTELLO ARMONIOSO] (${dNitzDmg} daño + cura 10 HP a su dueño).`;
    }

    logs.push(cNitzLog);
    logs.push(dNitzLog);

    // Apply heals (including Nitz heals)
    cHp = Math.min(data.challengerMaxHp, cHp + cHeal + cNitzHeal);
    dHp = Math.min(data.defenderMaxHp, dHp + dHeal + dNitzHeal);

    // Apply shields
    cShield = Math.min(data.challengerMaxShield, cShield + cShieldRegen);
    dShield = Math.min(data.defenderMaxShield, dShield + dShieldRegen);

    // Apply Nitz shield drains
    if (cNitzShieldDrain > 0) dShield = Math.max(0, dShield - cNitzShieldDrain);
    if (dNitzShieldDrain > 0) cShield = Math.max(0, cShield - dNitzShieldDrain);

    // Apply Nitz burns
    if (cNitzBurn > 0) dBurn = Math.max(dBurn, cNitzBurn);
    if (dNitzBurn > 0) cBurn = Math.max(cBurn, dNitzBurn);

    // Apply damage to Defender (Challenger + Nitz)
    const totalDmgToDefender = cDmg + cNitzDmg;
    if (totalDmgToDefender > 0) {
      let finalDmg = totalDmgToDefender;
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
      logs.push(`💥 ${data.defenderName} recibe ${totalDmgToDefender} daño total (${cDmg} jugador + ${cNitzDmg} companion) [${absorbed > 0 ? `${absorbed} absorbido por escudo, ` : ''}${finalDmg} restado de HP].`);
    }

    // Apply damage to Challenger (Defender + Nitz)
    const totalDmgToChallenger = dDmg + dNitzDmg;
    if (totalDmgToChallenger > 0) {
      let finalDmg = totalDmgToChallenger;
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
      logs.push(`💥 ${data.challengerName} recibe ${totalDmgToChallenger} daño total (${dDmg} jugador + ${dNitzDmg} companion) [${absorbed > 0 ? `${absorbed} absorbido por escudo, ` : ''}${finalDmg} restado de HP].`);
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

  const weapons = getWeaponsList(progress.craftedItems);
  const shields = getShieldsList(progress.craftedItems);
  const armors = getArmorsList(progress.craftedItems);

  const activeWeapon = getActiveWeapon(progress.craftedItems);
  const activeShield = getActiveShield(progress.craftedItems);
  const activeArmor = getActiveArmor(progress.craftedItems);

  const activeWeaponSkillName = activeWeapon?.name.includes('Sable del Alba') ? 'Ira Solar' : activeWeapon?.name.includes('Mandoble') ? 'Tajo Sombrío' : 'Corte Rápido';
  const activeShieldSkillName = activeShield?.name.includes('Estelares') ? 'Barrera Rúnica' : 'Guardia Simple';
  const activeArmorSkillName = activeArmor?.name.includes('Escamas') ? 'Escama Sagrada' : 'Refugio Común';

  const distanceToBeacon = currentMap === 'map3' ? Math.sqrt(Math.pow(playerX - extractionXRef.current, 2) + Math.pow(playerZ - extractionZRef.current, 2)) : 999;
  const isNearBeacon = distanceToBeacon <= 5.0;

  // Auto-open Orit dialogue on first cabin or sanctuary entry
  useEffect(() => {
    if (currentMap === 'sanctuary' && progress.worldPresentation?.active && progress.worldPresentation?.currentStep === 'intro') {
      const timer = setTimeout(() => {
        setActiveDialogueNodeId(undefined);
        setActiveOverlay('orit_dialogue');
      }, 1500);
      return () => clearTimeout(timer);
    } else if (currentMap === 'cabin' && !progress.cabin?.oritMet) {
      const timer = setTimeout(() => {
        setActiveOverlay('orit_dialogue');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentMap, progress.cabin?.oritMet, progress.worldPresentation?.active, progress.worldPresentation?.currentStep]);

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
              {/* Health Bar HUD */}
              <div className="flex items-center gap-2 bg-red-950/20 border border-red-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-mono text-red-400">
                <Heart className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" />
                <span className="font-bold">HP:</span>
                <span className="font-bold">{progress.hp !== undefined ? progress.hp : 100}/{progress.maxHp || 100}</span>
                <div className="w-16 bg-red-950 h-1.5 rounded-full overflow-hidden border border-red-500/10">
                  <div 
                    className="bg-gradient-to-r from-red-600 to-red-400 h-full transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, (((progress.hp !== undefined ? progress.hp : 100) / (progress.maxHp || 100)) * 100)))}%` }}
                  />
                </div>
              </div>
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
        
        {/* Proximity Chat Transmission Indicator */}
        {isProximityChatActive && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-[#0f1d1a] border border-emerald-500/40 px-5 py-2.5 rounded-full text-xs font-bold text-emerald-400 shadow-2xl flex items-center gap-2 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping mr-1" />
            <span>🎙️ CHAT DE PROXIMIDAD ACTIVO (Presionando V)</span>
          </div>
        )}

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
              <span>Pulsa [F] o CLIC para Activar</span>
            </button>
          </div>
        )}

        {/* Proximity Chat HUD Overlay */}
        {isProximityChatActive && (
          <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-30 bg-emerald-500/20 border border-emerald-400/50 rounded-full px-6 py-2 backdrop-blur-md flex items-center gap-2 animate-pulse pointer-events-none">
            <span className="text-xl">🎙️</span>
            <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest">Transmitiendo voz en proximidad...</span>
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

        {/* Bottom Center Skill and Dodge HUD */}
        {activeOverlay === 'none' && !pvpDuel?.inCombat && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-6 items-center bg-black/75 border border-white/10 px-5 py-3 rounded-2xl backdrop-blur-md">
            {/* Dodge Dash slot (V) */}
            <div className="flex flex-col items-center gap-1">
              <div 
                onClick={triggerEvadeDash}
                className={`relative w-12 h-12 flex items-center justify-center bg-white/5 border rounded-full group cursor-pointer hover:border-emerald-500 hover:bg-emerald-950/20 transition-all ${
                  dashCooldownLeft > 0 ? 'border-red-500/50 bg-red-950/10' : 'border-white/10'
                }`}
              >
                {/* Cooldown SVG Ring */}
                <svg className="absolute inset-0 -rotate-90 w-full h-full">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke={dashCooldownLeft > 0 ? "rgba(239, 68, 68, 0.6)" : "rgba(16, 185, 129, 0.4)"}
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray="125.6"
                    strokeDashoffset={dashCooldownLeft > 0 ? 125.6 * (1 - dashCooldownLeft / 3.0) : 0}
                    className="transition-all duration-100"
                  />
                </svg>
                <span className="text-[9px] font-bold text-white group-hover:scale-110 transition-transform select-none">DODGE</span>
                <span className="absolute bottom-0 bg-[#0d0e1b] text-gray-400 border border-white/10 rounded px-1 text-[7px] font-mono select-none">SHIFT</span>
              </div>
              <span className="text-[8px] font-mono text-gray-400">
                {dashCooldownLeft > 0 ? `${dashCooldownLeft.toFixed(1)}s` : 'LISTO'}
              </span>
            </div>

            {/* Weapon Special Ability slot (Q) */}
            <div className="flex flex-col items-center gap-1">
              <div 
                onClick={() => {
                  if (skillCooldownLeft <= 0) {
                    triggerSpecialSkillRef.current();
                  }
                }}
                className={`relative w-12 h-12 flex items-center justify-center bg-white/5 border rounded-full group cursor-pointer hover:border-purple-500 hover:bg-purple-950/20 transition-all ${
                  skillCooldownLeft > 0 ? 'border-red-500/50 bg-red-950/10' : 'border-white/10'
                }`}
              >
                {/* Cooldown SVG Ring */}
                <svg className="absolute inset-0 -rotate-90 w-full h-full">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke={skillCooldownLeft > 0 ? "rgba(239, 68, 68, 0.6)" : "rgba(168, 85, 247, 0.5)"}
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray="125.6"
                    strokeDashoffset={skillCooldownLeft > 0 ? 125.6 * (1 - skillCooldownLeft / 8.0) : 0}
                    className="transition-all duration-100"
                  />
                </svg>
                <span className="text-[9px] font-bold text-white group-hover:scale-110 transition-transform select-none">HABIL.</span>
                <span className="absolute bottom-0 bg-[#0d0e1b] text-gray-400 border border-white/10 rounded px-1 text-[7px] font-mono select-none">Q</span>
              </div>
              <span className="text-[8px] font-mono text-purple-400">
                {skillCooldownLeft > 0 ? `${skillCooldownLeft.toFixed(1)}s` : 'LISTO'}
              </span>
            </div>
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
        {activeOverlay !== 'none' && activeOverlay !== 'orit_dialogue' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="absolute inset-0 z-40 bg-black/90 p-4 md:p-8 overflow-y-auto flex flex-col justify-center items-center"
          >
            {activeOverlay === 'avatar_customize' ? (
              <AvatarCustomizeUI 
                progress={progress}
                onSaveProgress={onSaveProgress}
                onClose={() => setActiveOverlay('none')}
              />
            ) : activeOverlay === 'armory' ? (
              <ArmoryUI 
                progress={progress}
                onSaveProgress={onSaveProgress}
                onClose={() => setActiveOverlay('none')}
              />
            ) : (
              <>
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
                      {activeOverlay === 'marketplace' && '⚖️ Gran Mercado Astral Global'}
                      {activeOverlay === 'stash' && '📦 Baúl de Almacenamiento Fuerte'}
                      {activeOverlay === 'refiner' && '🔥 Refinería de Recursos Estelares'}
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

                  {activeOverlay === 'marketplace' && (
                    <Marketplace 
                      progress={progress}
                      onSaveProgress={onSaveProgress}
                      onClose={() => setActiveOverlay('none')}
                    />
                  )}

                  {activeOverlay === 'stash' && (
                    <StashUI 
                      progress={progress}
                      onSaveProgress={onSaveProgress}
                      onClose={() => setActiveOverlay('none')}
                      tempBag={tempBag}
                      setTempBag={setTempBag}
                    />
                  )}

                  {activeOverlay === 'workbench' && (
                    <WorkbenchUI 
                      progress={progress}
                      onSaveProgress={onSaveProgress}
                      onClose={() => setActiveOverlay('none')}
                      type={activeWorkbenchType}
                    />
                  )}

                  {activeOverlay === 'refiner' && (
                    <RefinerUI 
                      progress={progress}
                      onSaveProgress={onSaveProgress}
                      onClose={() => setActiveOverlay('none')}
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
                      onOpenVoice={() => setActiveOverlay('gemini_voice')}
                    />
                  )}

                  {activeOverlay === 'gemini_voice' && (
                    <GeminiLiveChat 
                      progress={progress}
                      onClose={() => setActiveOverlay('interactive_pet_chat')}
                    />
                  )}

                  {/* Cabin System Overlay */}
                  {activeOverlay === 'cabin_system' && (
                    <CabinSystem
                      progress={progress}
                      onSaveProgress={onSaveProgress}
                      onClose={() => setActiveOverlay('none')}
                    />
                  )}

                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orit Dialogue — lightweight HUD overlay, renders above 3D canvas */}
      {activeOverlay === 'orit_dialogue' && (
        <OritDialogueUI
          progress={progress}
          onSaveProgress={onSaveProgress}
          onClose={(action) => {
            if (action === 'open_cabin_system') {
              setActiveOverlay('cabin_system');
            } else {
              setActiveOverlay('none');
            }
          }}
          dominantEmotion={currentDominant.name}
          interactingNodeId={activeDialogueNodeId}
        />
      )}

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

      {/* QUICK INVENTORY TACTICAL HUD */}
      <AnimatePresence>
        {showQuickInventory && activeOverlay === 'none' && (() => {
          const eligibleItems = (progress.craftedItems || []).filter(ci => {
            if (selectedDollSlot) {
              if (selectedDollSlot === 'mainHand') {
                return ci.subType === 'weapon' || ci.subType === 'weapon_1h' || ci.subType === 'weapon_2h' || ci.subType === 'ranged' || ci.subType === 'grimoire';
              }
              if (selectedDollSlot === 'offHand') return ci.subType === 'shield';
              if (selectedDollSlot === 'chest') return ci.subType === 'chest' || ci.subType === 'armor';
              if (selectedDollSlot === 'legs') return ci.subType === 'legs';
              if (selectedDollSlot === 'head') return ci.subType === 'head';
              if (selectedDollSlot === 'backpack') return ci.subType === 'backpack';
              if (selectedDollSlot === 'axe') return ci.subType === 'axe';
              if (selectedDollSlot === 'pickaxe') return ci.subType === 'pickaxe';
              return false;
            }
            
            if (activeInvTab === 'weapons') {
              return ci.subType === 'weapon' || ci.subType === 'weapon_1h' || ci.subType === 'weapon_2h' || ci.subType === 'ranged' || ci.subType === 'grimoire' || ci.subType === 'shield';
            }
            if (activeInvTab === 'armor') {
              return ci.subType === 'chest' || ci.subType === 'armor' || ci.subType === 'legs' || ci.subType === 'head' || ci.subType === 'backpack';
            }
            if (activeInvTab === 'tools') {
              return ci.subType === 'axe' || ci.subType === 'pickaxe';
            }
            return true; // 'all'
          });

          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-2 md:inset-10 z-40 bg-[#07080c]/95 border-2 border-red-900/30 rounded-xl shadow-2xl backdrop-blur-xl pointer-events-auto flex flex-col md:flex-row overflow-hidden"
            >
              {/* Left Panel: Stats & Weight */}
              <div className="w-full md:w-1/4 bg-black/40 border-r border-red-900/30 p-6 flex flex-col">
                <h3 className="text-red-500 font-bold tracking-widest text-lg mb-6 border-b border-red-900/50 pb-2 uppercase flex items-center gap-2">
                  <Shield className="w-5 h-5" /> TACTICAL STATUS
                </h3>
                
                <div className="space-y-6 flex-1">
                  <div className="bg-[#110505] border border-red-900/40 p-4 rounded-lg">
                    <span className="text-[10px] text-red-500/70 font-mono uppercase block mb-1">Carga Física (Temp Bag)</span>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-2xl font-bold text-gray-200">{
                        (tempBag.wood.common + tempBag.wood.rare + tempBag.wood.epic + tempBag.wood.legendary) * 1 +
                        (tempBag.stone.common + tempBag.stone.rare + tempBag.stone.epic + tempBag.stone.legendary) * 2 +
                        (tempBag.metal.common + tempBag.metal.rare + tempBag.metal.epic + tempBag.metal.legendary) * 3
                      } <span className="text-xs text-gray-500">KG</span></span>
                      <span className="text-xs text-red-500 font-mono">/ {progress.equipment?.backpack?.weightCapacity || 30} KG MAX</span>
                    </div>
                    <div className="w-full bg-black h-2 rounded-full overflow-hidden border border-red-900/50">
                      <div className="bg-red-600 h-full transition-all" style={{ width: `${Math.min(100, (((tempBag.wood.common + tempBag.wood.rare + tempBag.wood.epic + tempBag.wood.legendary) * 1 + (tempBag.stone.common + tempBag.stone.rare + tempBag.stone.epic + tempBag.stone.legendary) * 2 + (tempBag.metal.common + tempBag.metal.rare + tempBag.metal.epic + tempBag.metal.legendary) * 3) / (progress.equipment?.backpack?.weightCapacity || 30)) * 100)}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#1a1c23] p-3 rounded border border-white/5">
                      <span className="text-gray-500 block text-[9px] uppercase">HP Máximo</span>
                      <span className="text-emerald-400 font-bold">{progress.maxHp || 100}</span>
                    </div>
                    <div className="bg-[#1a1c23] p-3 rounded border border-white/5">
                      <span className="text-gray-500 block text-[9px] uppercase">Oro de Supervivencia</span>
                      <span className="text-yellow-500 font-bold">{progress.gold} G</span>
                    </div>
                  </div>

                  {/* Weapon Masteries (Albion Style) */}
                  <div className="bg-black/20 border border-white/5 p-4 rounded-lg space-y-2 text-xs font-mono">
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest block border-b border-white/5 pb-1 font-bold">Maestrías de Arma</span>
                    <div className="flex justify-between">
                      <span className="text-gray-500">⚔️ Espada:</span>
                      <span className="text-amber-500 font-bold">LVL {progress.weaponMastery?.sword || 1} <span className="text-[9.5px] text-gray-600">({progress.weaponMasteryExp?.sword || 0}/500)</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">🔫 A Distancia:</span>
                      <span className="text-amber-500 font-bold">LVL {progress.weaponMastery?.ranged || 1} <span className="text-[9.5px] text-gray-600">({progress.weaponMasteryExp?.ranged || 0}/500)</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">🔮 Grimorio:</span>
                      <span className="text-amber-500 font-bold">LVL {progress.weaponMastery?.grimoire || 1} <span className="text-[9.5px] text-gray-600">({progress.weaponMasteryExp?.grimoire || 0}/500)</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">👊 Puños:</span>
                      <span className="text-amber-500 font-bold">LVL {progress.weaponMastery?.fists || 1} <span className="text-[9.5px] text-gray-600">({progress.weaponMasteryExp?.fists || 0}/500)</span></span>
                    </div>
                  </div>

                  {/* Refining Mastery (Albion Style) */}
                  <div className="bg-black/20 border border-white/5 p-4 rounded-lg space-y-2 text-xs font-mono">
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest block border-b border-white/5 pb-1 font-bold">Refinación</span>
                    <div className="flex justify-between">
                      <span className="text-gray-500">🔥 Nivel:</span>
                      <span className="text-amber-500 font-bold">LVL {progress.refiningLevel || 1} <span className="text-[9.5px] text-gray-600">({progress.refiningExp || 0}/{(progress.refiningLevel || 1) * 300})</span></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Panel: Equipment Doll (Center 2D Avatar + Slots on Left & Right) */}
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const data = e.dataTransfer.getData('text/plain');
                  if (data.startsWith('unequip:')) {
                    const slotToUnequip = data.split(':')[1] as keyof EquipmentSlots;
                    handleEquipItemInWorld(slotToUnequip, null);
                  }
                }}
                className="flex-1 p-6 flex flex-col items-center justify-center relative border-r border-red-900/30"
              >
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-500 via-transparent to-transparent pointer-events-none" />
                
                <div className="flex flex-row items-center justify-between gap-6 relative z-10 w-full max-w-xl">
                  
                  {/* Left Column (Head, Chest, Legs, Backpack armor slots) */}
                  <div className="space-y-4 flex flex-col items-end">
                    {renderDollSlot('head', 'HEAD', '👤', '🪖')}
                    {renderDollSlot('chest', 'CHEST RIG', '👕', '🦺')}
                    {renderDollSlot('legs', 'LEGS', '👖', '🥾')}
                    {renderDollSlot('backpack', 'BACKPACK', '📦', '🎒')}
                  </div>

                  {/* Center Column (2D Avatar Rendering) */}
                  <div className="flex flex-col items-center justify-center">
                    {render2DAvatar()}
                  </div>

                  {/* Right Column (Main Hand, Off Hand, Axe, Pickaxe slots) */}
                  <div className="space-y-4 flex flex-col items-start">
                    {renderDollSlot('mainHand', 'MAIN HAND', '✋', 
                      progress.equipment?.mainHand 
                        ? (progress.equipment.mainHand.subType === 'ranged' ? '🔫' : progress.equipment.mainHand.subType === 'grimoire' ? '🔮' : '⚔️')
                        : '✋'
                    )}
                    {renderDollSlot('offHand', 'OFF HAND', '❌', '🛡️')}
                    {renderDollSlot('axe', 'AXE', '❌', '🪓')}
                    {renderDollSlot('pickaxe', 'PICKAXE', '❌', '⛏️')}
                  </div>

                </div>
                <div className="mt-8 text-[9px] text-gray-500 font-mono uppercase tracking-widest text-center">
                  [ Arrastra ítems para equipar/desequipar | Suelta TAB para cerrar ]
                </div>
              </div>

              {/* Right Panel: Scrollable general inventory */}
              <div className="w-full md:w-1/3 bg-[#0d0e1b]/95 p-6 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center border-b border-red-900/40 pb-3 mb-4">
                  <h4 className="text-[#dec1ac] font-bold text-sm tracking-widest uppercase flex items-center gap-2">
                    💼 Mochila de Equipo
                  </h4>
                  {selectedDollSlot && (
                    <button 
                      onClick={() => setSelectedDollSlot(null)}
                      className="text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-400 px-2 py-0.5 rounded border border-red-500/30 uppercase font-mono transition-all"
                    >
                      Ver Todo
                    </button>
                  )}
                </div>

                {/* Category tabs */}
                {!selectedDollSlot ? (
                  <div className="grid grid-cols-4 gap-1.5 mb-4 text-[10px] font-mono font-bold text-center">
                    {(['all', 'weapons', 'armor', 'tools'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveInvTab(tab)}
                        className={`py-1.5 rounded transition-all border uppercase ${
                          activeInvTab === tab 
                            ? 'bg-red-950/30 border-red-500/50 text-red-400' 
                            : 'bg-black/40 border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300'
                        }`}
                      >
                        {tab === 'all' ? 'Todos' : tab === 'weapons' ? 'Armas' : tab === 'armor' ? 'Armadura' : 'Útiles'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bg-red-950/20 border border-red-500/20 p-2.5 rounded-lg mb-4 text-[10px] font-mono text-red-300 flex justify-between items-center">
                    <span>Filtrando ranura: <strong>{selectedDollSlot.toUpperCase()}</strong></span>
                    <button 
                      onClick={() => {
                        handleEquipItemInWorld(selectedDollSlot, null);
                        setSelectedDollSlot(null);
                      }}
                      className="bg-red-600/30 hover:bg-red-600/40 px-2 py-0.5 rounded font-bold uppercase transition-all"
                    >
                      Desequipar
                    </button>
                  </div>
                )}

                {/* List of items */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {eligibleItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 opacity-40">
                      <span className="text-3xl mb-2">📦</span>
                      <p className="text-[10px] text-gray-400 italic text-center">
                        {selectedDollSlot 
                          ? 'No tienes equipamiento fabricado compatible.' 
                          : 'Mochila vacía. Fabrica equipo en la Forja.'}
                      </p>
                    </div>
                  ) : (
                    eligibleItems.map(item => {
                      let subEmoji = '🛡️';
                      if (item.subType === 'axe') subEmoji = '🪓';
                      else if (item.subType === 'pickaxe') subEmoji = '⛏️';
                      else if (item.subType === 'weapon' || item.subType === 'weapon_1h' || item.subType === 'weapon_2h') subEmoji = '⚔️';
                      else if (item.subType === 'ranged') subEmoji = '🔫';
                      else if (item.subType === 'grimoire') subEmoji = '🔮';
                      else if (item.subType === 'chest' || item.subType === 'armor') subEmoji = '👕';
                      else if (item.subType === 'head') subEmoji = '🪖';
                      else if (item.subType === 'legs') subEmoji = '👖';
                      else if (item.subType === 'backpack') subEmoji = '🎒';

                      return (
                        <div 
                          key={item.id}
                          draggable={!item.equipped}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', `equip:${item.id}`);
                          }}
                          onClick={() => {
                            if (!item.equipped) {
                              if (selectedDollSlot) {
                                handleDropEquip(selectedDollSlot, item);
                                setSelectedDollSlot(null);
                              } else {
                                autoEquipItem(item);
                              }
                            } else {
                              const equippedSlot = Object.keys(progress.equipment || {}).find(
                                k => progress.equipment?.[k as keyof EquipmentSlots]?.id === item.id
                              ) as keyof EquipmentSlots | undefined;
                              if (equippedSlot) {
                                handleEquipItemInWorld(equippedSlot, null);
                              }
                            }
                          }}
                          className={`p-2.5 rounded-lg border text-xs flex justify-between items-center transition-all cursor-pointer ${
                            item.equipped 
                              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-400' 
                              : 'bg-[#121422] border-white/5 text-gray-300 hover:border-red-900/50 hover:bg-[#1a1c2d]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{subEmoji}</span>
                            <div>
                              <div className="font-bold flex items-center gap-1.5">
                                {item.name}
                                {item.tier && (
                                  <span className="text-[8px] bg-red-950/60 border border-red-500/20 text-red-400 font-mono font-extrabold px-1 rounded">
                                    T{item.tier}
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] text-gray-500 font-mono">{item.statBonus || 'Sin bonus'}</div>
                            </div>
                          </div>
                          {item.equipped ? (
                            <span className="text-[9px] font-bold text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono uppercase">
                              Equipado
                            </span>
                          ) : (
                            <span className="text-[8px] opacity-0 group-hover:opacity-100 text-gray-500 font-mono">
                              ARRAS. / CLIC
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* MOBILE TOUCH CONTROLS */}
      {isMobile && activeOverlay === 'none' && !pvpDuel?.inCombat && (
        <div className="absolute inset-0 pointer-events-none z-30 flex justify-between items-end p-6 md:p-8">
          
          {/* Virtual Joystick Zone */}
          <div 
            className="w-32 h-32 bg-black/20 rounded-full border-2 border-white/20 pointer-events-auto relative flex items-center justify-center backdrop-blur-md mb-8"
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
            onTouchCancel={handleJoystickEnd}
          >
            <div 
              className="w-12 h-12 bg-white/40 rounded-full shadow-lg"
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`
              }}
            />
          </div>

          {/* Action Buttons Zone */}
          <div className="flex flex-col gap-4 pointer-events-auto mb-8">
            <div className="flex gap-4 justify-end">
              <button 
                className="w-14 h-14 rounded-full bg-emerald-500/80 border-2 border-emerald-400 text-white font-bold text-xl shadow-xl active:scale-90 transition-transform flex items-center justify-center backdrop-blur-md"
                onPointerDown={(e) => {
                  e.preventDefault();
                  const kbEvent = new KeyboardEvent('keydown', { key: 'f' });
                  window.dispatchEvent(kbEvent);
                  setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'f' })), 100);
                }}
              >
                F
              </button>
            </div>
            <div className="flex gap-4 justify-end mt-2 items-center">
              {/* Companion Toggle Button (E) */}
              <button 
                className="w-14 h-14 rounded-full bg-indigo-500/80 border-2 border-indigo-400 text-white font-bold text-xl shadow-xl active:scale-90 transition-transform flex items-center justify-center backdrop-blur-md"
                onPointerDown={(e) => {
                  e.preventDefault();
                  const kbEvent = new KeyboardEvent('keydown', { key: 'e' });
                  window.dispatchEvent(kbEvent);
                  setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' })), 100);
                }}
              >
                E
              </button>

              {/* Special Skill Button (Q) */}
              <div 
                className="relative w-14 h-14 flex items-center justify-center bg-purple-900/80 border-2 border-purple-500 rounded-full cursor-pointer active:scale-90 shadow-xl transition-all select-none backdrop-blur-md text-white font-bold text-xl"
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (skillCooldownLeft <= 0) {
                    triggerSpecialSkillRef.current();
                  }
                }}
              >
                <svg className="absolute inset-0 -rotate-90 w-full h-full">
                  <circle
                    cx="28"
                    cy="28"
                    r="23"
                    stroke={skillCooldownLeft > 0 ? "rgba(239, 68, 68, 0.6)" : "rgba(168, 85, 247, 0.5)"}
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray="144.5"
                    strokeDashoffset={skillCooldownLeft > 0 ? 144.5 * (1 - skillCooldownLeft / 8.0) : 0}
                  />
                </svg>
                <span className="z-10">Q</span>
              </div>

              {/* Dodge Dash Button (SFT) */}
              <div 
                className="relative w-14 h-14 flex items-center justify-center bg-pink-600/80 border-2 border-pink-400 rounded-full cursor-pointer active:scale-90 shadow-xl transition-all select-none backdrop-blur-md text-white font-bold text-lg"
                onTouchStart={(e) => {
                  e.preventDefault();
                  triggerEvadeDash();
                }}
              >
                <svg className="absolute inset-0 -rotate-90 w-full h-full">
                  <circle
                    cx="28"
                    cy="28"
                    r="23"
                    stroke={dashCooldownLeft > 0 ? "rgba(239, 68, 68, 0.6)" : "rgba(16, 185, 129, 0.5)"}
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray="144.5"
                    strokeDashoffset={dashCooldownLeft > 0 ? 144.5 * (1 - dashCooldownLeft / 3.0) : 0}
                  />
                </svg>
                <span className="z-10 text-xs">SHIFT</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map transition fade overlay */}
      <AnimatePresence>
        {mapTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-[#090a14] z-50 flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" style={{ animationDuration: '2s' }} />
              <span className="text-[#dec1ac] text-xs font-bold font-mono tracking-widest uppercase animate-pulse">
                Sincronizando Resonancia de Zona...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
