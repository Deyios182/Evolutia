import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Sparkles, Flame, Shield, Sun, Eye, Activity, Heart, Moon, Compass, Trophy } from 'lucide-react';
import { ArchetypeInfo, EmotionName } from '../types';
import { EMOTION_COLORS } from './NitzCanvas';

export const ARCHETYPES: ArchetypeInfo[] = [
  {
    id: 'arch_joy',
    name: 'Nitz Centelleante',
    emotion: 'Alegría',
    title: 'El Heraldo del Solsticio',
    description: 'Nacido en las cúspides de los mediodías perpetuos, irradia una energía dorada que desvanece la niebla espectral.',
    lore: 'Cuando la alegría rige la frecuencia mística de Nitz, su cola vibra a velocidades armónicas generando ráfagas de polvo áureo. Su presencia es celebrada en toda la Aldea por contagiar sosiego y vigor vital.',
    cardImage: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'arch_love',
    name: 'Nitz Resonante',
    emotion: 'Amor',
    title: 'El Lazo Vinculante',
    description: 'Posee una resonancia carmesí translúcida que palpita al ritmo exacto de los latidos de su Guardián.',
    lore: 'La conexión íntima y las caricias prolongadas sintonizan la esencia de Nitz con el afecto incondicional. Su aura emite destellos espirales que sanan grietas espirituales y amparan a criaturas heridas.',
    cardImage: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'arch_anger',
    name: 'Nitz Beligerante',
    emotion: 'Ira',
    title: 'El Clamor de las Cenizas',
    description: 'Un espíritu envuelto en flamas fulgurantes que emergen cuando el rencor o la frustración agrietan el aire.',
    lore: 'La ira no debe ser temida, pues es el motor del cambio. En su fase beligerante, Nitz endurece su coraza y agita su cola con látigos de magma. Posee el poder destructivo necesario para quebrar barreras abisales.',
    cardImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'arch_fear',
    name: 'Nitz Trémulo',
    emotion: 'Miedo',
    title: 'El Observador de Sombras',
    description: 'De pupilas dilatadas y contornos diluidos en indigos profundos, percibe las vibraciones sísmicas más imperceptibles.',
    lore: 'Aquellos Nitz sintonizados con el miedo se vuelven ligeros como el viento nocturno. Aunque temerosos de la luz repentina, son centinelas insuperables contra incursiones del Vaciado, evadiendo ataques con precisión refleja.',
    cardImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'arch_serenity',
    name: 'Nitz Armónico',
    emotion: 'Serenidad',
    title: 'El Guardián del Silencio',
    description: 'Su silueta se mece suavemente recreando la quietud de las aguas profundas del Origen.',
    lore: 'Consolidado bajo el influjo de la meditación constante y la calma emocional. Su respiración es tan baja que induce a las flores mágicas de la cabaña a florecer fuera de estación. Es la encarnación del equilibrio.',
    cardImage: 'https://images.unsplash.com/photo-1497436072909-60f360e1d4b1?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'arch_tristeza',
    name: 'Nitz Sombrío',
    emotion: 'Tristeza',
    title: 'La Elegía Pluvial',
    description: 'Envuelto en filamentos de color cobalto frío, Nitz absorbe la pesadumbre del cosmos para transmutarla en sabiduría.',
    lore: 'La tristeza es un refugio necesario de introspección. Nitz Sombrío arrastra un rastro de humedad estelar que ralentiza los combates impetuosos. Sus lágrimas catalizan el florecer de gemas místicas subterráneas.',
    cardImage: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'arch_trust',
    name: 'Nitz Protector',
    emotion: 'Confianza',
    title: 'El Escudo Primigenio',
    description: 'Porta una robusta aura esmeralda capaz de solidificarse ante amenazas energéticas directas.',
    lore: 'La fe ciega entre criatura y Guardián consagra esta forma. No retrocede ante ráfagas ígneas y actúa como baluarte defensivo en los entrenamientos en la arena. Su corazón es inquebrantable.',
    cardImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'arch_surp',
    name: 'Nitz Errático',
    emotion: 'Sorpresa',
    title: 'El Destello Instantáneo',
    description: 'Cambia de textura y color en milisegundos con descargas eléctricas naranja de alta tensión.',
    lore: 'Una reacción fortuita crea el espécimen errático. Sus ojos cargan de brillo plateado y su cola se dispara con frecuencias sinuosas e imprevisibles. Confunde tanto a amigos como a rivales en batalla.',
    cardImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'arch_pride',
    name: 'Nitz Soberano',
    emotion: 'Orgullo',
    title: 'La Trascendencia Púrpura',
    description: 'Coronado por anillos de gravedad cósmica, camina con paso altivo flotando sobre los abismos.',
    lore: 'El orgullo despierta cuando Nitz vence la adversidad repetidas veces. Sus cuernos y aureolas brillan con una opulencia imperial que fuerza a otros espíritus elementales a rendir honores a su paso.',
    cardImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&q=80&w=400',
  }
];

interface CodexProps {
  unlockedArchetypes: string[];
  currentDominant: EmotionName;
}

