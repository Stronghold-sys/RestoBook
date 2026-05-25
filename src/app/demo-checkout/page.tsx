"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Plus, Minus, Trash2, ArrowRight, CheckCircle,
  Loader2, Sparkles, Star, Utensils, CreditCard, ShieldCheck, X, ChevronLeft
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Script from "next/script";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_active: boolean;
  categories?: { name: string };
}

interface CartItem extends MenuItem {
  quantity: number;
}

export default function DemoCheckoutPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [restaurantName, setRestaurantName] = useState("RestoBook");
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [menuRes, settingsRes] = await Promise.all([
          supabase.from("menu_items")
            .select("*, categories(name)")
            .eq("is_active", true)
            .order("name")
            .limit(8),
          supabase.from("restaurant_settings").select("name").single()
        ]);

        if (menuRes.data) setMenuItems(menuRes.data);
        if (settingsRes.data?.name) setRestaurantName(settingsRes.data.name);
      } catch (e) {
        console.error("Fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: qty } : c));
  };

  const getTotal = () => cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const getCartCount = () => cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);

    try {
      // Buat order demo di database menggunakan API demo-checkout
      const res = await fetch("/api/demo-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map(c => ({ id: c.id, name: c.name, price: c.price, quantity: c.quantity })),
          totalAmount: getTotal(),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal membuat pesanan demo");

      if (data.reference && typeof (window as any).checkout !== "undefined") {
        setCheckoutLoading(false);
        (window as any).checkout.process(data.reference, {
          successEvent: () => {
            alert("✅ Pembayaran Berhasil! (Demo Sandbox Duitku)");
            setCart([]);
            setShowCart(false);
          },
          pendingEvent: () => {
            alert("⏳ Pembayaran Pending. (Demo Sandbox Duitku)");
            setCart([]);
            setShowCart(false);
          },
          errorEvent: () => {
            alert("❌ Pembayaran Gagal/Dibatalkan. (Demo Sandbox Duitku)");
          },
          closeEvent: () => {
            setCheckoutLoading(false);
          },
        });
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("Tidak ada URL pembayaran dari gateway");
      }
    } catch (err: any) {
      alert("Error: " + (err.message || "Terjadi kesalahan"));
      setCheckoutLoading(false);
    }
  };

  const isSandbox = true;
  const duitkuScriptUrl = isSandbox
    ? "https://app-sandbox.duitku.com/lib/js/duitku.js"
    : "https://app-prod.duitku.com/lib/js/duitku.js";

  return (
    <>
      <Script
        src={duitkuScriptUrl}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />

      <div className="min-h-screen bg-background-light dark:bg-background-dark">
        {/* Header */}
        <nav className="sticky top-0 z-40 bg-white/90 dark:bg-card-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-muted hover:text-primary transition-colors">
              <ChevronLeft className="w-5 h-5" />
              <span className="font-medium text-sm">Kembali</span>
            </Link>
            <div className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-primary" />
              <span className="font-black text-text-light dark:text-text-dark">
                {restaurantName} <span className="text-primary text-xs font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full ml-1">Demo</span>
              </span>
            </div>
            <button
              onClick={() => setShowCart(true)}
              className="relative p-2.5 bg-primary text-white rounded-full shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              {getCartCount() > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
                  {getCartCount()}
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* Hero Banner */}
        <div className="bg-gradient-to-br from-primary/5 via-orange-50/50 to-amber-50/30 dark:from-primary/10 dark:via-card-dark dark:to-background-dark border-b border-border-light dark:border-border-dark py-12 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-bold text-sm mb-4"
            >
              <Sparkles className="w-4 h-4" />
              Sandbox Demo — Duitku Payment Gateway
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-extrabold text-text-light dark:text-text-dark mb-4"
            >
              Demo Pembayaran Online
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-muted max-w-xl mx-auto text-lg"
            >
              Pilih menu, tambahkan ke keranjang, dan coba alur pembayaran lengkap via Duitku Pop (Sandbox Mode)
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-3 justify-center mt-6"
            >
              {["QRIS", "Virtual Account", "E-Wallet", "Kartu Kredit"].map(method => (
                <span key={method} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-card-dark rounded-full text-xs font-bold text-muted border border-border-light dark:border-border-dark shadow-sm">
                  <CreditCard className="w-3.5 h-3.5 text-primary" /> {method}
                </span>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-extrabold text-text-light dark:text-text-dark">Menu Tersedia</h2>
              <p className="text-muted mt-1 text-sm">{menuItems.length} produk tersedia untuk dicoba</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark px-3 py-2 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span>Transaksi aman & terenkripsi</span>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-card-light dark:bg-card-dark rounded-2xl overflow-hidden border border-border-light dark:border-border-dark animate-pulse">
                  <div className="h-48 bg-gray-200 dark:bg-gray-700" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-xl w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-xl w-full" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-xl w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {menuItems.map(item => {
                const inCart = cart.find(c => c.id === item.id);
                return (
                  <motion.div
                    key={item.id}
                    variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                    whileHover={{ y: -6, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.12)" }}
                    className="bg-card-light dark:bg-card-dark rounded-2xl overflow-hidden border border-border-light dark:border-border-dark flex flex-col transition-all"
                  >
                    <div className="relative h-48 w-full">
                      <Image
                        src={item.image_url || "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop"}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                      {item.categories?.name && (
                        <span className="absolute top-3 left-3 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-white/90 dark:bg-black/60 text-primary backdrop-blur-sm">
                          {item.categories.name}
                        </span>
                      )}
                      <div className="absolute top-3 right-3 flex gap-0.5">
                        {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-lg text-text-light dark:text-text-dark mb-1">{item.name}</h3>
                      {item.description && (
                        <p className="text-sm text-muted line-clamp-2 leading-relaxed flex-1 mb-3">{item.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-auto">
                        <span className="font-extrabold text-xl text-primary">Rp {item.price.toLocaleString("id-ID")}</span>
                        {inCart ? (
                          <div className="flex items-center gap-2 bg-primary/10 rounded-xl p-1">
                            <button
                              onClick={() => updateQty(item.id, inCart.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-primary hover:text-white rounded-lg transition-colors text-primary"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-black text-primary text-sm w-5 text-center">{inCart.quantity}</span>
                            <button
                              onClick={() => updateQty(item.id, inCart.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-primary hover:text-white rounded-lg transition-colors text-primary"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => addToCart(item)}
                            className="p-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl transition-colors"
                          >
                            <Plus className="w-5 h-5" />
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Floating Cart Button (mobile) */}
        {getCartCount() > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 md:hidden"
          >
            <button
              onClick={() => setShowCart(true)}
              className="flex items-center gap-3 bg-primary text-white px-6 py-4 rounded-full shadow-2xl shadow-primary/40 font-black"
            >
              <ShoppingBag className="w-5 h-5" />
              Lihat Keranjang ({getCartCount()}) — Rp {getTotal().toLocaleString("id-ID")}
            </button>
          </motion.div>
        )}

        {/* Cart Drawer */}
        <AnimatePresence>
          {showCart && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCart(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", bounce: 0.1 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card-light dark:bg-card-dark z-50 flex flex-col shadow-2xl"
              >
                <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-text-light dark:text-text-dark">Keranjang</h2>
                    <p className="text-muted text-sm mt-0.5">{getCartCount()} item dipilih</p>
                  </div>
                  <button
                    onClick={() => setShowCart(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-muted" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {cart.length === 0 ? (
                    <div className="text-center py-16 text-muted">
                      <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-40" />
                      <p>Keranjang masih kosong</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.id} className="flex gap-4 items-center bg-background-light dark:bg-background-dark rounded-2xl p-4 border border-border-light dark:border-border-dark">
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                          <Image
                            src={item.image_url || "https://images.unsplash.com/photo-1544025162-d76694265947?w=200&h=200&fit=crop"}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-text-light dark:text-text-dark truncate">{item.name}</h4>
                          <p className="text-primary font-extrabold text-sm mt-0.5">Rp {item.price.toLocaleString("id-ID")}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => updateQty(item.id, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 rounded-lg transition-colors text-muted"
                          >
                            {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                          </button>
                          <span className="font-black text-text-light dark:text-text-dark w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQty(item.id, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors text-muted"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="p-6 border-t border-border-light dark:border-border-dark space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted font-medium">Total</span>
                      <span className="text-2xl font-black text-primary">Rp {getTotal().toLocaleString("id-ID")}</span>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Mode <strong>Sandbox Duitku</strong> — Tidak ada uang nyata yang ditagih. Gunakan kartu/akun tes Duitku.</span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCheckout}
                      disabled={checkoutLoading || !sdkReady}
                      className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-primary/30 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    >
                      {checkoutLoading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</>
                      ) : !sdkReady ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Memuat SDK...</>
                      ) : (
                        <><CreditCard className="w-5 h-5" /> Bayar Sekarang <ArrowRight className="w-5 h-5" /></>
                      )}
                    </motion.button>
                    <p className="text-center text-xs text-muted">
                      Diproses aman oleh <span className="font-bold text-primary">Duitku</span> Payment Gateway
                    </p>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
