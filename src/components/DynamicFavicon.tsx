"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";

export default function DynamicFavicon() {
  const supabase = createClient();
  const pathname = usePathname();
  const cachedUrl = useRef<string | null>(null);

  useEffect(() => {
    const updateFavicon = (url: string) => {
      // Find all icon links and update them, or create if missing
      let links: NodeListOf<HTMLLinkElement> = document.querySelectorAll("link[rel~='icon']");
      if (links.length === 0) {
        const link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
        links = document.querySelectorAll("link[rel~='icon']");
      }
      
      links.forEach(link => {
        link.href = url;
      });
    };

    const getFaviconUrl = async (fallbackLogoUrl: string) => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const faviconPath = `${supabaseUrl}/storage/v1/object/public/logos/favicon.png`;
      try {
        const res = await fetch(faviconPath, { method: 'HEAD', cache: 'no-store' });
        if (res.ok) {
          return `${faviconPath}?v=${Date.now()}`;
        }
      } catch (e) {}
      return fallbackLogoUrl;
    };

    const fetchFavicon = async () => {
      // If we already resolved the URL, just re-apply it immediately to prevent flicker
      if (cachedUrl.current) {
        updateFavicon(cachedUrl.current);
        return;
      }

      const { data } = await supabase.from('restaurant_settings').select('logo_url').single();
      const finalUrl = await getFaviconUrl(data?.logo_url || '/favicon.ico?v=3');
      cachedUrl.current = finalUrl;
      updateFavicon(finalUrl);
    };

    fetchFavicon();

    const channel = supabase.channel("favicon_sync")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurant_settings" }, async (payload: any) => {
        if (payload.new) {
          const finalUrl = await getFaviconUrl(payload.new.logo_url || '/favicon.ico?v=3');
          cachedUrl.current = finalUrl;
          updateFavicon(finalUrl);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pathname]); // Re-run effect whenever route changes

  return null;
}
