"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AutoTableStatusManager() {
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const occupiedTablesRef = useRef<Map<string, string>>(new Map()); // Map of tableId -> occupied_at

  useEffect(() => {
    // 1. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      occupiedTablesRef.current.clear();
      return;
    }

    // 2. Load restaurant settings once (auto-empty duration)
    const loadSettingsAndTables = async () => {
      try {
        const { data: settingsData } = await supabase
          .from("restaurant_settings")
          .select("auto_empty_hours, auto_empty_minutes, auto_empty_seconds")
          .single();

        if (settingsData) {
          setSettings(settingsData);
        }

        // 3. Load currently occupied tables
        const { data: tablesData } = await supabase
          .from("tables")
          .select("id, status, occupied_at")
          .eq("status", "occupied");

        if (tablesData) {
          const map = new Map<string, string>();
          tablesData.forEach((table) => {
            if (table.occupied_at) {
              map.set(table.id, table.occupied_at);
            }
          });
          occupiedTablesRef.current = map;
        }
      } catch (err) {
        console.error("AutoTableStatusManager load error:", err);
      }
    };

    loadSettingsAndTables();

    // 4. Subscribe to restaurant settings changes
    const settingsChannel = supabase
      .channel("auto-table-settings-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "restaurant_settings" },
        (payload) => {
          setSettings(payload.new);
        }
      )
      .subscribe();

    // 5. Subscribe to tables changes in realtime
    const tablesChannel = supabase
      .channel("auto-table-tables-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables" },
        (payload) => {
          const map = occupiedTablesRef.current;
          if (payload.eventType === "DELETE") {
            map.delete(payload.old.id);
          } else {
            const table = payload.new;
            if (table.status === "occupied" && table.occupied_at) {
              map.set(table.id, table.occupied_at);
            } else {
              map.delete(table.id);
            }
          }
        }
      )
      .subscribe();

    // 6. Setup checker interval (every 3 seconds)
    const interval = setInterval(async () => {
      if (!settings) return;

      const totalTimeoutSeconds =
        (settings.auto_empty_hours || 0) * 3600 +
        (settings.auto_empty_minutes || 0) * 60 +
        (settings.auto_empty_seconds || 0);

      // If duration is set to 0, it means auto-clear is disabled
      if (totalTimeoutSeconds <= 0) return;

      const nowMs = Date.now();
      const expiredTableIds: string[] = [];

      occupiedTablesRef.current.forEach((occupiedAt, tableId) => {
        const occupiedMs = Date.parse(occupiedAt);
        if (isNaN(occupiedMs)) return;

        const elapsedSeconds = (nowMs - occupiedMs) / 1000;
        if (elapsedSeconds >= totalTimeoutSeconds) {
          expiredTableIds.push(tableId);
        }
      });

      if (expiredTableIds.length > 0) {
        // Clear locally immediately to prevent duplicate runs
        expiredTableIds.forEach((id) => occupiedTablesRef.current.delete(id));

        // Update database in background
        try {
          await supabase
            .from("tables")
            .update({ status: "available", occupied_at: null })
            .in("id", expiredTableIds);
        } catch (error) {
          console.error("AutoTableStatusManager failed to clear tables:", error);
        }
      }
    }, 3000);

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(tablesChannel);
      clearInterval(interval);
    };
  }, [session, settings]);

  return null;
}
