import { createContext, useContext } from "react";
import type { Tables } from "@/integrations/supabase/types";
import type { Business } from "./ShopSettings";

export type ShopSettingsTab = "profile" | "catalogue" | "qr";

export type MerchantStoreContextValue = {
  business: Business;
  newOrders: number;
  activeOrders: number;
  publishedProducts: number | null;
  recentOrders: Tables<"pickup_orders">[];
  ordersVersion: number;
  storeError: string | null;
  publishing: boolean;
  openOrders: () => void;
  openShopSettings: (tab?: ShopSettingsTab) => void;
  togglePublish: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshStore: () => Promise<void>;
};

const MerchantStoreContext = createContext<MerchantStoreContextValue | null>(null);

export const MerchantStoreProvider = MerchantStoreContext.Provider;

export function useMerchantStore() {
  return useContext(MerchantStoreContext);
}
