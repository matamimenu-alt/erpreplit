import type { Request } from "express";

export function getRestaurantId(req: Request): number {
  const header = req.headers["x-restaurant-id"];
  if (header) {
    const id = parseInt(String(header), 10);
    if (!isNaN(id) && id > 0) return id;
  }
  return 1;
}