export const Codex: React.FC<CodexProps> = ({ unlockedArchetypes, currentDominant }) => {
  const [selectedArch, setSelectedArch] = useState<ArchetypeInfo>(ARCHETYPES[0]);
  const [isFlipped, setIsFlipped] = useState(false);

  const getEmotionIcon = (emotion: EmotionName) => {
    switch (emotion) {
      case 'Ira': return <Flame className="w-4 h-4 text-red-500 animate-pulse" />;
      case 'Amor': return <Heart className="w-4 h-4 text-pink-500" />;
      case 'Confianza': return <Shield className="w-4 h-4 text-green-500" />;
      case 'Alegría': return <Sun className="w-4 h-4 text-amber-400" />;
      case 'Serenidad': return <Compass className="w-4 h-4 text-teal-400" />;
      case 'Sorpresa': return <Sparkles className="w-4 h-4 text-orange-400" />;
      case 'Tristeza': return <Moon className="w-4 h-4 text-blue-400" />;
      default: return <Activity className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 md:p-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-[#c4c5da]" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-headline-lg text-white">Códice de la Resonancia</h1>
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">Compendio de Almas y de los 9 Linajes Celestiales</p>
          </div>
        </div>
        <div className="bg-[#1c1d32] border border-white/10 px-4 py-2 rounded-full text-xs font-mono text-[#c4c5da] flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span>Formas Descubiertas: </span>
          <strong className="text-white">{unlockedArchetypes.length} / 9</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Archetype Directory (List) */}
        <div className="lg:col-span-5 space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#919097] mb-2 px-1">Linajes de Esencia</p>
          <div className="grid grid-cols-1 gap-2">
            {ARCHETYPES.map((arch) => {
              const hexColor = EMOTION_COLORS[arch.emotion].toString(16).padStart(6, '0');
              const isUnlocked = unlockedArchetypes.includes(arch.id) || arch.emotion === currentDominant;
              const isActive = selectedArch.id === arch.id;

              return (
                <button
                  key={arch.id}
                  onClick={() => {
                    setSelectedArch(arch);
                    setIsFlipped(false);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-lg border text-left transition-all ${
                    isActive
                      ? 'bg-[#1e203c] border-tertiary shadow-lg'
                      : 'bg-[#111324]/60 border-white/5 hover:bg-[#16182c]'
                  } ${!isUnlocked && 'opacity-65'}`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]"
                      style={{ color: `#${hexColor}` }}
                    />
                    <div>
                      <h3 className="font-bold text-sm text-white">{isUnlocked ? arch.name : 'Linaje Oculto'}</h3>
                      <p className="text-xs text-[#919097] font-mono">{arch.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-[10px] px-2 py-0.5 rounded font-mono border"
                      style={{ 
                        borderColor: `#${hexColor}22`,
                        backgroundColor: `#${hexColor}11`,
                        color: `#${hexColor}` 
                      }}
                    >
                      {arch.emotion}
                    </span>
                    {getEmotionIcon(arch.emotion)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Archetype Interactive Detail Card */}
        <div className="lg:col-span-7 flex flex-col justify-between glass-panel bg-[#15172b]/95 p-6 rounded-xl border border-white/10 min-h-[480px]">
          <div>
            {/* Visual Header */}
            <div className="flex justify-between items-start gap-4 mb-4 border-b border-white/5 pb-4">
              <div>
                <span className="text-xs uppercase font-mono tracking-widest" style={{ color: `#${EMOTION_COLORS[selectedArch.emotion].toString(16)}` }}>
                  Forma {selectedArch.emotion}
                </span>
                <h2 className="text-2xl font-bold font-headline-lg text-white mb-1">{selectedArch.name}</h2>
                <p className="text-sm italic text-tertiary">{selectedArch.title}</p>
              </div>
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center border text-lg shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                style={{
                  borderColor: EMOTION_COLORS[selectedArch.emotion],
                  backgroundColor: `${EMOTION_COLORS[selectedArch.emotion].toString(16)}11`,
                  color: EMOTION_COLORS[selectedArch.emotion]
                }}
              >
                {getEmotionIcon(selectedArch.emotion)}
              </div>
            </div>

            {/* Immersive Photo Frame */}
            <div className="relative w-full h-44 rounded-lg overflow-hidden border border-white/5 mb-4 shadow-inner group">
              <img 
                src={selectedArch.cardImage} 
                alt={selectedArch.name} 
                className="w-full h-full object-cover brightness-[0.7] group-hover:scale-105 transition-transform duration-700" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#15172b] via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 flex gap-2">
                <span className="glass-panel text-[10px] font-mono px-2 py-1 rounded bg-black/60 text-[#c4c5da] border border-white/10">
                  RESONANCIA DOMINANTE
                </span>
                <span className="glass-panel text-[10px] font-mono px-2 py-1 rounded bg-black/60 text-white border border-white/10" style={{ color: EMOTION_COLORS[selectedArch.emotion] }}>
                  {selectedArch.emotion} &gt; 65%
                </span>
              </div>
            </div>

            {/* Description & Lore */}
            <div className="space-y-3">
              <div className="p-3 bg-white/2 rounded-lg border border-white/5">
                <p className="text-xs text-[#919097] font-semibold mb-1 uppercase tracking-wider">Atributo Místico</p>
                <p className="text-sm text-on-surface-variant opacity-90">{selectedArch.description}</p>
              </div>
              <div className="p-3 bg-white/2 rounded-lg border border-white/5">
                <p className="text-xs text-[#919097] font-semibold mb-1 uppercase tracking-wider">Crónica de las Almas</p>
                <p className="text-xs text-on-surface-variant opacity-80 leading-relaxed font-sans">{selectedArch.lore}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/5 text-center flex justify-between items-center text-xs text-[#919097]">
            <span>Canaliza este linaje elevando la emoción de Ira, Amor, Alegría, etc. en el panel de cuidado de Nitz.</span>
            <button 
              onClick={() => alert(`Para consolidar al ${selectedArch.name}, debes cuidar a tu Nitz alimentándolo con tónicos y caricias en su panel de Cuidado para que esa emoción supere el 65%.`)}
              className="text-tertiary hover:text-white font-mono uppercase tracking-widest text-[10px] underline"
            >
              Guía de Fusión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
