import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setRestaurantId, useListRestaurants } from "@workspace/api-client-react";

export interface Restaurant {
  id: number;
  name: string;
  nameAr?: string | null;
  brandName?: string | null;
  branchCode?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  status: string;
  createdAt: string;
}

interface RestaurantContextValue {
  restaurants: Restaurant[];
  allRestaurants: Restaurant[];
  activeRestaurant: Restaurant | null;
  setActiveRestaurantId: (id: number) => void;
  isLoading: boolean;
}

const RestaurantContext = createContext<RestaurantContextValue>({
  restaurants: [],
  allRestaurants: [],
  activeRestaurant: null,
  setActiveRestaurantId: () => {},
  isLoading: true,
});

const STORAGE_KEY = "active_restaurant_id";

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: allRestaurantsRaw = [], isLoading } = useListRestaurants();

  const allRestaurants = allRestaurantsRaw as Restaurant[];
  const activeRestaurants = allRestaurants.filter(r => r.status === "active");

  const [activeId, setActiveId] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 1;
  });

  useEffect(() => {
    setRestaurantId(activeId);
  }, [activeId]);

  useEffect(() => {
    if (!isLoading && activeRestaurants.length > 0) {
      const exists = activeRestaurants.some(r => r.id === activeId);
      if (!exists) {
        const firstId = activeRestaurants[0].id;
        setActiveId(firstId);
        setRestaurantId(firstId);
        localStorage.setItem(STORAGE_KEY, String(firstId));
      }
    }
  }, [isLoading, activeRestaurants, activeId]);

  const handleSetActiveId = (id: number) => {
    setActiveId(id);
    setRestaurantId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
    queryClient.invalidateQueries();
  };

  const activeRestaurant = allRestaurants.find(r => r.id === activeId) ?? null;

  return (
    <RestaurantContext.Provider
      value={{
        restaurants: activeRestaurants,
        allRestaurants,
        activeRestaurant,
        setActiveRestaurantId: handleSetActiveId,
        isLoading,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  return useContext(RestaurantContext);
}
