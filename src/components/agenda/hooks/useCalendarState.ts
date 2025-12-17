"use client";

import { useState, useEffect } from "react";

type ViewMode = "day" | "week" | "month" | "list";

interface CalendarState {
  selectedDate: string;
  viewMode: ViewMode;
  filters: {
    payment: string[];
    status: string[];
    staff: string[];
    highlighted: boolean | null;
  };
  showFreeSlots: boolean;
}

interface UseCalendarStateProps {
  initialDate?: string;
  initialViewMode?: ViewMode;
}

export function useCalendarState({
  initialDate,
  initialViewMode = "day",
}: UseCalendarStateProps = {}) {
  // Load from localStorage or use defaults
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agenda_selectedDate");
      return saved || initialDate || new Date().toISOString().split("T")[0];
    }
    return initialDate || new Date().toISOString().split("T")[0];
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agenda_viewMode") as ViewMode;
      return saved || initialViewMode;
    }
    return initialViewMode;
  });

  const [filters, setFilters] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agenda_filters");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Use defaults if parsing fails
        }
      }
    }
    return {
      payment: [] as string[],
      status: [] as string[],
      staff: [] as string[],
      highlighted: null as boolean | null,
    };
  });

  const [showFreeSlots, setShowFreeSlots] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agenda_showFreeSlots");
      return saved === "true";
    }
    return false;
  });

  // Save to localStorage when state changes
  useEffect(() => {
    localStorage.setItem("agenda_selectedDate", selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    localStorage.setItem("agenda_viewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("agenda_filters", JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem("agenda_showFreeSlots", showFreeSlots.toString());
  }, [showFreeSlots]);

  // State setters with validation
  const updateSelectedDate = (date: string) => {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(date)) {
      setSelectedDate(date);
    }
  };

  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const updateFilters = (newFilters: Partial<CalendarState['filters']>) => {
    setFilters((prev: CalendarState['filters']) => ({ ...prev, ...newFilters }));
  };

  const toggleFilter = (
    category: keyof CalendarState['filters'],
    value: string | boolean
  ) => {
    setFilters((prev: CalendarState['filters']) => {
      const updated = { ...prev };

      if (category === "highlighted") {
        updated.highlighted = value === prev.highlighted ? null : (value as boolean);
      } else if (typeof value === "string") {
        const array = updated[category] as string[];
        const index = array.indexOf(value);
        if (index >= 0) {
          array.splice(index, 1);
        } else {
          array.push(value);
        }
      }

      return updated;
    });
  };

  const clearFilters = () => {
    setFilters({
      payment: [],
      status: [],
      staff: [],
      highlighted: null,
    });
  };

  const toggleFreeSlots = () => {
    setShowFreeSlots(prev => !prev);
  };

  return {
    // State
    selectedDate,
    viewMode,
    filters,
    showFreeSlots,

    // Actions
    updateSelectedDate,
    updateViewMode,
    updateFilters,
    toggleFilter,
    clearFilters,
    toggleFreeSlots,

    // Computed
    state: {
      selectedDate,
      viewMode,
      filters,
      showFreeSlots,
    },
  };
}
