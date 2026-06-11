import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Compass, 
  Swords, 
  BookOpen, 
  Music, 
  Sparkles, 
  Trophy, 
  RotateCcw, 
  Award, 
  ShieldAlert,
  Map,
  Hammer,
  Users
} from 'lucide-react';
import { GameView, EmotionVector, PlayerProgress, AvatarCustomization, GatheringInventory, CraftableItem } from './types';
import { Onboarding } from './components/Onboarding';
import { MyHome } from './components/MyHome';
import { Lobby } from './components/Lobby';
import { BattleArena } from './components/BattleArena';
import { Minigame } from './components/Minigame';
import { Codex } from './components/Codex';
import { GoogleAuthButton } from './components/GoogleAuthButton';
import { Crafting } from './components/Crafting';
import { MundoAbierto } from './components/MundoAbierto';
import { Vecindario } from './components/Vecindario';
import { FirstPersonWorld } from './components/FirstPersonWorld';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const INITIAL_EMOTIONS: EmotionVector = {
  Ira: 10,
  Miedo: 10,
  Tristeza: 15,
  Alegría: 40,
  Confianza: 30,
  Sorpresa: 20,
  Amor: 35,
  Orgullo: 15,
  Serenidad: 25,
};

const DEFAULT_INVENTORY: GatheringInventory = {
  wood: { common: 5, rare: 2, epic: 0, legendary: 0 },
  stone: { common: 4, rare: 1, epic: 0, legendary: 0 },
  metal: { common: 2, rare: 0, epic: 0, legendary: 0 },
  essence: { common: 3, rare: 0, epic: 0, legendary: 0 },
};

const DEFAULT_PROGRESS: PlayerProgress = {
  isLoggedIn: false,
  username: '',
  avatarUrl: '',
  gold: 150,
  exp: 0,
  avatar: {
    name: 'Nitz de Origen',
    accessory: 'none',
    auraType: 'stellar',
    colorTheme: 'classic',
    clothing: 'none',
  },
  phase: 1,
  emotions: INITIAL_EMOTIONS,
  interactionCount: 0,
  unlockedArchetypes: ['arch_joy'],
  inventory: DEFAULT_INVENTORY,
  craftedItems: [
    { id: 'start_sword', name: 'Espada de Novicio', type: 'equipment', subType: 'weapon', rarity: 'common', statBonus: '+5% Fuerza Física', equipped: true },
    { id: 'init_decor_table', name: 'Mesa de Cedro Común', type: 'furniture', rarity: 'common', placed: true }
  ],
  houseDecorations: [
    { itemId: 'init_decor_table', slot: 1 }
  ]
};

