"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DynamicFavicon() {
  const supabase = createClient();

  useEffect(() => {
    const updateFavicon = (url: string) => {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = url;
    };

    const getFaviconUrl = async (fallbackLogoUrl: string) => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const faviconPath = `${supabaseUrl}/storage/v1/object/public/logos/favicon.png`;
      try {
        // Quick HEAD request to check if custom favicon exists
        const res = await fetch(faviconPath, { method: 'HEAD', cache: 'no-store' });
        if (res.ok) {
          return `${faviconPath}?v=${Date.now()}`;
        }
      } catch (e) {}
      return fallbackLogoUrl;
    };

    // Initial fetch
    const fetchFavicon = async () => {
      const { data } = await supabase.from('restaurant_settings').select('logo_url').single();
      const finalUrl = await getFaviconUrl(data?.logo_url || '/favicon.ico');
      updateFavicon(finalUrl);
    };
    fetchFavicon();

    // Subscribe to realtime changes
    const channel = supabase.channel("favicon_sync")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurant_settings" }, async (payload: any) => {
        if (payload.new) {
          const finalUrl = await getFaviconUrl(payload.new.logo_url || '/favicon.ico');
          updateFavicon(finalUrl);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
