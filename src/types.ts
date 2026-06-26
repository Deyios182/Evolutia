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
  type: 'furniture' | 'equipment' | 'material' | 'tool';
  subType?: 'weapon_1h' | 'weapon_2h' | 'ranged' | 'shield' | 'grimoire' | 'head' | 'chest' | 'legs' | 'neck' | 'ring' | 'backpack' | 'axe' | 'pickaxe' | 'refined_wood' | 'refined_metal' | 'refined_stone' | 'refined_essence';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  statBonus?: string; // Example: "HP+50" or "DMG+15"
  weightCapacity?: number; // For backpacks, defines max carrying capacity
  weight?: number; // Physical weight of the item
  placed?: boolean;
  equipped?: boolean;
  tier?: number; // Tier level of resource or tool (1 to 4)
  quantity?: number; // Stack quantity for refined materials
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
  axe?: CraftableItem | null;
  pickaxe?: CraftableItem | null;
}

export interface StashSlot {
  id: string; // Unique ID for React keys
  type: 'material' | 'equipment';
  materialCategory?: 'wood' | 'stone' | 'metal' | 'essence';
  materialRarity?: 'common' | 'rare' | 'epic' | 'legendary';
  quantity?: number; // max stack 99
  equipmentItem?: CraftableItem;
}

// ─────────────────────────────────────────────────────────────────
// Cabin System Interfaces
// ─────────────────────────────────────────────────────────────────

/** An individual unlockable cabin station or visual upgrade */
export interface CabinUpgrade {
  id: string;           // e.g. 'forge_basic', 'weaver_t1', 'window_repairs'
  name: string;
  description: string;
  level: number;        // 0 = not built, 1-3 = upgrade tiers
  unlockedAt?: string;  // ISO timestamp
}

/** A quest given by Orit the mentor Nitz */
export interface OritQuest {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
  requirements: {
    wood_common?: number;
    stone_common?: number;
    metal_common?: number;
    essence_common?: number;
    wood_rare?: number;
    stone_rare?: number;
    metal_rare?: number;
    essence_rare?: number;
  };
  reward: {
    gold?: number;
    exp?: number;
    unlockUpgradeId?: string; // ID of cabin upgrade unlocked on completion
  };
}

/** Full persistent state of the player's cabin */
export interface CabinState {
  level: number;                  // 1 to 5
  upgrades: CabinUpgrade[];       // Stations and visual improvements built
  activeQuests: OritQuest[];      // Current active quests from Orit
  completedQuestIds: string[];    // IDs of finished quests (for history)
  oritMet: boolean;               // True once the player had the first Orit dialogue
  oritDialogueIndex: number;      // Index of the last dialogue node seen
  customPositions?: Record<string, { x: number; z: number; rotation: number }>;
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
  // Albion additions
  refiningLevel?: number;
  refiningExp?: number;
  weaponMastery?: {
    sword?: number;
    ranged?: number;
    grimoire?: number;
    fists?: number;
  };
  weaponMasteryExp?: {
    sword?: number;
    ranged?: number;
    grimoire?: number;
    fists?: number;
  };
  // Cabin system
  cabin?: CabinState;
  // Derived field written to Firestore for multiplayer queries
  dominantEmotion?: string;
  // Flag to prevent re-injecting the dev test kit
  devKitInjected?: boolean;
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
