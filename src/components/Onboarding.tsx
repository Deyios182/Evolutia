import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, Shield, Lock } from 'lucide-react';
import { AvatarCustomization } from '../types';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

// Epic Ambient Synthesizer using Web Audio API for generative background music
class CelestialSynth {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private nextNoteTime = 0;
  private chordIndex = 0;
  private schedulerTimer: any = null;

  // Spiritual chord progression: Am9 -> Fmaj9 -> Cmaj9 -> Em9
  private chords = [
    [220.00, 261.63, 329.63, 392.00, 493.88], // Am9
    [174.61, 261.63, 349.23, 392.00, 440.00], // Fmaj9
    [130.81, 261.63, 329.63, 392.00, 493.88], // Cmaj9
    [164.81, 246.94, 329.63, 392.00, 440.00]  // Em9
  ];

  start() {
    if (this.isPlaying) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.isPlaying = true;
      this.nextNoteTime = this.ctx.currentTime;
      this.scheduler();
    } catch (e) {
      console.warn("AudioContext failed to start:", e);
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.schedulerTimer) clearTimeout(this.schedulerTimer);
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  private playNote(freq: number, start: number, duration: number, volume = 0.04, type: OscillatorType = 'sine') {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, start);
    filter.frequency.exponentialRampToValueAtTime(1200, start + 0.15);
    filter.frequency.exponentialRampToValueAtTime(250, start + duration);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.start(start);
    osc.stop(start + duration);
  }

  private scheduler() {
    if (!this.isPlaying || !this.ctx) return;
    while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
      const chord = this.chords[this.chordIndex];
      const time = this.nextNoteTime;

      // Deep root pad bass (rarely triggered)
      if (Math.random() < 0.2) {
        this.playNote(chord[0] * 0.5, time, 4.5, 0.05, 'triangle');
      }

      // Main arpeggio voice
      const noteIndex = Math.floor(Math.random() * (chord.length - 1)) + 1;
      const noteFreq = chord[noteIndex];
      this.playNote(noteFreq, time, 2.0, 0.03, 'sine');

      // Celestial bells
      if (Math.random() < 0.45) {
        this.playNote(noteFreq * 2, time, 0.9, 0.015, 'sine');
      }

      this.nextNoteTime += 0.45;

      // Transition chords slowly
      if (Math.random() < 0.08) {
        this.chordIndex = (this.chordIndex + 1) % this.chords.length;
      }
    }
    this.schedulerTimer = setTimeout(() => this.scheduler(), 100);
  }
}

