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

    // Initial fetch
    const fetchLogo = async () => {
      const { data } = await supabase.from('restaurant_settings').select('logo_url').single();
      if (data && data.logo_url) {
        updateFavicon(data.logo_url);
      }
    };
    fetchLogo();

    // Subscribe to realtime changes
    const channel = supabase.channel("favicon_sync")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurant_settings" }, (payload: any) => {
        if (payload.new && payload.new.logo_url) {
          updateFavicon(payload.new.logo_url);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