export default function App() {
  const [progress, setProgress] = useState<PlayerProgress>(DEFAULT_PROGRESS);
  const [currentView, setCurrentView] = useState<GameView>('onboarding');
  const [initLoaded, setInitLoaded] = useState(false);
  const [activeNotifier, setActiveNotifier] = useState<string | null>(null);

  const getDominantOfProgress = (p: PlayerProgress): { name: string; value: number } => {
    let maxName = 'Alegría';
    let maxValue = -1;
    (Object.keys(p.emotions) as Array<keyof EmotionVector>).forEach((key) => {
      if (p.emotions[key] > maxValue) {
        maxValue = p.emotions[key];
        maxName = key;
      }
    });
    return { name: maxName, value: maxValue };
  };

  // Listen to Auth changes in real time (Firebase Session Persistence)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is authenticated in Firebase
        const userRef = doc(db, 'users', user.uid);
        try {
          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
            const cloudData = docSnap.data();
            const merged: PlayerProgress = {
              ...DEFAULT_PROGRESS,
              ...cloudData,
              isLoggedIn: true,
              username: cloudData.username || user.displayName || 'Guardián Místico',
              avatarUrl: user.photoURL || '',
            };
            setProgress(merged);
            // Only navigate away from onboarding if they already had a username set in cloudData
            if (merged.username) {
              setCurrentView(v => v !== 'onboarding' ? 'first_person' : v);
            }
            triggerNotification(`¡Sincronización en la nube lista para ${merged.username}!`);
          } else {
            // New user, write current progress or default progress
            const currentLocal = localStorage.getItem('evolutia_progress_v3');
            let baseProg = DEFAULT_PROGRESS;
            if (currentLocal) {
              try { baseProg = JSON.parse(currentLocal); } catch(e){}
            }
            const initialProg: PlayerProgress = {
              ...baseProg,
              isLoggedIn: true,
              username: baseProg.username || user.displayName || 'Guardián Místico',
              avatarUrl: user.photoURL || '',
            };
            setProgress(initialProg);
            // Let them stay in onboarding to customize their avatar if they are currently there
            setCurrentView(v => v !== 'onboarding' ? 'first_person' : v);
          }
        } catch (err) {
          console.error("Error loading account progress:", err);
          try {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          } catch (e) {
            // Keep it caught so it does not block application operations
          }
          // Fallback: visually keep the user asLoggedIn: true so the header buttons doesn't bug out
          setProgress(prev => ({
            ...prev,
            isLoggedIn: true,
            username: user.displayName || user.email || 'Guardián Místico',
            avatarUrl: user.photoURL || '',
          }));
          setCurrentView(v => v !== 'onboarding' ? 'home' : v);
        }
      } else {
        // Logged out: restore offline file progress if available
        const data = localStorage.getItem('evolutia_progress_v3');
        if (data) {
          try {
            const parsed = JSON.parse(data);
            const merged: PlayerProgress = {
              ...DEFAULT_PROGRESS,
              ...parsed,
              isLoggedIn: false,
              avatar: {
                ...DEFAULT_PROGRESS.avatar,
                ...(parsed.avatar || {})
              },
              inventory: {
                ...DEFAULT_PROGRESS.inventory,
                ...(parsed.inventory || {})
              },
              craftedItems: parsed.craftedItems || DEFAULT_PROGRESS.craftedItems,
              houseDecorations: parsed.houseDecorations || DEFAULT_PROGRESS.houseDecorations,
            };
            setProgress(merged);
            if (parsed.username) {
              setCurrentView('home');
            } else {
              setCurrentView('onboarding');
            }
          } catch (err) {
            console.error('Error restoring local offline progress:', err);
            setCurrentView('onboarding');
          }
        } else {
          setProgress(prev => ({
            ...prev,
            isLoggedIn: false,
          }));
          setCurrentView('onboarding');
        }
      }
      setInitLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  // Persist progress to local storage and sync to Firestore if authenticated
  const saveProgress = async (newProg: PlayerProgress) => {
    setProgress(newProg);
    localStorage.setItem('evolutia_progress_v3', JSON.stringify(newProg));
    
    if (auth.currentUser) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userRef, {
          ...newProg,
          status: 'online',
          dominantEmotion: getDominantOfProgress(newProg).name,
          lastActive: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error saving progress to Cloud Firestore:", err);
        try {
          handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}`);
        } catch (e) {
          // Keep it caught so it does not block application operations
        }
      }
    }
  };

  // Helper trigger notification toast
  const triggerNotification = (text: string) => {
    setActiveNotifier(text);
    setTimeout(() => {
      setActiveNotifier(null);
    }, 4000);
  };

  const handleOnboardingComplete = async (username: string, avatar: AvatarCustomization) => {
    const updated: PlayerProgress = {
      ...progress,
      username,
      avatar,
      isLoggedIn: progress.isLoggedIn || !!auth.currentUser,
    };
    await saveProgress(updated);
    setCurrentView('first_person');
    triggerNotification(`¡Bienvenido Guardián ${username}! Tu Nitz ha despertado.`);
  };

  const handleLogin = (googleUsername: string) => {
    setProgress(prev => {
      const updated = {
        ...prev,
        isLoggedIn: true,
        username: googleUsername
      };
      localStorage.setItem('evolutia_progress_v3', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLogout = () => {
    triggerNotification('Sesión Google desconectada.');
    setProgress(prev => {
      const updated = {
        ...prev,
        isLoggedIn: false
      };
      localStorage.setItem('evolutia_progress_v3', JSON.stringify(updated));
      return updated;
    });
  };

  // Spent Gold & earned EXP parameters helper
  const handleSpendGold = (amount: number, expGained: number): boolean => {
    if (progress.gold < amount) return false;
    
    // Calculate new exp
    const nextExp = progress.exp + expGained;
    
    const updated: PlayerProgress = {
      ...progress,
      gold: progress.gold - amount,
      exp: nextExp,
    };
    saveProgress(updated);
    if (amount > 0) {
      triggerNotification(`Compraste tónico místico por -${amount}g. Ganaste +15 EXP.`);
    } else if (expGained > 0) {
      triggerNotification(`¡Habilidad mística ejercitada! Ganaste +${expGained} EXP.`);
    }
    return true;
  };

  const handleMinigameReward = (goldGained: number, expGained: number) => {
    const updated: PlayerProgress = {
      ...progress,
      gold: progress.gold + goldGained,
      exp: progress.exp + expGained,
    };
    saveProgress(updated);
    triggerNotification(`¡Sintonía Exitosa! Ganaste +${goldGained} Oro y +${expGained} EXP.`);
  };

  const handleEmotionBoost = (emotion: string, amount: number) => {
    setProgress((prev) => {
      const nextEmotions = { ...prev.emotions };
      const key = emotion as keyof EmotionVector;
      nextEmotions[key] = Math.min(100, nextEmotions[key] + amount);
      const next = { ...prev, emotions: nextEmotions };
      localStorage.setItem('evolutia_progress_v3', JSON.stringify(next));
      return next;
    });
  };

  const handleUpdateEmotionsDirectly = (updater: (prev: EmotionVector) => EmotionVector) => {
    setProgress((prev) => {
      const updatedEmotions = updater(prev.emotions);
      
      // Calculate unlocked archetypes
      const unlockedSet = new Set(prev.unlockedArchetypes);
      // Joy check > 65
      if (updatedEmotions.Alegría > 65) unlockedSet.add('arch_joy');
      if (updatedEmotions.Amor > 65) unlockedSet.add('arch_love');
      if (updatedEmotions.Ira > 65) unlockedSet.add('arch_anger');
      if (updatedEmotions.Miedo > 65) unlockedSet.add('arch_fear');
      if (updatedEmotions.Serenidad > 65) unlockedSet.add('arch_serenity');
      if (updatedEmotions.Tristeza > 65) unlockedSet.add('arch_tristeza');
      if (updatedEmotions.Confianza > 65) unlockedSet.add('arch_trust');
      if (updatedEmotions.Sorpresa > 65) unlockedSet.add('arch_surp');
      if (updatedEmotions.Orgullo > 65) unlockedSet.add('arch_pride');

      const next = { 
        ...prev, 
        emotions: updatedEmotions,
        unlockedArchetypes: Array.from(unlockedSet)
      };
      localStorage.setItem('evolutia_progress_v3', JSON.stringify(next));
      return next;
    });
  };

  const handleOnEvolve = () => {
    if (progress.phase >= 5) return;
    const nextPhase = progress.phase + 1;
    
    // Deduct exp
    const updated: PlayerProgress = {
      ...progress,
      phase: nextPhase,
      exp: Math.max(0, progress.exp - progress.phase * 40)
    };
    saveProgress(updated);
    triggerNotification(`¡Tu Nitz ha mutado con éxito a la FASE ${nextPhase}!`);
  };

  const handleResetProgress = async () => {
    const confirm = window.confirm('¿Deseas reiniciar todas las Crónicas de Evolutia y restaurar el estado original del prólogo?');
    if (!confirm) return;
    
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (e) {
      console.error("Error signing out during reset:", e);
    }
    
    saveProgress({
      ...DEFAULT_PROGRESS,
      isLoggedIn: false
    });
    setCurrentView('onboarding');
    triggerNotification('Se reinició el compendio místico primordial y tu sesión Google.');
  };

  const getDominant = (): { name: string; value: number } => {
    let maxName = 'Alegría';
    let maxValue = -1;
    (Object.keys(progress.emotions) as Array<keyof EmotionVector>).forEach((key) => {
      if (progress.emotions[key] > maxValue) {
        maxValue = progress.emotions[key];
        maxName = key;
      }
    });
    return { name: maxName, value: maxValue };
  };

  const { name: dominantName } = getDominant();

  if (!initLoaded) {
    return (
      <div className="min-h-screen bg-[#070913] text-white flex items-center justify-center font-mono">
        <div className="text-center space-y-4">
          <Sparkles className="w-12 h-12 text-tertiary animate-spin mx-auto" />
          <p className="uppercase tracking-widest text-[11px] text-[#dec1ac]">Sintonizando frecuencias estelares...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#070912] text-white flex flex-col font-sans selection:bg-tertiary/25 scroll-smooth">
      {/* Absolute floating toast notifier to reflect actions */}
      <AnimatePresence>
        {activeNotifier && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 glass-panel bg-[#15182e]/95 border-tertiary/50 border py-3 px-6 rounded-full flex items-center gap-2 shadow-2xl"
          >
            <Sparkles className="w-4 h-4 text-tertiary animate-bounce" />
            <span className="text-xs font-semibold text-white tracking-wide">{activeNotifier}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render Onboarding sequence if view is onboarding */}
      {currentView === 'onboarding' ? (
        <Onboarding 
          onComplete={handleOnboardingComplete} 
          isLoggedIn={progress.isLoggedIn}
          onLogin={handleLogin}
          initialUsername={progress.username}
        />
      ) : (
        <>
          {/* Main Social / Caring Dashboard Header */}
          <header className="relative z-10 border-b border-white/5 bg-[#121424]/90 backdrop-blur-md px-4 md:px-8 py-3.5 flex flex-col lg:flex-row gap-4 items-center justify-between sticky top-0 shadow-lg">
            
            {/* Logo and Brand Identity */}
            <div className="flex items-center gap-3">
              <span className="w-1 h-8 bg-tertiary rounded-full shadow-[0_0_10px_#dec1ac]" />
              <div className="cursor-pointer" onClick={() => setCurrentView('home')}>
                <h1 className="text-xl md:text-2xl font-bold tracking-widest font-headline-lg text-glow-silver bg-gradient-to-r from-white via-[#c4c5da] to-[#8a8b9e] bg-clip-text text-transparent">
                  EVOLUTIA
                </h1>
                <span className="text-[9px] uppercase tracking-wider block text-tertiary font-semibold -mt-1 font-mono">CRÓNICAS DEL ORIGEN</span>
              </div>
            </div>

            {/* View Switcher Controls */}
            <nav className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setCurrentView('first_person')}
                className={`px-3 md:px-5 py-2 rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                  currentView === 'first_person' 
                    ? 'bg-gradient-to-r from-amber-400 to-[#dec1ac] text-slate-950 font-black shadow-[0_0_15px_rgba(222,193,172,0.4)]' 
                    : 'bg-white/5 border border-white/10 text-on-surface-variant hover:text-white hover:bg-white/10'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 animate-bounce text-slate-950" />
                <span>MUNDO 3D INMERSIVO 🌍</span>
              </button>
              <button
                onClick={() => setCurrentView('home')}
                className={`px-3 md:px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentView === 'home' 
                    ? 'bg-[#dec1ac]/15 border border-tertiary text-[#dec1ac] shadow' 
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Cabaña</span>
              </button>
              <button
                onClick={() => setCurrentView('lobby')}
                className={`px-3 md:px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentView === 'lobby' 
                    ? 'bg-[#dec1ac]/15 border border-tertiary text-[#dec1ac] shadow' 
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Lobby</span>
              </button>
              <button
                onClick={() => setCurrentView('open_world')}
                className={`px-3 md:px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentView === 'open_world' 
                    ? 'bg-[#dec1ac]/15 border border-tertiary text-[#dec1ac] shadow' 
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                <span>Mundo</span>
              </button>
              <button
                onClick={() => setCurrentView('vecindario')}
                className={`px-3 md:px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentView === 'vecindario' 
                    ? 'bg-[#dec1ac]/15 border border-tertiary text-[#dec1ac] shadow' 
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Vecindario</span>
              </button>
              <button
                onClick={() => setCurrentView('crafting')}
                className={`px-3 md:px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentView === 'crafting' 
                    ? 'bg-[#dec1ac]/15 border border-tertiary text-[#dec1ac] shadow' 
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                <span>Forja</span>
              </button>
              <button
                onClick={() => setCurrentView('minigame')}
                className={`px-3 md:px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentView === 'minigame' 
                    ? 'bg-[#dec1ac]/15 border border-tertiary text-[#dec1ac] shadow' 
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>Sintonía</span>
              </button>
              <button
                onClick={() => setCurrentView('battle')}
                className={`px-3 md:px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentView === 'battle' 
                    ? 'bg-[#dec1ac]/15 border border-tertiary text-[#dec1ac] shadow' 
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Arena</span>
              </button>
              <button
                onClick={() => setCurrentView('codex')}
                className={`px-3 md:px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  currentView === 'codex' 
                    ? 'bg-[#dec1ac]/15 border border-tertiary text-[#dec1ac] shadow' 
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Códice</span>
              </button>
            </nav>

            {/* Google Authentication component & resetting */}
            <div className="flex items-center gap-3">
              <GoogleAuthButton 
                isLoggedIn={progress.isLoggedIn}
                username={progress.username}
                onLogin={handleLogin}
                onLogout={handleLogout}
              />
              <button
                onClick={handleResetProgress}
                title="Reiniciar Progreso de Partida"
                className="p-2bg-white/5 hover:bg-white/10 text-[#919097] hover:text-white border border-white/5 rounded-full transition-all active:scale-95 text-xs"
              >
                <RotateCcw className="w-4 h-4 text-white/60 hover:text-white" />
              </button>
            </div>
          </header>

          {/* Core active content page container */}
          <main className="flex-1 w-full p-4 md:p-8 z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className="h-full w-full"
              >
                {currentView === 'home' && (
                  <MyHome 
                    playerProgress={progress}
                    onUpdateEmotions={handleUpdateEmotionsDirectly}
                    onEvolve={handleOnEvolve}
                    onSpendGold={handleSpendGold}
                  />
                )}
                {currentView === 'lobby' && (
                  <Lobby 
                    playerUsername={progress.username}
                    playerPhase={progress.phase}
                    playerDominant={dominantName}
                    playerCompanionSummoned={progress.companionSummoned}
                    onNavigateToView={setCurrentView}
                  />
                )}
                {currentView === 'battle' && (
                  <BattleArena 
                    progress={progress}
                    onSaveProgress={saveProgress}
                  />
                )}
                {currentView === 'minigame' && (
                  <Minigame 
                    onReward={handleMinigameReward}
                    onEmotionBoost={handleEmotionBoost}
                  />
                )}
                {currentView === 'codex' && (
                  <Codex 
                    unlockedArchetypes={progress.unlockedArchetypes}
                    currentDominant={dominantName}
                  />
                )}
                {currentView === 'open_world' && (
                  <MundoAbierto 
                    progress={progress}
                    onSaveProgress={saveProgress}
                  />
                )}
                {currentView === 'vecindario' && (
                  <Vecindario 
                    progress={progress}
                    onSaveProgress={saveProgress}
                  />
                )}
                {currentView === 'crafting' && (
                  <Crafting 
                    progress={progress}
                    onSaveProgress={saveProgress}
                  />
                )}
                {currentView === 'first_person' && (
                  <FirstPersonWorld 
                    progress={progress}
                    onSaveProgress={saveProgress}
                    onUpdateEmotions={handleUpdateEmotionsDirectly}
                    onEvolve={handleOnEvolve}
                    onSpendGold={handleSpendGold}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Scenic footer details */}
          <footer className="border-t border-white/5 bg-black/40 py-4 px-8 text-center text-[10px] text-[#919097] uppercase tracking-widest relative z-10 flex flex-col md:flex-row items-center justify-between gap-3 pointer-events-none">
            <span>© 2026 EVOLUTIA: CRÓNICAS DEL ORIGEN • LICENCIA COMPRENSIVA</span>
            <span className="font-mono text-tertiary">AURA DEL RECEPTOR: {dominantName.toUpperCase()} EN SINTONÍA</span>
          </footer>
        </>
      )}
    </div>
  );
}