interface OnboardingProps {
  onComplete: (username: string, avatar: AvatarCustomization) => void;
  isLoggedIn: boolean;
  onLogin: (name: string) => void;
  initialUsername?: string;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, isLoggedIn, onLogin, initialUsername }) => {
  const [step, setStep] = useState<number>(0); // Start at step 0 for the title screen
  const [username, setUsername] = useState<string>(initialUsername || '');
  const [nitzName, setNitzName] = useState<string>('Nitz de Origen');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  
  // Customization presets
  const [accessory, setAccessory] = useState<AvatarCustomization['accessory']>('none');
  const [auraType, setAuraType] = useState<AvatarCustomization['auraType']>('stellar');
  const [colorTheme, setColorTheme] = useState<AvatarCustomization['colorTheme']>('classic');
  const [clothing, setClothing] = useState<AvatarCustomization['clothing']>('none');

  const synthRef = useRef<CelestialSynth | null>(null);

  // Play mistic chime sound using Web Audio API
  const playCelestialChime = (freqs = [523.25, 659.25, 783.99, 1046.50]) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.15);
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + idx * 0.15 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + idx * 0.15 + 0.82);
        
        osc.start(audioCtx.currentTime + idx * 0.15);
        osc.stop(audioCtx.currentTime + idx * 0.15 + 0.85);
      });
    } catch (e) {
      // Audio context disabled
    }
  };

  useEffect(() => {
    // Subtle entry bell sound
    playCelestialChime([392.00, 523.25, 659.25]);
    return () => {
      if (synthRef.current) {
        synthRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (initialUsername && !username) {
      setUsername(initialUsername);
    }
  }, [initialUsername]);

  const handleStartGame = () => {
    playCelestialChime([523.25, 659.25, 783.99, 1046.50]);
    if (!synthRef.current) {
      synthRef.current = new CelestialSynth();
    }
    synthRef.current.start();
    setStep(1);
  };

  const handleNextStep = () => {
    playCelestialChime([523.25, 659.25, 783.99]);
    if (step < 3) {
      setStep(prev => prev + 1);
    } else {
      if (synthRef.current) {
        synthRef.current.stop();
      }
      onComplete(username || 'Guardián Celestial', {
        name: nitzName || 'Nitz de Origen',
        accessory,
        auraType,
        colorTheme,
        clothing,
      });
    }
  };

  // Trigger real Google Sign In
  const handleGoogleConnect = async () => {
    setIsAuthenticating(true);
    playCelestialChime([440, 554, 659]);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const finalName = user.displayName || user.email || 'Guardián Celestial';
      setUsername(finalName);
      onLogin(finalName);
      setStep(3); // Auto proceed to customization
      playCelestialChime([523, 659, 783, 1046]);
    } catch (err) {
      console.error('Error signing in with Google in Onboarding:', err);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSkipToAuth = () => {
    playCelestialChime([261.63, 329.63, 392.00]);
    setStep(2);
  };

  const getThemePreviewBg = () => {
    switch (colorTheme) {
      case 'classic': return 'from-cyan-500/20 to-blue-500/30 border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.15)]';
      case 'abyssal': return 'from-purple-500/20 to-indigo-500/30 border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.15)]';
      case 'solstice': return 'from-yellow-500/20 to-orange-500/30 border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.15)]';
      case 'primeval': return 'from-emerald-500/20 to-teal-500/30 border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.15)]';
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#05060f] text-[#e0e0fa] overflow-hidden px-4 md:px-8 py-10 selection:bg-[#dec1ac]/30">
      
      {/* Background Image transitions based on step */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="bg_step0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0 }}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url('/assets/media__1782497767808.jpg')" }}
            />
          )}
          {step === 1 && (
            <motion.div
              key="bg_step1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.22 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0 }}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url('/assets/media__1782497767554.jpg')" }}
            />
          )}
          {step === 2 && (
            <motion.div
              key="bg_step2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.18 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0 }}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url('/assets/media__1782497767781.jpg')" }}
            />
          )}
          {step === 3 && (
            <motion.div
              key="bg_step3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.18 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0 }}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: "url('/assets/media__1782497767828.jpg')" }}
            />
          )}
        </AnimatePresence>

        {/* Ambient Dark Overlay with soft blur */}
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[3px]" />

        {/* Floating Sparks/Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          {[...Array(30)].map((_, i) => {
            const size = Math.random() * 4 + 2;
            const left = Math.random() * 100;
            const delay = Math.random() * 8;
            const duration = Math.random() * 12 + 8;
            return (
              <div
                key={i}
                className="absolute rounded-full bg-[#dec1ac]/30 blur-[1px] animate-float-particles"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  left: `${left}%`,
                  bottom: `-20px`,
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`,
                }}
              />
            );
          })}
        </div>

        {/* Sky Dust stars */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px]" />
      </div>

      {/* Narrative Card Container */}
      <div className="relative z-10 w-full max-w-4xl bg-gradient-to-b from-[#101222]/95 to-[#0a0b14]/98 p-6 md:p-10 rounded-2xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.85)] overflow-hidden transition-all">
        
        {/* Title glow line */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#dec1ac]/50 to-transparent" />

        <AnimatePresence mode="wait">
          
          {/* Step 0: Title Cover artwork screen */}
          {step === 0 && (
            <motion.div
              key="start_screen"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center justify-center text-center space-y-8 py-4"
            >
              {/* Cover Artwork */}
              <div className="relative w-full max-w-xl aspect-video rounded-xl overflow-hidden border border-cyan-500/20 shadow-[0_0_40px_rgba(6,182,212,0.1)] bg-slate-950">
                <img 
                  src="/assets/media__1782497767808.jpg" 
                  alt="Evolutia Logo Cover" 
                  className="w-full h-full object-cover opacity-90 scale-100 hover:scale-103 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0b14] via-transparent to-transparent" />
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl md:text-6xl font-black font-headline tracking-widest bg-gradient-to-r from-white via-[#dec1ac] to-[#ceaa92] bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                  EVOLUTIA
                </h1>
                <p className="text-[#dec1ac] font-mono text-xs uppercase tracking-widest font-extrabold flex items-center justify-center gap-1.5 animate-pulse">
                  <span>🐾</span> Crónicas del Origen <span>•</span> Despertar Espiritual
                </p>
              </div>

              <button
                onClick={handleStartGame}
                className="px-10 py-4 bg-gradient-to-r from-[#dec1ac] to-[#ceaa92] hover:from-white hover:to-white text-black font-black uppercase text-xs rounded-full tracking-widest transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(222,193,172,0.3)] cursor-pointer flex items-center gap-2"
              >
                <span>Despertar el Alma</span>
                <Sparkles className="w-4 h-4 text-black animate-pulse" />
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-12 bg-[#dec1ac] rounded-full shadow-[0_0_20px_rgba(222,193,172,0.6)]" />
                <div>
                  <span className="text-[#dec1ac] font-mono text-[10px] tracking-widest block mb-1 uppercase">Capítulo I: El despertar primordial</span>
                  <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white to-[#a3a5c2] bg-clip-text text-transparent">
                    Antes de todo existía el Silencio...
                  </h1>
                </div>
              </div>

              <div className="text-gray-300 font-sans leading-relaxed text-sm md:text-base space-y-4 max-w-3xl">
                <p>
                  En las grietas del espacio celeste, donde el tiempo es ágrafo y la gravedad duerme, las primeras chispas de <strong className="text-white font-semibold">Evolutia</strong> comenzaron a reverberar. No era materia, ni era vacío; era pura resonancia sentimental.
                </p>
                <p>
                  Los Nitz cobijan este letargo místico. Carecen de una forma inmutable; son arcilla viva de ánima que wiggles, respira y muta de acuerdo con las sintonías, duelos e ideales del Guardián que los guíe en su camino sagrado.
                </p>
                <div className="border-l-2 border-[#dec1ac]/40 pl-4 py-2 italic text-[#dec1ac] bg-white/5 rounded-r p-3 text-xs md:text-sm">
                  "Se busca un Guardián de la Esencia: una voluntad intrépida capaz de moldear las frecuencias sentimentales, forjar armas de asalto y construir cabañas eternas sobre los cimientos sagrados de la Aldea."
                </div>
              </div>

              <div className="flex items-center gap-4 pt-6 border-t border-white/5 flex-wrap">
                <button 
                  onClick={handleNextStep}
                  className="px-8 py-3.5 bg-[#dec1ac] hover:bg-white text-black font-extrabold rounded-full flex items-center gap-2 group transition-all duration-300 transform active:scale-95 shadow-[0_0_20px_rgba(222,193,172,0.3)]"
                >
                  Continuar Despertar
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
                <button 
                  onClick={handleSkipToAuth}
                  className="px-6 py-3.5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 rounded-full font-mono text-xs tracking-wider transition-all duration-300"
                >
                  Omitir Prólogo
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="auth_gate"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-12 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.5)]" />
                <div>
                  <span className="text-indigo-400 font-mono text-[10px] tracking-widest block mb-1 uppercase">Capítulo II: Sincronización del Alma</span>
                  <h2 className="text-2xl md:text-4xl font-extrabold text-white">Sincroniza tu Identidad</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-7 space-y-4 text-gray-300 text-sm">
                  <p>
                    Para restaurar las crónicas sagradas, forjar tus tónicos y sincronizar tus terrenos en el Vecindario, debemos vincular un perfil celestial.
                  </p>
                  <p>
                    El enlace con el sistema de <strong className="text-white">Google Cloud</strong> mantendrá tu progreso intacto y te permitirá interactuar con el Lobby de jugadores en tiempo real.
                  </p>

                  {/* Anime Character Artwork integration */}
                  <div className="w-full h-36 rounded-xl overflow-hidden border border-indigo-500/20 shadow-lg relative bg-slate-950">
                    <img 
                      src="/assets/media__1782497767681.jpg" 
                      alt="Guardián Místico" 
                      className="w-full h-full object-cover opacity-85 hover:scale-103 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#101222] via-transparent to-transparent" />
                  </div>

                  <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-lg text-xs text-indigo-300 flex items-start gap-2.5">
                    <Shield className="w-5 h-5 flex-shrink-0 text-indigo-400 mt-0.5" />
                    <span>Tu progreso se almacenará de manera segura en tu perfil de Google en la nube y se cargará automáticamente al ingresar.</span>
                  </div>
                </div>

                <div className="md:col-span-5 bg-black/45 border border-white/5 rounded-xl p-6 flex flex-col justify-between space-y-5 shadow-inner">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                      <Lock className="w-6 h-6 animate-pulse" />
                    </div>
                    <span className="text-xs uppercase font-bold text-gray-400 block tracking-widest font-mono">Registro en Línea</span>
                  </div>

                  {isAuthenticating ? (
                    <div className="text-center py-4 space-y-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-indigo-300 font-mono animate-pulse">Sincronizando Archivos Celestes...</p>
                    </div>
                  ) : isLoggedIn ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs text-center font-semibold">
                        ✓ Conexión en la Nube Establecida ({username})
                      </div>
                      <button
                        onClick={() => setStep(3)}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-lg text-xs transition active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <span>Ir a Personalizar Avatar</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        onClick={handleGoogleConnect}
                        className="w-full py-3 bg-white text-black hover:bg-neutral-100 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2.5 transition active:scale-95 shadow-lg cursor-pointer"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path
                            fill="#EA4335"
                            d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.11C18.281 1.945 15.539.8 12.24.8 6.008.8.96 5.823.96 12s5.048 11.2 11.28 11.2c6.51 0 10.823-4.57 10.823-11.023 0-.74-.08-1.305-.176-1.892H12.24z"
                          />
                        </svg>
                        <span>Conectarse con Google</span>
                      </button>

                      <div className="relative text-center">
                        <span className="text-[10px] uppercase font-mono text-gray-500 bg-[#0c0d1b] px-3 relative z-10">O Continuar Local</span>
                        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/5" />
                      </div>

                      <button
                        onClick={() => {
                          setUsername('Guardián Local');
                          setStep(3);
                          playCelestialChime([329.63, 392.00, 523.25]);
                        }}
                        className="w-full py-2.5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg text-xs font-mono transition-all cursor-pointer"
                      >
                        Iniciar Modo Offline (Local)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="customizer"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <span className="text-[#dec1ac] font-mono text-[10px] tracking-widest block mb-1 uppercase">Capítulo III: Frecuencia de Almas</span>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white">Configura tu Frecuencia Espiritual</h2>
                </div>
                {isLoggedIn && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-mono uppercase">
                    Sesión Google Activa
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-2">
                
                {/* 3D-Look Preview Box of the customized Nitz on the left */}
                <div className="lg:col-span-5 flex flex-col justify-between bg-[#14162a] border border-white/10 rounded-xl p-5 overflow-hidden relative shadow-inner min-h-[320px]">
                  <div className="z-10 text-center">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-[#dec1ac] bg-black/40 px-2 py-1 rounded border border-white/5">
                      Visualizador de Frecuencia Sentimental
                    </span>
                  </div>

                  {/* Procedural glowing visual element representing the Nitz being custom created */}
                  <div className="my-auto flex items-center justify-center relative">
                    <div className={`w-32 h-32 rounded-full bg-gradient-to-tr ${getThemePreviewBg()} transition-all duration-500 flex items-center justify-center relative border shadow-2xl`}>
                      {/* Interactive aura ring based on choices */}
                      {auraType !== 'none' && (
                        <div className={`absolute inset-0 border-2 rounded-full border-dashed animate-spin border-white/30 ${
                          auraType === 'stellar' ? 'scale-125 border-cyan-400/40' :
                          auraType === 'vortex' ? 'scale-110 border-indigo-400' :
                          'scale-[1.18] border-yellow-300/40 animate-ping'
                        }`} style={{ animationDuration: '6s' }} />
                      )}

                      {/* Head accessory display */}
                      {accessory === 'halo' && (
                        <div className="absolute top-3 w-16 h-3 bg-amber-400/30 border border-amber-300 rounded-full animate-bounce shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                      )}
                      {accessory === 'horn_gold' && (
                        <div className="absolute top-1 rotate-45 w-4 h-7 bg-gradient-to-t from-yellow-500 to-amber-300 rounded-tr-full shadow-[0_0_12px_rgba(245,158,11,0.4)]" />
                      )}
                      {accessory === 'ribbon' && (
                        <div className="absolute top-4 flex gap-1 animate-pulse">
                          <span className="w-3 h-3 bg-pink-500 rounded-full" />
                          <span className="w-3 h-3 bg-pink-500 rounded-full" />
                        </div>
                      )}

                      {/* Outer clothes visuals */}
                      {clothing !== 'none' && (
                        <div className="absolute bottom-2 inset-x-4 h-8 bg-white/10 rounded-b-full border-t border-white/20 flex items-center justify-center text-[9px] text-[#dec1ac] font-mono leading-none">
                          {clothing === 'shawl' ? 'Chal Místico' : clothing === 'armor_shard' ? 'Coraza Rígida' : 'Sello de Sabio'}
                        </div>
                      )}

                      {/* Fluffy wiggle animation center */}
                      <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/25 flex flex-col justify-center items-center font-mono font-black text-xs text-glow-silver tracking-tight">
                        <span className="animate-pulse">{nitzName.slice(0, 8) || 'Nitz'}</span>
                        <span className="text-[9px] text-gray-400 font-normal">PH 1</span>
                      </div>
                    </div>
                  </div>

                  {/* El Nitz adopta forma libre y no tiene especie fija */}

                  <div className="z-10 text-center space-y-1 mt-4">
                    <input 
                      type="text" 
                      value={nitzName} 
                      onChange={(e) => setNitzName(e.target.value.slice(0, 24))}
                      placeholder="Nombra a tu compañero Nitz..."
                      className="w-full text-center bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs placeholder-gray-500 outline-none focus:border-[#dec1ac] font-bold"
                    />
                    <p className="text-[10px] text-gray-400">Personaliza libremente el nombre de tu compañero Nitz.</p>
                  </div>
                </div>

                {/* Editors panel tabs */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Head items accessor */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">Prenda de Cabeza / Rostro</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'none', label: 'Ninguno' },
                          { id: 'halo', label: 'Halo Áureo ✨' },
                          { id: 'horn_gold', label: 'Cuerno Destellante 🦄' },
                          { id: 'ribbon', label: 'Lazo Esencia 🎀' }
                        ].map((acc) => (
                          <button
                            key={acc.id}
                            onClick={() => { setAccessory(acc.id as any); playCelestialChime([659]); }}
                            className={`p-2.5 rounded text-xs transition border text-left cursor-pointer ${accessory === acc.id ? 'bg-[#dec1ac]/10 text-white border-[#dec1ac]' : 'bg-[#181a30] text-gray-400 border-white/5 hover:border-white/15'}`}
                          >
                            {acc.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Aura Type select */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">Frecuencia de Aura</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'stellar', label: 'Estelar Cósmica ⭐' },
                          { id: 'vortex', label: 'Vórtice Abisal 🌀' },
                          { id: 'sparkles', label: 'Destello Ánima ✨' },
                          { id: 'none', label: 'Sin Aura' }
                        ].map((au) => (
                          <button
                            key={au.id}
                            onClick={() => { setAuraType(au.id as any); playCelestialChime([440]); }}
                            className={`p-2.5 rounded text-xs transition border text-left cursor-pointer ${auraType === au.id ? 'bg-[#dec1ac]/10 text-white border-[#dec1ac]' : 'bg-[#181a30] text-gray-400 border-white/5 hover:border-white/15'}`}
                          >
                            {au.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color tone receptor */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">Gama Cromática (Alma)</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'classic', label: 'Celeste / Azul 💧' },
                          { id: 'abyssal', label: 'Violeta / Ícaro 🔮' },
                          { id: 'solstice', label: 'Oro / Solsticio ☀️' },
                          { id: 'primeval', label: 'Rubí / Fuego 🔥' }
                        ].map((cl) => (
                          <button
                            key={cl.id}
                            onClick={() => { setColorTheme(cl.id as any); playCelestialChime([523, 783]); }}
                            className={`p-2.5 rounded text-xs transition border text-left cursor-pointer ${colorTheme === cl.id ? 'bg-[#dec1ac]/10 text-white border-[#dec1ac]' : 'bg-[#181a30] text-gray-400 border-white/5 hover:border-white/15'}`}
                          >
                            {cl.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Clothing select */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">Vestiduras Místicas</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'none', label: 'Arquetipo Desnudo ❄️' },
                          { id: 'shawl', label: 'Chal de Origen 🧣' },
                          { id: 'armor_shard', label: 'Escamas Coraza 🛡️' },
                          { id: 'robe_sage', label: 'Manto de Sabio 🎓' }
                        ].map((clt) => (
                          <button
                            key={clt.id}
                            onClick={() => { setClothing(clt.id as any); playCelestialChime([392, 523]); }}
                            className={`p-2.5 rounded text-xs transition border text-left cursor-pointer ${clothing === clt.id ? 'bg-[#dec1ac]/10 text-white border-[#dec1ac]' : 'bg-[#181a30] text-gray-400 border-white/5 hover:border-white/15'}`}
                          >
                            {clt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                  <div className="flex gap-3 pt-4 border-t border-white/5">
                    <button
                      onClick={handleNextStep}
                      disabled={!nitzName.trim()}
                      className="flex-1 py-3.5 bg-gradient-to-r from-[#dec1ac] to-[#ceaa92] text-black disabled:opacity-40 font-extrabold rounded-xl transition active:scale-95 text-center flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Despertar en la Aldea Nitz</span>
                      <Sparkles className="w-4 h-4 text-black animate-pulse" />
                    </button>
                    <button
                      onClick={() => setStep(2)}
                      className="px-6 py-3.5 border border-white/10 text-gray-400 hover:text-white rounded-xl text-xs transition cursor-pointer"
                    >
                      Atrás
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="absolute bottom-4 text-[10px] text-gray-600 uppercase tracking-widest text-center w-full z-10 pointer-events-none font-mono">
        © 2026 EVOLUTIA: CRÓNICAS DEL ORIGEN • EXPERIENCIA MÍSTICA DE JUEGO EN LA NUBE
      </footer>
    </div>
  );
};
