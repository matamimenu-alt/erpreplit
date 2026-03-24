import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setRestaurantId, useListRestaurants } from "@workspace/api-client-react";

export interface Restaurant {
  id: number;
  name: string;
  nameAr?: string | null;
  createdAt: string;
}

interface RestaurantContextValue {
  restaurants: Restaurant[];
  activeRestaurant: Restaurant | null;
  setActiveRestaurantId: (id: number) => void;
  isLoading: boolean;
}

const RestaurantContext = createContext<RestaurantContextValue>({
  restaurants: [],
  activeRestaurant: null,
  setActiveRestaurantId: () => {},
  isLoading: true,
});

const STORAGE_KEY = "active_restaurant_id";

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: restaurants = [], isLoading } = useListRestaurants();

  const [activeId, setActiveId] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : 1;
  });

  useEffect(() => {
    setRestaurantId(activeId);
  }, [activeId]);

  useEffect(() => {
    if (!isLoading && restaurants.length > 0) {
      const exists = restaurants.some((r) => r.id === activeId);
      if (!exists) {
        const firstId = restaurants[0].id;
        setActiveId(firstId);
        setRestaurantId(firstId);
        localStorage.setItem(STORAGE_KEY, String(firstId));
      }
    }
  }, [isLoading, restaurants, activeId]);

  const handleSetActiveId = (id: number) => {
    setActiveId(id);
    setRestaurantId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
    queryClient.invalidateQueries();
  };

  const activeRestaurant = restaurants.find((r) => r.id === activeId) ?? null;

  return (
    <RestaurantContext.Provider
      value={{
        restaurants: restaurants as Restaurant[],
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
