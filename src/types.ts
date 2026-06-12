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
  traits?: string[];
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
  subType?: 'weapon_1h' | 'weapon_2h' | 'ranged' | 'shield' | 'grimoire' | 'head' | 'chest' | 'legs' | 'neck' | 'ring' | 'backpack';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  statBonus?: string; // Example: "HP+50" or "DMG+15"
  weightCapacity?: number; // For backpacks, defines max carrying capacity
  weight?: number; // Physical weight of the item
  placed?: boolean;
  equipped?: boolean;
}

export interface EquipmentSlots {
  head?: CraftableItem | null;
  chest?: CraftableItem | null;
  legs?: CraftableItem | null;
  neck?: CraftableItem | null;
  ring1?: CraftableItem | null;
  ring2?: CraftableItem | null;
  mainHand?: CraftableItem | null;
  offHand?: CraftableItem | null;
  backpack?: CraftableItem | null;
}

export interface StashSlot {
  id: string; // Unique ID for React keys
  type: 'material' | 'equipment';
  materialCategory?: 'wood' | 'stone' | 'metal' | 'essence';
  materialRarity?: 'common' | 'rare' | 'epic' | 'legendary';
  quantity?: number; // max stack 99
  equipmentItem?: CraftableItem;
}

export interface PlayerProgress {
  isLoggedIn: boolean;
  username: string;
  avatarUrl: string;
  gold: number;
  exp: number;
  hp: number;
  maxHp: number;
  avatar: AvatarCustomization;
  phase: number; // 1 to 5
  emotions: EmotionVector;
  interactionCount: number;
  unlockedArchetypes: string[];  
  // Albion RPG & Neighborhood system extensions
  inventory: GatheringInventory; // Deprecated slowly, kept for legacy UI compatibility until fully wiped
  craftedItems: CraftableItem[];
  stashGrid?: (StashSlot | null)[]; // New Grid Array (e.g. length 40)
  stashInventory?: GatheringInventory; // Deprecated
  stashItems?: CraftableItem[]; // Deprecated
  houseDecorations: { itemId: string; slot: number }[]; 
  equippedWeaponId?: string; // Deprecated
  equippedShieldId?: string; // Deprecated
  equippedArmorId?: string; // Deprecated
  equipment?: EquipmentSlots; // New Arc Raiders equipment system
  companionSummoned?: boolean;
  plotLevel?: number;
  authorizedBuilders?: string[];
  // Workbenches
  workbenchForgeLevel?: number;
  workbenchWeaverLevel?: number;
  workbenchEnchanterLevel?: number;
}

export interface MarketplaceItem {
  id: string;
  sellerId: string;
  sellerName: string;
  itemType: 'material' | 'crafted';
  // For materials:
  materialCategory?: 'wood' | 'stone' | 'metal' | 'essence';
  materialRarity?: 'common' | 'rare' | 'epic' | 'legendary';
  quantity?: number;
  // For crafted items:
  craftedItem?: CraftableItem;
  priceGold: number;
  listedAt: string;
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

export interface PvPDuelSession {
  id: string;
  status: 'pending' | 'active' | 'rejected' | 'finished';
  challengerId: string;
  challengerName: string;
  defenderId: string;
  defenderName: string;
  turn: 'challenger' | 'defender';
  challengerHp: number;
  challengerMaxHp: number;
  challengerShield: number;
  challengerMaxShield: number;
  defenderHp: number;
  defenderMaxHp: number;
  defenderShield: number;
  defenderMaxShield: number;
  challengerAction?: string;
  defenderAction?: string;
  logs: string[];
  winnerId?: string;
  lootAtRisk?: string;
}
