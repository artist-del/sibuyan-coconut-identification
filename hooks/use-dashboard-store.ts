"use client";

import { create } from "zustand";

type DashboardState = {
  search: string;
  setSearch: (value: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
};

export const useDashboardStore = create<DashboardState>((set) => ({
  search: "",
  setSearch: (search) => set({ search }),
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen })
}));
