export type GameView = 'onboarding' | 'lobby' | 'home' | 'care' | 'battle' | 'minigame' | 'codex' | 'vecindario' | 'open_world' | 'crafting' | 'first_person';

export interface EmotionVector {
  Ira: number;
  Miedo: number;
  Tristeza: number;
  Alegría: number;
  Confianza: number;
  Sorpresa: number;
  Amor: number;
  Orgullo: number;
  Serenidad: number;
}

export type EmotionName = keyof EmotionVector;

export interface AvatarCustomization {
  name: string;
  accessory: 'none' | 'halo' | 'ribbon' | 'horn_gold' | 'scarf_cozy';
  auraType: 'stellar' | 'vortex' | 'sparkles' | 'none';
  colorTheme: 'classic' | 'abyssal' | 'solstice' | 'primeval';
  clothing: 'none' | 'shawl' | 'armor_shard' | 'robe_sage';
}

export interface GatheringInventory {
  wood: { common: number; rare: number; epic: number; legendary: number };
  stone: { common: number; rare: number; epic: number; legendary: number };
  metal: { common: number; rare: number; epic: number; legendary: number };
  essence: { common: number; rare: number; epic: number; legendary: number };
}

export interface CraftableItem {
  id: string;
  name: string;
  type: 'furniture' | 'equipment';
  subType?: 'weapon' | 'shield' | 'armor';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  statBonus?: string;
  placed?: boolean;
  equipped?: boolean;
}

export interface PlayerProgress {
  isLoggedIn: boolean;
  username: string;
  avatarUrl: string;
  gold: number;
  exp: number;
  avatar: AvatarCustomization;
  phase: number; // 1 to 5
  emotions: EmotionVector;
  interactionCount: number;
  unlockedArchetypes: string[]; 
  // Albion RPG & Neighborhood system extensions
  inventory: GatheringInventory;
  craftedItems: CraftableItem[];
  houseDecorations: { itemId: string; slot: number }[]; 
  equippedWeaponId?: string;
  equippedShieldId?: string;
  equippedArmorId?: string;
}

export interface LobbyPlayer {
  id: string;
  username: string;
  avatarUrl: string;
  phase: number;
  dominantEmotion: EmotionName;
  status: 'online' | 'idle' | 'in_battle';
}

export interface ArchetypeInfo {
  id: string;
  name: string;
  emotion: EmotionName;
  title: string;
  description: string;
  lore: string;
  cardImage: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  avatarUrl: string;
  text: string;
  timestamp: string;
  isNitz?: boolean;
}
