import type { Category, Paginated, Product } from "@/types/api";
import { api, clean } from "./client";

export interface ProductInput {
  sku: string;
  name: string;
  description?: string;
  category: number;
  unit_price: string;
  is_active: boolean;
  reorder_level: string;
}
export interface ProductParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: string;
  is_active?: string;
  price_min?: string;
  price_max?: string;
  ordering?: string;
}

export const categoriesApi = {
  list: (params: { page?: number; search?: string; page_size?: number } = {}) =>
    api.get<Paginated<Category>>("/catalog/categories/", { params: clean(params) }).then((r) => r.data),
  create: (name: string) => api.post<Category>("/catalog/categories/", { name }).then((r) => r.data),
  update: (id: number, name: string) => api.patch<Category>(`/catalog/categories/${id}/`, { name }).then((r) => r.data),
  remove: (id: number) => api.delete(`/catalog/categories/${id}/`).then(() => undefined),
};

export const productsApi = {
  list: (params: ProductParams = {}) =>
    api.get<Paginated<Product>>("/catalog/products/", { params: clean({ ...params }) }).then((r) => r.data),
  get: (id: number) => api.get<Product>(`/catalog/products/${id}/`).then((r) => r.data),
  create: (body: ProductInput) => api.post<Product>("/catalog/products/", body).then((r) => r.data),
  update: (id: number, body: Partial<ProductInput>) =>
    api.patch<Product>(`/catalog/products/${id}/`, body).then((r) => r.data),
  deactivate: (id: number) => api.post<Product>(`/catalog/products/${id}/deactivate/`).then((r) => r.data),
};
