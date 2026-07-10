export * from "./generated/api";
export * from "./generated/types";

// Explicit re-exports to resolve `export *` ambiguity (TS2308) between the
// generated zod value schemas and their same-named generated types:
// the zod value schema wins; use `z.infer<typeof X>` or import the type
// directly from "./generated/types" if the plain type is ever needed.
export {
  RemoveMonthlyOverrideParams,
  SetRestaurantStatusBody,
} from "./generated/api";
