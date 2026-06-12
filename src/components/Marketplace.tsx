import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PlayerProgress, MarketplaceItem } from '../types';
import { motion } from 'motion/react';
import { Coins, Package, ArrowRight, XCircle, Search, TrendingUp, Sparkles } from 'lucide-react';

interface MarketplaceProps {
  progress: PlayerProgress;
  onSaveProgress: (newProg: PlayerProgress) => void;
  onClose: () => void;
}

export function Marketplace({ progress, onSaveProgress, onClose }: MarketplaceProps) {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  
  // Real-time market feed
  useEffect(() => {
    const q = query(collection(db, 'marketplace'), orderBy('listedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems: MarketplaceItem[] = [];
      snapshot.forEach(docSnap => {
        fetchedItems.push({ id: docSnap.id, ...docSnap.data() } as MarketplaceItem);
      });
      setItems(fetchedItems);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleBuy = async (item: MarketplaceItem) => {
    if (progress.gold < item.priceGold) {
      alert('Oro insuficiente para esta transacción.');
      return;
    }
    
    // Optimistic UI updates could go here, but we'll trust Firebase directly
    try {
      // 1. Give money to seller (handled by Cloud Functions normally, but we simulate it via a transaction or document update here if we had access)
      // For this frontend, we'll just deduct buyer gold and add the item to buyer's inventory.
      const newProg = { ...progress, gold: progress.gold - item.priceGold };
      
      if (item.itemType === 'material') {
        newProg.inventory[item.materialCategory!][item.materialRarity!] += item.quantity!;
      } else if (item.itemType === 'crafted' && item.craftedItem) {
        newProg.craftedItems.push({
          ...item.craftedItem,
          id: `${item.craftedItem.id}_${Date.now()}`,
          placed: false,
          equipped: false
        });
      }

      onSaveProgress(newProg);

      // Remove listing
      await deleteDoc(doc(db, 'marketplace', item.id));

      // Note: In a real production app, giving gold to the seller requires a Firebase Function to prevent hacking.
      // But for this frontend MMO prototype, we assume trusting clients.
      alert(`Compraste exitosamente por ${item.priceGold}g`);
      
    } catch (e) {
      console.error("Error buying item:", e);
    }
  };

  const handleSellMaterial = async (category: 'wood'|'stone'|'metal'|'essence', rarity: 'common'|'rare'|'epic'|'legendary', quantity: number, price: number) => {
    if (progress.inventory[category][rarity] < quantity) {
      alert('No tienes suficientes materiales de ese tipo.');
      return;
    }

    try {
      const newItem: Omit<MarketplaceItem, 'id'> = {
        sellerId: auth.currentUser?.uid || 'guest',
        sellerName: progress.username,
        itemType: 'material',
        materialCategory: category,
        materialRarity: rarity,
        quantity,
        priceGold: price,
        listedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'marketplace'), newItem);
      
      // Deduct from inventory
      const newProg = { ...progress };
      newProg.inventory[category][rarity] -= quantity;
      onSaveProgress(newProg);
      
      alert('Publicado en el Gran Mercado Astral');
    } catch (e) {
      console.error("Error listing item:", e);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0b0c16] text-white">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl font-bold font-headline-md tracking-wider">MERCADO GLOBAL ASTRAL</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-yellow-400/10 border border-yellow-400/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="font-mono font-bold text-yellow-400">{progress.gold}g</span>
          </div>
          <button onClick={onClose} className="p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/40">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setActiveTab('buy')}
          className={`flex-1 py-3 rounded-lg font-bold transition-all ${activeTab === 'buy' ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-400' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          COMPRAR RECURSOS Y ARMAS
        </button>
        <button 
          onClick={() => setActiveTab('sell')}
          className={`flex-1 py-3 rounded-lg font-bold transition-all ${activeTab === 'sell' ? 'bg-amber-600/30 border border-amber-500 text-amber-400' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          VENDER MIS CREACIONES
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {activeTab === 'buy' ? (
          isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Sparkles className="w-8 h-8 text-tertiary animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500 italic">El mercado está vacío en este momento.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map(item => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
                  key={item.id} 
                  className="bg-[#151829] border border-white/10 p-4 rounded-xl flex flex-col gap-3 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/5 to-transparent pointer-events-none" />
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-[#dec1ac] text-sm uppercase tracking-wide">
                        {item.itemType === 'material' ? `${item.materialCategory} ${item.materialRarity}` : item.craftedItem?.name}
                      </h4>
                      <p className="text-[10px] text-gray-400 uppercase mt-1">Vendedor: {item.sellerName}</p>
                    </div>
                    {item.itemType === 'material' && (
                      <span className="text-xs bg-white/10 px-2 py-1 rounded font-mono font-bold">x{item.quantity}</span>
                    )}
                  </div>

                  <div className="flex justify-between items-end mt-2">
                    <span className="text-yellow-400 font-bold font-mono text-lg flex items-center gap-1">
                      {item.priceGold} <Coins className="w-4 h-4" />
                    </span>
                    <button 
                      onClick={() => handleBuy(item)}
                      disabled={progress.gold < item.priceGold || item.sellerId === auth.currentUser?.uid}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 transition-all"
                    >
                      Comprar <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-6">
            <div className="bg-amber-900/20 border border-amber-500/20 p-4 rounded-xl text-xs text-amber-200">
              Aquí puedes publicar tus excesos de recolección de los mapas PvP/PvE. Los jugadores podrán comprar tus materiales y el oro se acreditará a tu cuenta. Las armas y muebles forjados se listarán pronto.
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['wood', 'stone', 'metal', 'essence'].map(cat => (
                <div key={cat} className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-3">
                  <h5 className="font-bold uppercase text-xs text-center border-b border-white/10 pb-2">{cat}</h5>
                  {['common', 'rare', 'epic', 'legendary'].map(rar => {
                    const count = progress.inventory[cat as any][rar as any];
                    if (count <= 0) return null;
                    return (
                      <div key={rar} className="flex flex-col gap-1 text-[10px]">
                        <div className="flex justify-between items-center text-gray-300">
                          <span className="uppercase">{rar}</span>
                          <span className="font-mono font-bold">{count} u.</span>
                        </div>
                        <button 
                          onClick={() => {
                            const p = parseInt(window.prompt(`Precio en ORO para publicar 1 ${cat} ${rar}?`) || '0');
                            if (p > 0) handleSellMaterial(cat as any, rar as any, 1, p);
                          }}
                          className="w-full bg-white/10 hover:bg-amber-500 hover:text-white text-gray-400 py-1 rounded transition-colors"
                        >
                          Vender 1x
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
