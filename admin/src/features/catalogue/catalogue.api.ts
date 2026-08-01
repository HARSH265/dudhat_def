import { api, qs } from "@/lib/api";

export type ContentStatus = "draft" | "published" | "archived";

export interface SeoMeta {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  schemaType?: string;
  noIndex?: boolean;
  noFollow?: boolean;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  displayOrder: number;
  status: ContentStatus;
  seo?: SeoMeta;
  createdAt: string;
}

export interface SpecItem {
  group?: string;
  label: string;
  value: string;
  unit?: string;
  standard?: string;
  isKey?: boolean;
  /** Publishing is blocked while any spec carries this. docs/SEED_DATA.md */
  isPlaceholder?: boolean;
}

export interface PackagingVariant {
  label: string;
  slug: string;
  volume: number;
  unit: "L" | "mL" | "kg";
  containerType: "can" | "drum" | "ibc" | "bottle" | "tanker";
  sku?: string;
  image?: string;
  moq?: string;
  features?: string[];
  isAvailable?: boolean;
  displayOrder?: number;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  sku?: string;
  tagline?: string;
  categoryId: string;
  categoryName?: string;
  shortDescription?: string;
  description?: string | undefined;
  highlights?: string[];
  badges?: string[];
  specifications?: SpecItem[];
  packaging?: PackagingVariant[];
  applications?: string[];
  primaryImage?: string | undefined;
  gallery?: string[];
  brochure?: string;
  isFeatured: boolean;
  displayOrder: number;
  status: ContentStatus;
  publishedAt?: string;
  seo?: SeoMeta;
  viewCount: number;
  inquiryCount: number;
  createdAt: string;
  updatedAt: string;
}

export const catalogueApi = {
  listCategories: (params: { status?: string; search?: string } = {}) =>
    api.getPaged<Category>(`/admin/categories${qs({ limit: 100, ...params })}`),
  getCategory: (id: string) => api.get<Category>(`/admin/categories/${id}`),
  createCategory: (body: Partial<Category>) =>
    api.post<Category>("/admin/categories", body),
  updateCategory: (id: string, body: Partial<Category>) =>
    api.put<Category>(`/admin/categories/${id}`, body),
  setCategoryStatus: (id: string, status: ContentStatus) =>
    api.patch<Category>(`/admin/categories/${id}/status`, { status }),
  deleteCategory: (id: string) => api.delete(`/admin/categories/${id}`),

  listProducts: (params: { status?: string; search?: string; categoryId?: string } = {}) =>
    api.getPaged<Product>(`/admin/products${qs({ limit: 50, ...params })}`),
  getProduct: (id: string) => api.get<Product>(`/admin/products/${id}`),
  createProduct: (body: Partial<Product>) => api.post<Product>("/admin/products", body),
  updateProduct: (id: string, body: Partial<Product>) =>
    api.put<Product>(`/admin/products/${id}`, body),
  setProductStatus: (id: string, status: ContentStatus) =>
    api.patch<Product>(`/admin/products/${id}/status`, { status }),
  duplicateProduct: (id: string) => api.post<Product>(`/admin/products/${id}/duplicate`),
  deleteProduct: (id: string) => api.delete(`/admin/products/${id}`),
};

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};
