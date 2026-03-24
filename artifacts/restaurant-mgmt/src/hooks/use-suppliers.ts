import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateSupplier, 
  useUpdateSupplier, 
  useDeleteSupplier,
  getListSuppliersQueryKey,
  useCreateSupplierProduct,
  useUpdateSupplierProduct,
  useDeleteSupplierProduct,
  getListSupplierProductsQueryKey,
  getGetSupplierPriceComparisonQueryKey
} from "@workspace/api-client-react";

export function useSupplierMutations() {
  const queryClient = useQueryClient();

  const invalidateSuppliers = () => {
    queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
  };

  const createSupplier = useCreateSupplier({ mutation: { onSuccess: invalidateSuppliers } });
  const updateSupplier = useUpdateSupplier({ mutation: { onSuccess: invalidateSuppliers } });
  const removeSupplier = useDeleteSupplier({ mutation: { onSuccess: invalidateSuppliers } });

  return { createSupplier, updateSupplier, removeSupplier };
}

export function useSupplierProductMutations() {
  const queryClient = useQueryClient();

  const invalidateProducts = () => {
    queryClient.invalidateQueries({ queryKey: getListSupplierProductsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSupplierPriceComparisonQueryKey() });
  };

  const createProduct = useCreateSupplierProduct({ mutation: { onSuccess: invalidateProducts } });
  const updateProduct = useUpdateSupplierProduct({ mutation: { onSuccess: invalidateProducts } });
  const removeProduct = useDeleteSupplierProduct({ mutation: { onSuccess: invalidateProducts } });

  return { createProduct, updateProduct, removeProduct };
}
