"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

// Global CSRF Token & Nonce/Timestamp Fetch Wrapper untuk mutasi data (POST, PUT, DELETE)
if (typeof window !== "undefined" && !(window as any).__fetchOverridden) {
  (window as any).__fetchOverridden = true;
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const method = (init?.method || "GET").toUpperCase();
    if (["POST", "PUT", "DELETE"].includes(method)) {
      init = init || {};
      init.headers = init.headers || {};

      const setHeader = (key: string, val: string) => {
        if (init!.headers instanceof Headers) {
          init!.headers.set(key, val);
        } else if (Array.isArray(init!.headers)) {
          init!.headers.push([key, val]);
        } else {
          (init!.headers as Record<string, string>)[key] = val;
        }
      };

      // Generate Cryptographic Nonce & Timestamp
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
      const timestamp = String(Date.now());

      setHeader("x-nonce", nonce);
      setHeader("x-timestamp", timestamp);

      const getCsrfToken = () => {
        return document.cookie
          .split("; ")
          .find(row => row.startsWith("csrf-token="))
          ?.split("=")[1] || "";
      };
      
      const token = getCsrfToken();
      if (token) {
        setHeader("x-csrf-token", token);
      }
    }
    return originalFetch.call(this, input, init);
  };
}

export default function SessionStatusListener() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (
      pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot-password" ||
      pathname === "/"
    ) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    let activeUserId: string | null = null;

    const setupListener = async (userId: string) => {
      if (activeUserId === userId) return;
      activeUserId = userId;

      // Clean up previous channel if any
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Fetch profile to get status and profiles ID
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, status")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile in listener:", error);
        return;
      }

      if (!profile) return;

      // If already suspended/banned on mount, sign out
      if (profile.status === "suspended" || profile.status === "banned") {
        await supabase.auth.signOut();
        toast.error(
          profile.status === "banned"
            ? "Akun Anda telah diblokir permanen oleh manajemen."
            : "Akun Anda telah ditangguhkan sementara oleh manajemen.",
          { id: "suspend-toast", duration: 8000 }
        );
        router.push(`/login?suspended=${profile.status}&pid=${profile.id}`);
        return;
      }

      // Subscribe to real-time updates for the current user's profile row
      const channel = supabase
        .channel(`realtime-session-${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${profile.id}`,
          },
          async (payload) => {
            const newStatus = payload.new.status;
            if (newStatus === "suspended" || newStatus === "banned") {
              // Cleanup subscription first to prevent race condition loop
              if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
              }

              await supabase.auth.signOut();
              toast.error(
                newStatus === "banned"
                  ? "Akun Anda telah diblokir secara permanen oleh manajemen."
                  : "Akun Anda telah ditangguhkan sementara oleh manajemen.",
                { id: "suspend-toast", duration: 8000 }
              );
              
              // Direct replace to refresh router states
              window.location.href = `/login?suspended=${newStatus}&pid=${profile.id}`;
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    // Listen for auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        setupListener(session.user.id);
      } else {
        activeUserId = null;
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      }
    });

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        setupListener(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [router, supabase, pathname]);

  return null;
}
