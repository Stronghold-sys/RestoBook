/**
 * Utility functions for checking and managing restaurant operational hours.
 */

export interface OperationalStatus {
  isOpen: boolean;
  message: string;
}

/**
 * Checks if the current local time is within the restaurant's operational hours.
 * Handles normal hours (e.g., 08:00 - 22:00) and overnight hours (e.g., 22:00 - 04:00).
 */
export function isRestaurantOpen(openingTime?: string | null, closingTime?: string | null): boolean {
  if (!openingTime || !closingTime) return true; // If not configured, assume open

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeInMinutes = currentHours * 60 + currentMinutes;

  // Split and parse opening time (handles formats like "08:00" or "08:00:00")
  const [openHours, openMinutes] = openingTime.split(":").map(Number);
  const [closeHours, closeMinutes] = closingTime.split(":").map(Number);

  if (isNaN(openHours) || isNaN(openMinutes) || isNaN(closeHours) || isNaN(closeMinutes)) {
    return true; // Fallback if format is invalid
  }

  const openTimeInMinutes = openHours * 60 + openMinutes;
  const closeTimeInMinutes = closeHours * 60 + closeMinutes;

  // If opening time is exactly equal to closing time, consider it open 24 hours
  if (openTimeInMinutes === closeTimeInMinutes) {
    return true;
  }

  if (closeTimeInMinutes >= openTimeInMinutes) {
    // Standard hours, e.g., 08:00 to 22:00
    return currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes;
  } else {
    // Overnight hours, e.g., 22:00 to 04:00 (next day)
    return currentTimeInMinutes >= openTimeInMinutes || currentTimeInMinutes < closeTimeInMinutes;
  }
}

/**
 * Formats a time string (HH:MM:SS or HH:MM) to a clean format (HH:MM).
 */
export function formatTimeString(timeString?: string | null): string {
  if (!timeString) return "";
  const parts = timeString.split(":");
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  return timeString;
}

/**
 * Formats a date string (YYYY-MM-DD) into a clean Indonesian weekday and date string (e.g., "Senin, 11 Mei 2026").
 */
export function formatToIndonesianDate(dateStr: string): string {
  if (!dateStr) return "";
  const isDatePattern = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!isDatePattern) return dateStr;

  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Returns the operational status and a descriptive message.
 */
export interface StoreStatus {
  isOpen: boolean;
  statusType: "open" | "closed" | "temporary_closed" | "holiday";
  message: string;
}

/**
 * Returns the operational status and a descriptive message based on standard hours, holidays, and temporary closures.
 */
export function getStoreStatus(
  openingTime?: string | null,
  closingTime?: string | null,
  isTemporaryClosed?: boolean | null,
  isHoliday?: boolean | null,
  holidayReopenDate?: string | null,
  temporaryClosedReopenTime?: string | null,
  is24Hours?: boolean | null
): StoreStatus {
  const now = new Date();

  // 1. Holiday dynamic check
  let activeHoliday = !!isHoliday;
  if (activeHoliday && holidayReopenDate) {
    const isDatePattern = /^\d{4}-\d{2}-\d{2}$/.test(holidayReopenDate);
    if (isDatePattern) {
      const localYear = now.getFullYear();
      const localMonth = (now.getMonth() + 1).toString().padStart(2, "0");
      const localDay = now.getDate().toString().padStart(2, "0");
      const localTodayStr = `${localYear}-${localMonth}-${localDay}`;
      
      if (localTodayStr >= holidayReopenDate) {
        activeHoliday = false; // Holiday has expired, auto-reopened!
      }
    }
  }

  if (activeHoliday) {
    const reopen = holidayReopenDate ? formatToIndonesianDate(holidayReopenDate) : "Besok";
    return {
      isOpen: false,
      statusType: "holiday",
      message: `resto sedang libur. Akan dibuka kembali ${reopen}`,
    };
  }

  // 2. Temporary closed dynamic check
  let activeTemporaryClosed = !!isTemporaryClosed;
  if (activeTemporaryClosed && temporaryClosedReopenTime) {
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    const [reopenHours, reopenMinutes] = temporaryClosedReopenTime.split(":").map(Number);
    if (!isNaN(reopenHours) && !isNaN(reopenMinutes)) {
      const reopenTimeInMinutes = reopenHours * 60 + reopenMinutes;
      if (currentTimeInMinutes >= reopenTimeInMinutes) {
        activeTemporaryClosed = false; // Temporary closure elapsed, auto-reopened!
      }
    }
  }

  if (activeTemporaryClosed) {
    const formattedReopen = formatTimeString(temporaryClosedReopenTime);
    return {
      isOpen: false,
      statusType: "temporary_closed",
      message: `resto sedang tutup sementara. Akan dibuka kembali pukul ${formattedReopen || "12:00"}`,
    };
  }

  // Check if configured as 24 hours (via parameter toggle or legacy same time)
  const active24Hours = !!is24Hours || !!(openingTime && closingTime && (openingTime.substring(0, 5) === closingTime.substring(0, 5)));

  if (active24Hours) {
    return {
      isOpen: true,
      statusType: "open",
      message: "resto buka 24 jam",
    };
  }

  const open = isRestaurantOpen(openingTime, closingTime);
  const formattedOpen = formatTimeString(openingTime);
  const formattedClose = formatTimeString(closingTime);

  if (open) {
    return {
      isOpen: true,
      statusType: "open",
      message: `resto buka hingga pukul ${formattedClose || "22:00"}`,
    };
  } else {
    return {
      isOpen: false,
      statusType: "closed",
      message: `resto sedang tutup. Akan dibuka kembali pukul ${formattedOpen || "08:00"}`,
    };
  }
}

/**
 * Returns the operational status and a descriptive message (legacy fallback).
 */
export function getOperationalStatus(openingTime?: string | null, closingTime?: string | null): OperationalStatus {
  const open = isRestaurantOpen(openingTime, closingTime);
  const formattedOpen = formatTimeString(openingTime);
  const formattedClose = formatTimeString(closingTime);

  if (open) {
    return {
      isOpen: true,
      message: `Restoran Buka - Jam Operasional: ${formattedOpen} - ${formattedClose}`,
    };
  } else {
    return {
      isOpen: false,
      message: `Restoran Tutup - Buka Kembali Pukul: ${formattedOpen}`,
    };
  }
}

/**
 * Calculates the remaining minutes until closing time.
 */
export function getMinutesUntilClose(closingStr: string | null): number {
  if (!closingStr) return 999;
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTotalMinutes = currentHours * 60 + currentMinutes;

  const [closeHours, closeMinutes] = closingStr.split(":").map(Number);
  if (isNaN(closeHours) || isNaN(closeMinutes)) return 999;
  const closeTotalMinutes = closeHours * 60 + closeMinutes;

  if (closeTotalMinutes >= currentTotalMinutes) {
    return closeTotalMinutes - currentTotalMinutes;
  } else {
    return (closeTotalMinutes + 24 * 60) - currentTotalMinutes;
  }
}
