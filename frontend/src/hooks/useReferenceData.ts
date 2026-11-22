import { useQuery } from "@tanstack/react-query";
import { categoriesApi, productsApi } from "@/api/catalog";
import { warehousesApi } from "@/api/inventory";
import { customersApi, suppliersApi } from "@/api/partners";

/**
 * Listes de référence (menus déroulants, jointures id → nom).
 * L'API est paginée (max 100) : on charge la première page de 100 éléments. Si `count` dépasse 100,
 * `truncated` vaut true et l'UI peut le signaler (limitation documentée).
 */
function useReference<T>(key: string, fn: () => Promise<{ count: number; results: T[] }>) {
  const q = useQuery({ queryKey: ["ref", key], queryFn: fn, staleTime: 60_000 });
  return { ...q, items: q.data?.results ?? [], truncated: (q.data?.count ?? 0) > (q.data?.results.length ?? 0) };
}
export const useProductsRef = () => useReference("products", () => productsApi.list({ page_size: 100, ordering: "name" }));
export const useWarehousesRef = () => useReference("warehouses", () => warehousesApi.list({ page_size: 100 }));
export const useCategoriesRef = () => useReference("categories", () => categoriesApi.list({ page_size: 100 }));
export const useCustomersRef = () => useReference("customers", () => customersApi.list({ page_size: 100 }));
export const useSuppliersRef = () => useReference("suppliers", () => suppliersApi.list({ page_size: 100 }));
