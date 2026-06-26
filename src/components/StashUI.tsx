import React, { useState, useEffect } from 'react';
import { PlayerProgress, StashSlot, GatheringInventory } from '../types';
import { Package, Shield, XCircle, ArrowRightCircle } from 'lucide-react';

interface StashUIProps {
  progress: PlayerProgress;
  onSaveProgress: (newProg: PlayerProgress) => void;
  onClose: () => void;
  tempBag: GatheringInventory;
  setTempBag: (bag: GatheringInventory) => void;
}

const MAX_SLOTS = 40;
const MAX_STACK = 99;

export function StashUI({ progress, onSaveProgress, onClose, tempBag, setTempBag }: StashUIProps) {
  const [grid, setGrid] = useState<(StashSlot | null)[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Initialize and Migrate Old Inventory to Grid
  useEffect(() => {
    let currentGrid = [...(progress.stashGrid || [])];

    // Pad to 40 slots if smaller or undefined
    while (currentGrid.length < MAX_SLOTS) {
      currentGrid.push(null);
    }

    // Auto-Migrate from legacy stashInventory if it exists and hasn't been cleared
    let hasMigration = false;
    const oldStash = progress.stashInventory;
    if (oldStash) {
      const materials = ['wood', 'stone', 'metal', 'essence'] as const;
      const rarities = ['common', 'rare', 'epic', 'legendary'] as const;

      materials.forEach(mat => {
        rarities.forEach(rar => {
          let qty = oldStash[mat]?.[rar] || 0;
          while (qty > 0) {
            const addQty = Math.min(qty, MAX_STACK);
            // Find empty slot
            const emptyIdx = currentGrid.findIndex(s => s === null);
            if (emptyIdx !== -1) {
              currentGrid[emptyIdx] = {
                id: `migrated_${mat}_${rar}_${Date.now()}_${Math.random()}`,
                type: 'material',
                materialCategory: mat,
                materialRarity: rar,
                quantity: addQty
              };
              hasMigration = true;
            }
            qty -= addQty;
          }
        });
      });
    }

    setGrid(currentGrid);

    // Save migration immediately if happened
    if (hasMigration) {
      const newProg = { ...progress };
      newProg.stashGrid = currentGrid;
      // Wipe old stash so it doesn't migrate twice
      newProg.stashInventory = {
        wood: { common: 0, rare: 0, epic: 0, legendary: 0 },
        stone: { common: 0, rare: 0, epic: 0, legendary: 0 },
        metal: { common: 0, rare: 0, epic: 0, legendary: 0 },
        essence: { common: 0, rare: 0, epic: 0, legendary: 0 },
      };
      onSaveProgress(newProg);
    }
  }, []);

  const executeMove = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const newGrid = [...grid];
    const source = newGrid[fromIdx];
    if (!source) return;
    const target = newGrid[toIdx];

    if (!target) {
      // Move to empty
      newGrid[toIdx] = source;
      newGrid[fromIdx] = null;
    } else {
      // Target occupied
      if (
        source.type === 'material' && target.type === 'material' &&
        source.materialCategory === target.materialCategory &&
        source.materialRarity === target.materialRarity
      ) {
        // Merge logic
        const total = (source.quantity || 0) + (target.quantity || 0);
        if (total <= MAX_STACK) {
          target.quantity = total;
          newGrid[fromIdx] = null;
        } else {
          const remainder = total - MAX_STACK;
          target.quantity = MAX_STACK;
          source.quantity = remainder;
        }
      } else {
        // Swap logic
        newGrid[toIdx] = source;
        newGrid[fromIdx] = target;
      }
    }

    setGrid(newGrid);
    onSaveProgress({ ...progress, stashGrid: newGrid });
  };

  const handleSlotClick = (index: number) => {
    if (selectedIndex === null) {
      // Select source
      if (grid[index] !== null) {
        setSelectedIndex(index);
      }
    } else {
      // Action: move/merge/swap
      executeMove(selectedIndex, index);
      setSelectedIndex(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (index: number) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const fromIdxStr = e.dataTransfer.getData('text/plain');
    if (fromIdxStr !== '') {
      const fromIdx = parseInt(fromIdxStr, 10);
      if (!isNaN(fromIdx)) {
        executeMove(fromIdx, index);
      }
    }
  };

  const handleDumpTempBag = () => {
    const newGrid = [...grid];
    const inv = { ...tempBag };
    const materials = ['wood', 'stone', 'metal', 'essence'] as const;
    const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
    let changesMade = false;

    materials.forEach(mat => {
      rarities.forEach(rar => {
        let qty = inv[mat]?.[rar] || 0;
        
        while (qty > 0) {
          // Try to find matching non-full stack
          let targetIdx = newGrid.findIndex(s => 
            s !== null && 
            s.type === 'material' && 
            s.materialCategory === mat && 
            s.materialRarity === rar && 
            (s.quantity || 0) < MAX_STACK
          );

          if (targetIdx !== -1) {
            const stack = newGrid[targetIdx]!;
            const spaceLeft = MAX_STACK - (stack.quantity || 0);
            const toAdd = Math.min(qty, spaceLeft);
            stack.quantity = (stack.quantity || 0) + toAdd;
            qty -= toAdd;
            changesMade = true;
          } else {
            // Find empty slot
            const emptyIdx = newGrid.findIndex(s => s === null);
            if (emptyIdx !== -1) {
              const toAdd = Math.min(qty, MAX_STACK);
              newGrid[emptyIdx] = {
                id: `dump_${mat}_${rar}_${Date.now()}_${Math.random()}`,
                type: 'material',
                materialCategory: mat,
                materialRarity: rar,
                quantity: toAdd
              };
              qty -= toAdd;
              changesMade = true;
            } else {
              // Stash full
              break;
            }
          }
        }
        inv[mat][rar] = qty; // leave remainder in temp bag if stash is full
      });
    });

    if (changesMade) {
      setGrid(newGrid);
      setTempBag(inv);
      onSaveProgress({ ...progress, stashGrid: newGrid });
    }
  };

  const renderIcon = (slot: StashSlot) => {
    if (slot.type === 'material') {
      const rarColor = 
        slot.materialRarity === 'common' ? 'text-gray-400' :
        slot.materialRarity === 'rare' ? 'text-blue-400' :
        slot.materialRarity === 'epic' ? 'text-purple-400' : 'text-yellow-400';
        
      let emoji = '📦';
      if (slot.materialCategory === 'wood') emoji = '🌲';
      if (slot.materialCategory === 'stone') emoji = '🪨';
      if (slot.materialCategory === 'metal') emoji = '⚙️';
      if (slot.materialCategory === 'essence') emoji = '🔮';

      return (
        <div className="flex flex-col items-center justify-center w-full h-full relative">
          <span className="text-2xl drop-shadow-lg">{emoji}</span>
          <span className={`absolute bottom-0 right-1 text-[10px] font-mono font-bold ${rarColor}`}>
            x{slot.quantity}
          </span>
        </div>
      );
    }
    
    // Render equipment items (weapons, armor, tools) with specific emojis and tier badges
    const eqItem = slot.equipmentItem;
    if (eqItem) {
      const isTool = eqItem.type === 'tool';
      const sub = eqItem.subType;
      let emoji = '🛡️';
      if (isTool) {
        if (sub === 'axe') emoji = '🪓';
        else if (sub === 'pickaxe') emoji = '⛏️';
      } else {
        if (sub === 'weapon' || sub === 'weapon_1h' || sub === 'weapon_2h') emoji = '⚔️';
        else if (sub === 'ranged') emoji = '🔫';
        else if (sub === 'grimoire') emoji = '🔮';
        else if (sub === 'chest' || sub === 'armor') emoji = '👕';
        else if (sub === 'head') emoji = '🪖';
        else if (sub === 'legs') emoji = '👖';
        else if (sub === 'backpack') emoji = '🎒';
      }
      return (
        <div className="flex flex-col items-center justify-center w-full h-full relative" title={eqItem.name}>
          <span className="text-2xl drop-shadow-lg">{emoji}</span>
          {eqItem.tier && (
            <span className="absolute bottom-0 right-1 text-[8px] font-mono font-bold text-amber-400 bg-black/60 px-0.5 rounded">
              T{eqItem.tier}
            </span>
          )}
        </div>
      );
    }
    return <span className="text-xl">🛡️</span>;
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0b0c16] text-white">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-bold font-headline-md tracking-wider text-amber-500 uppercase">Almacén Seguro Astral (Stash)</h2>
        </div>
        <button onClick={onClose} className="p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/40 transition-colors">
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="flex px-4 gap-6 flex-1 overflow-hidden">
        
        {/* LEFT PANEL: Temp Bag Control */}
        <div className="w-1/3 bg-[#11131a] border border-white/5 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-900/10 to-transparent pointer-events-none" />
          
          <Package className="w-16 h-16 text-amber-500/50 mb-4" />
          <h3 className="text-lg font-bold uppercase tracking-widest text-amber-500 mb-2">Descarga de Sesión</h3>
          <p className="text-xs text-gray-400 text-center mb-8">
            Haz clic aquí para volcar todo el botín que llevas en los bolsillos (Temp Bag) directamente a las celdas vacías de tu Baúl Seguro.
          </p>

          <button 
            onClick={handleDumpTempBag}
            className="group relative px-6 py-3 bg-amber-600 hover:bg-amber-500 text-black font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-3 active:scale-95"
          >
            Transferir Todo <ArrowRightCircle className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* RIGHT PANEL: The Grid */}
        <div className="flex-1 bg-[#0a0a0e] border border-white/10 rounded-xl p-4 flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.8)] inset-shadow">
          
          <div className="flex justify-between items-end mb-4 px-2">
            <div>
              <h3 className="font-bold text-gray-300 uppercase tracking-widest text-sm">Celdas de Almacenamiento</h3>
              <p className="text-[10px] text-gray-500 font-mono">Límite por stack: 99 unidades | Clic para mover y agrupar</p>
            </div>
            <div className="text-[10px] text-gray-500 font-mono">
              Slots Ocupados: <span className="text-amber-500 font-bold">{grid.filter(s => s !== null).length}</span> / {MAX_SLOTS}
            </div>
          </div>

          <div className="grid grid-cols-8 gap-1.5 auto-rows-max p-2 bg-[#14151c] rounded-lg border border-white/5 h-full content-start overflow-y-auto custom-scrollbar">
            {grid.map((slot, idx) => {
              const isSelected = selectedIndex === idx;
              const isDragOver = dragOverIndex === idx;
              
              let bgClass = "bg-[#1d1f2a]";
              let borderClass = "border-white/5";

              if (isSelected) {
                bgClass = "bg-amber-900/40";
                borderClass = "border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]";
              } else if (isDragOver) {
                bgClass = "bg-amber-800/20";
                borderClass = "border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)] scale-105 z-10";
              } else if (slot) {
                bgClass = "bg-[#252836] hover:bg-[#2c3040]";
                borderClass = "border-white/10 hover:border-white/30";
              }

              return (
                <div 
                  key={idx}
                  onClick={() => handleSlotClick(idx)}
                  draggable={!!slot}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={() => handleDragLeave(idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  className={`relative aspect-square rounded cursor-pointer transition-all border ${bgClass} ${borderClass} flex items-center justify-center select-none`}
                >
                  {slot && renderIcon(slot)}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
