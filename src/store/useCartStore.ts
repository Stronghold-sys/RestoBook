import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';

export interface CartItem {
  id: string; // menu_item_id
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  notes?: string;
}

interface CartStore {
  items: CartItem[];
  userId: string | null;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateNotes: (id: string, notes: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  setUserId: (userId: string | null) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      userId: null,
      addItem: (item) => set((state) => {
        const existing = state.items.find((i) => i.id === item.id);
        if (existing) {
          return {
            items: state.items.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
            ),
          };
        }
        return { items: [...state.items, item] };
      }),
      removeItem: (id) => set((state) => ({
        items: state.items.filter((i) => i.id !== id),
      })),
      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i
        ),
      })),
      updateNotes: (id, notes) => set((state) => ({
        items: state.items.map((i) =>
          i.id === id ? { ...i, notes } : i
        ),
      })),
      clearCart: () => set({ items: [] }),
      getTotal: () => get().items.reduce((total, item) => total + (item.price * item.quantity), 0),
      setUserId: (userId) => set((state) => {
        if (state.userId !== userId) {
          return { userId, items: [] };
        }
        return { userId };
      }),
    }),
    {
      name: 'restobook-cart',
    }
  )
);

// Listen to Supabase auth changes to sync the cart ownership and clear it on logout/account change
if (typeof window !== 'undefined') {
  const supabase = createClient();
  supabase.auth.onAuthStateChange((event, session) => {
    const currentUserId = session?.user?.id || null;
    useCartStore.getState().setUserId(currentUserId);
  });
}

