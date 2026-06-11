import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EmotionName, EmotionVector } from '../types';

interface NitzCanvasProps {
  emotions: EmotionVector;
  phase: number;
  accessory: string;
  clothing: string;
  colorTheme: string;
  onPet: () => void;
}

export const EMOTION_COLORS: Record<EmotionName, number> = {
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

export const NitzCanvas: React.FC<NitzCanvasProps> = ({
  emotions,
  phase,
  accessory,
  clothing,
  colorTheme,
  onPet,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nitzGroupRef = useRef<THREE.Group | null>(null);
  const tailGroupRef = useRef<THREE.Group | null>(null);
  const auraMeshRef = useRef<THREE.Mesh | null>(null);
  const eyesGroupRef = useRef<THREE.Group | null>(null);
  const particleGroupRef = useRef<THREE.Group | null>(null);
  const crownMeshRef = useRef<THREE.Mesh | null>(null);

  // Keep track of parameters to animate dynamically without recreation
  const currentEmotionRef = useRef<EmotionName>('Alegría');
  const dominantIntensityRef = useRef<number>(1);
  const phaseRef = useRef<number>(phase);
  const accRef = useRef<string>(accessory);
  const clothRef = useRef<string>(clothing);

  // Calculate dominant emotion and intensity
  const getDominantEmotion = (vec: EmotionVector): { name: EmotionName; value: number } => {
    let maxName: EmotionName = 'Alegría';
    let maxValue = -1;
    (Object.keys(vec) as EmotionName[]).forEach((key) => {
      if (vec[key] > maxValue) {
        maxValue = vec[key];
        maxName = key;
      }
    });
    return { name: maxName, value: maxValue };
  };

  const { name: dominantName, value: dominantVal } = getDominantEmotion(emotions);
  const intensity = dominantVal / 100;

  // Sync state into refs for fast anim loop reads
  currentEmotionRef.current = dominantName;
  dominantIntensityRef.current = intensity;
  phaseRef.current = phase;
  accRef.current = accessory;
  clothRef.current = clothing;

  // Render initialization
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 450;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x0e111a, 1.5);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x111322, 1.2);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight1.position.set(5, 5, 4);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    // Warm side light for intimacy
    const warmLight = new THREE.PointLight(0xff9944, 1.8, 12);
    warmLight.position.set(-4, -2, 2);
    scene.add(warmLight);

    // Nitz Master Group
    const nitzGroup = new THREE.Group();
    scene.add(nitzGroup);
    nitzGroupRef.current = nitzGroup;

    // --- Body Creation ---
    // Rounded body with procedural displacement mesh phong
    const bodyGeometry = new THREE.SphereGeometry(1.2, 48, 48);
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: 0xf5f8ff,
      emissive: 0x111422,
      shininess: 90,
      flatShading: false,
    });
    
    // Add subtle procedural noise maps later if needed, simple shininess works great.
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    nitzGroup.add(bodyMesh);

    // --- Eyes ---
    const eyesGroup = new THREE.Group();
    eyesGroup.position.set(0, 0.25, 1.0);
    nitzGroup.add(eyesGroup);
    eyesGroupRef.current = eyesGroup;

    // Left & Right Eye Sockets
    const eyeGeo = new THREE.SphereGeometry(0.18, 24, 24);
    const eyeMat = new THREE.MeshPhongMaterial({ color: 0x070912, shininess: 120 });
    
    const leftEyeSocket = new THREE.Mesh(eyeGeo, eyeMat);
    leftEyeSocket.position.set(-0.45, 0, 0.1);
    leftEyeSocket.scale.set(1.2, 1, 0.5);
    
    const rightEyeSocket = new THREE.Mesh(eyeGeo, eyeMat);
    rightEyeSocket.position.set(0.45, 0, 0.1);
    rightEyeSocket.scale.set(1.2, 1, 0.5);
    
    eyesGroup.add(leftEyeSocket);
    eyesGroup.add(rightEyeSocket);

    // Pupils (anime elements with emotional gradient glow)
    const pupilGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x00e1d9 }); // dynamically matches emotion color
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(-0.45, 0, 0.18);
    leftPupil.scale.set(1.1, 1.3, 0.4);

    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0.45, 0, 0.18);
    rightPupil.scale.set(1.1, 1.3, 0.4);

    eyesGroup.add(leftPupil);
    eyesGroup.add(rightPupil);

    // Shine Spots
    const shineGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    const shineL = new THREE.Mesh(shineGeo, shineMat);
    shineL.position.set(-0.42, 0.05, 0.23);
    const shineR = new THREE.Mesh(shineGeo, shineMat);
    shineR.position.set(0.48, 0.05, 0.23);
    
    eyesGroup.add(shineL);
    eyesGroup.add(shineR);

    // --- Dynamic Tail ---
    // Tail is a chain of segments (rounded caps) to bend gracefully
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, -0.6, -1.0);
    nitzGroup.add(tailGroup);
    tailGroupRef.current = tailGroup;

    const segmentCount = 6;
    const segments: THREE.Mesh[] = [];
    const segmentRadius = 0.18;
    
    let currentParent: THREE.Object3D = tailGroup;
    for (let i = 0; i < segmentCount; i++) {
      const sizeScale = 1.0 - (i / segmentCount) * 0.5; // Tapering tail
      const length = 0.35;
      const tailSegGeo = new THREE.ConeGeometry(segmentRadius * sizeScale, length, 12);
      
      const tailSegMat = new THREE.MeshPhongMaterial({
        color: 0xf5f8ff,
        shininess: 60,
      });

      const tailSeg = new THREE.Mesh(tailSegGeo, tailSegMat);
      tailSeg.rotation.x = -Math.PI / 2; // Orient along back
      tailSeg.position.set(0, 0, -length * 0.6);
      
      const joint = new THREE.Group();
      joint.position.set(0, 0, i === 0 ? 0 : -length * 0.9);
      joint.add(tailSeg);
      currentParent.add(joint);
      
      segments.push(tailSeg);
      currentParent = joint; // Chain joints parent-child
    }

    // --- Ears (Phase 2+) ---
    const leftEarJoint = new THREE.Group();
    leftEarJoint.position.set(-0.6, 0.9, 0.2);
    leftEarJoint.rotation.set(0, 0.2, -0.4);
    nitzGroup.add(leftEarJoint);

    const rightEarJoint = new THREE.Group();
    rightEarJoint.position.set(0.6, 0.9, 0.2);
    rightEarJoint.rotation.set(0, -0.2, 0.4);
    nitzGroup.add(rightEarJoint);

    const earGeo = new THREE.ConeGeometry(0.28, 1.1, 16);
    earGeo.translate(0, 0.55, 0); // shift pivot
    const earInnerMat = new THREE.MeshPhongMaterial({ color: 0xff69b4 });
    const earOuterMat = new THREE.MeshPhongMaterial({ color: 0xf5f8ff });

    const leftEar = new THREE.Mesh(earGeo, earOuterMat);
    const leftEarInner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 16).translate(0, 0.45, 0.05), earInnerMat);
    leftEarJoint.add(leftEar, leftEarInner);

    const rightEar = new THREE.Mesh(earGeo, earOuterMat);
    const rightEarInner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 16).translate(0, 0.45, 0.05), earInnerMat);
    rightEarJoint.add(rightEar, rightEarInner);

    // --- Elegant Crown / Halo (Phase 5+) ---
    const crownMat = new THREE.MeshPhongMaterial({
      color: 0xffd700,
      emissive: 0x5a4500,
      shininess: 120,
    });
    const crownGeo = new THREE.TorusGeometry(0.7, 0.05, 12, 48);
    const crownMesh = new THREE.Mesh(crownGeo, crownMat);
    crownMesh.rotation.x = Math.PI / 2.2;
    crownMesh.position.set(0, 1.7, -0.3);
    nitzGroup.add(crownMesh);
    crownMeshRef.current = crownMesh;

    // --- Aura Glowing Outer Shell ---
    const auraGeo = new THREE.SphereGeometry(1.8, 32, 32);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    nitzGroup.add(auraMesh);
    auraMeshRef.current = auraMesh;

    // --- Magical Floating Particles Group ---
    const particleGroup = new THREE.Group();
    scene.add(particleGroup);
    particleGroupRef.current = particleGroup;

    const particleCount = 28;
    const particleGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    const activeParticles: Array<{
      mesh: THREE.Mesh;
      speed: number;
      angle: number;
      radiusY: number;
      orbitSpeed: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      const pColor = EMOTION_COLORS[currentEmotionRef.current];
      const pMat = new THREE.MeshBasicMaterial({
        color: pColor,
        transparent: true,
        opacity: 0.6 + Math.random() * 0.4,
      });
      const pMesh = new THREE.Mesh(particleGeometry, pMat);
      
      const radius = 1.6 + Math.random() * 1.5;
      const angle = Math.random() * Math.PI * 2;
      const yOffset = (Math.random() - 0.5) * 2;
      
      pMesh.position.set(Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius);
      pMesh.scale.setScalar(0.4 + Math.random() * 0.8);
      particleGroup.add(pMesh);

      activeParticles.push({
        mesh: pMesh,
        speed: 0.01 + Math.random() * 0.02,
        angle,
        radiusY: radius,
        orbitSpeed: 0.005 + Math.random() * 0.01,
      });
    }

    // Interactive Starburst particle generator click effect
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const spawnSparks = (x: number, y: number, colorVal: number) => {
      const sparkGroup = new THREE.Group();
      scene.add(sparkGroup);
      sparkGroup.position.copy(nitzGroup.position);

      const sparks: Array<{ mesh: THREE.Mesh; pSpeed: THREE.Vector3; life: number }> = [];
      const sparkGeo = new THREE.SphereGeometry(0.04, 6, 6);
      const sparkMat = new THREE.MeshBasicMaterial({ color: colorVal, transparent: true, opacity: 1 });

      for (let s = 0; s < 15; s++) {
        const sm = new THREE.Mesh(sparkGeo, sparkMat);
        sm.position.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4);
        sparkGroup.add(sm);
        sparks.push({
          mesh: sm,
          pSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 0.08,
            (Math.random() - 0.5) * 0.08 + 0.03, // float up
            (Math.random() - 0.5) * 0.08
          ),
          life: 1.0,
        });
      }

      // Spark Animation lifecycle
      const updateSparks = () => {
        let alive = false;
        sparks.forEach((sp) => {
          if (sp.life > 0) {
            sp.mesh.position.add(sp.pSpeed);
            sp.life -= 0.03;
            (sp.mesh.material as THREE.MeshBasicMaterial).opacity = sp.life;
            sp.mesh.scale.setScalar(sp.life);
            alive = true;
          }
        });
        if (alive) {
          requestAnimationFrame(updateSparks);
        } else {
          scene.remove(sparkGroup);
        }
      };
      updateSparks();
    };

    const onCanvasClick = (e: MouseEvent) => {
      // Raycast to check if clicked on Nitz
      const rect = renderer.domElement.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      mouse.set(mouseX, mouseY);
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(nitzGroup.children, true);
      if (intersects.length > 0) {
        // Trigger pet callback
        onPet();
        
        // Visual click feedback
        const sparkColor = EMOTION_COLORS[currentEmotionRef.current];
        spawnSparks(intersects[0].point.x, intersects[0].point.y, sparkColor);

        // Quick body squeeze/bounce animation
        let squeezeTime = 0;
        const squeeze = () => {
          squeezeTime += 0.15;
          if (squeezeTime < Math.PI) {
            const sqVal = 1 - Math.sin(squeezeTime) * 0.12;
            const stretchVal = 1 + Math.sin(squeezeTime) * 0.15;
            nitzGroup.scale.set(stretchVal * phaseScale(), sqVal * phaseScale(), stretchVal * phaseScale());
            requestAnimationFrame(squeeze);
          } else {
            nitzGroup.scale.setScalar(phaseScale());
          }
        };
        squeeze();
      }
    };

    container.addEventListener('click', onCanvasClick);

    // Helpers
    const phaseScale = () => {
      // Evolution index sizing
      const index = phaseRef.current;
      return 0.75 + index * 0.22;
    };

    // --- ANIMATION LOOP ---
    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      const colorVal = EMOTION_COLORS[currentEmotionRef.current];
      const intens = dominantIntensityRef.current;
      const indexPhase = phaseRef.current;

      // 1. Scale & Appearance adjustment base on Phase
      const targetScale = phaseScale();
      const currentScaleGroup = nitzGroup.scale.x;
      const scaleLerp = THREE.MathUtils.lerp(currentScaleGroup, targetScale, 0.08);
      nitzGroup.scale.setScalar(scaleLerp);

      // Check features visibility base on phase
      // Phase 1 (Baby): no accessory, small ears, tight bounds
      // Phase 2-3 (Adolescent): ears, better tail
      // Phase 4-5 (Master Guardian): larger, wings, crown
      if (indexPhase < 2) {
        leftEarJoint.visible = false;
        rightEarJoint.visible = false;
      } else {
        leftEarJoint.visible = true;
        rightEarJoint.visible = true;
        // Ear wiggles based on emotion
        leftEarJoint.rotation.z = -0.4 + Math.sin(time * (2 + intens * 4)) * 0.08 * intens;
        rightEarJoint.rotation.z = 0.4 - Math.sin(time * (2 + intens * 4)) * 0.08 * intens;
      }

      if (indexPhase < 4) {
        crownMesh.visible = false;
      } else {
        crownMesh.visible = true;
        crownMesh.position.y = 1.5 + Math.sin(time * 1.5) * 0.08;
        crownMesh.rotation.y = time * 0.8;
      }

      // Render custom accessories / colors if set
      if (accRef.current !== 'none') {
        crownMesh.visible = true; // halo fallback
        if (accRef.current === 'horn_gold') {
          // make it golden orange
          crownMesh.material = new THREE.MeshPhongMaterial({ color: 0xffaa00, shininess: 200 });
        } else if (accRef.current === 'ribbon') {
          crownMesh.material = new THREE.MeshPhongMaterial({ color: 0xff3b90, shininess: 100 });
        }
      }

      // 2. Idle Floats
      const floatAmp = 0.12;
      const floatSpeed = 1.3 + intens * 0.6;
      nitzGroup.position.y = Math.sin(time * floatSpeed) * floatAmp;
      nitzGroup.rotation.y = Math.sin(time * 0.4) * 0.08;

      // 3. Organic Breathing wiggles
      const breatheSpeed = 1.2 + Math.max(0, (vecValue('Serenidad') || 0) * 0.01);
      const breath = 1.0 + Math.sin(time * breatheSpeed) * (0.04 + (vecValue('Ira') || 0) * 0.0006);
      bodyMesh.scale.set(breath, 1.0 / breath, breath);

      // 4. Aura Glow dynamics
      if (auraMeshRef.current) {
        const auraMat = auraMeshRef.current.material as THREE.MeshBasicMaterial;
        // Aura color matching the dominant emotion
        auraMat.color.setHex(colorVal);
        
        // Glow intensity waves with emotional speed
        const glowWaveSpeed = 2 + intens * 8;
        const pulse = 1.05 + Math.sin(time * glowWaveSpeed) * 0.06 * intens;
        auraMeshRef.current.scale.set(pulse, pulse, pulse);
        auraMat.opacity = 0.15 + Math.max(0, Math.sin(time * 3) * 0.08 * intens);
      }

      // 5. Dynamic Tail wag base on emotion mapping
      if (tailGroupRef.current) {
        // Find tail children
        let segment = tailGroupRef.current.children[0];
        let depth = 0;

        // Tail wag configuration values base on emotion
        let speedMultiplier = 2.0;
        let amplitude = 0.15;

        if (currentEmotionRef.current === 'Alegría' || currentEmotionRef.current === 'Amor') {
          speedMultiplier = 6.0;
          amplitude = 0.28;
        } else if (currentEmotionRef.current === 'Ira') {
          speedMultiplier = 8.5; // frantic
          amplitude = 0.35;
        } else if (currentEmotionRef.current === 'Tristeza' || currentEmotionRef.current === 'Miedo') {
          speedMultiplier = 1.5; // heavy, damp
          amplitude = 0.08;
        } else if (currentEmotionRef.current === 'Serenidad') {
          speedMultiplier = 1.8; // smooth, wavy
          amplitude = 0.18;
        }

        while (segment && depth < 6) {
          const waveAngle = Math.sin(time * speedMultiplier - depth * 0.5) * amplitude * intens;
          segment.rotation.z = waveAngle;
          segment.rotation.y = Math.cos(time * 1.5 + depth * 0.3) * 0.05;

          // Next nested joint along index
          const nextJoint = segment.parent?.children.find((c) => c !== segment);
          segment = nextJoint ? nextJoint.children[0] : (null as any);
          depth++;
        }
      }

      // 6. Blinking / Eye Expressions
      if (eyesGroupRef.current) {
        // Pupil emission glow color tinting
        leftPupil.material.color.setHex(colorVal);
        rightPupil.material.color.setHex(colorVal);

        // Blinking cycle: random fast blink
        const blinkCycle = time % 5.0;
        if (blinkCycle > 4.8 && blinkCycle < 4.95) {
          // Blink! Flatten height scale
          leftEyeSocket.scale.y = 0.08;
          rightEyeSocket.scale.y = 0.08;
          leftPupil.scale.y = 0.08;
          rightPupil.scale.y = 0.08;
        } else {
          // Maintain emotional shape
          if (currentEmotionRef.current === 'Ira') {
            // Angry tilted eyes
            leftEyeSocket.scale.y = 0.8;
            rightEyeSocket.scale.y = 0.8;
            leftEyeSocket.rotation.z = 0.2;
            rightEyeSocket.rotation.z = -0.2;
          } else if (currentEmotionRef.current === 'Tristeza') {
            // Melancholic half closed
            leftEyeSocket.scale.y = 0.55;
            rightEyeSocket.scale.y = 0.55;
            leftEyeSocket.rotation.z = -0.15;
            rightEyeSocket.rotation.z = 0.15;
          } else if (currentEmotionRef.current === 'Sorpresa') {
            // Big rounded eyes
            leftEyeSocket.scale.set(1.4, 1.4, 0.5);
            rightEyeSocket.scale.set(1.4, 1.4, 0.5);
            leftEyeSocket.rotation.z = 0;
            rightEyeSocket.rotation.z = 0;
          } else {
            // Standard
            leftEyeSocket.scale.set(1.25, 1.1, 0.5);
            rightEyeSocket.scale.set(1.25, 1.1, 0.5);
            leftEyeSocket.rotation.z = 0;
            rightEyeSocket.rotation.z = 0;
          }
        }
      }

      // 7. Ambient Particle drift and spiral
      activeParticles.forEach((p) => {
        p.angle += p.orbitSpeed * (1 + intens);
        const radius = p.radiusY;
        p.mesh.position.x = Math.cos(p.angle) * radius;
        p.mesh.position.z = Math.sin(p.angle) * radius;
        p.mesh.position.y += Math.sin(time + p.angle) * 0.003;
        
        // Update color to match emotional aura state
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorVal);
      });

      renderer.render(scene, camera);
    };

    const vecValue = (name: EmotionName) => {
      return emotions[name] || 0;
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const w = container.clientWidth || 400;
      const h = container.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('click', onCanvasClick);
      if (rendererRef.current) {
        container.removeChild(rendererRef.current.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <div 
        ref={containerRef} 
        className="w-full h-full cursor-pointer relative"
        style={{ minHeight: '350px' }}
      />
      {/* 3D Helper Hover tag */}
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 pointer-events-none glass-panel px-4 py-1.5 rounded-full border border-white/10 text-xs text-on-surface-variant font-label-caps bg-surface-container-low/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-md">
        Haz click para Acariciar ✨
      </div>
    </div>
  );
};
