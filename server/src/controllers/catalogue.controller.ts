import mongoose from "mongoose";
import type { Request, Response } from "express";
import { categoryService } from "../services/category.service";
import { productService } from "../services/product.service";
import { query } from "../middleware/validate";
import type { ContentStatus } from "../models/shared";
import type {
  CategoryListQuery,
  CreateCategoryInput,
  CreateProductInput,
  ProductListQuery,
  UpdateCategoryInput,
  UpdateProductInput,
} from "../validators/catalogue.validator";

function actor(req: Request) {
  return { userId: new mongoose.Types.ObjectId(req.user!.id) };
}

function paged(res: Response, items: unknown[], total: number, page: number, limit: number, message: string) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  res.status(200).json({
    success: true,
    message,
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}

// --- Categories ---

export async function listCategories(_req: Request, res: Response): Promise<void> {
  const q = query<CategoryListQuery>(res);
  const { items, total } = await categoryService.list(q);
  paged(res, items, total, q.page, q.limit, "Categories fetched.");
}

export async function getCategory(req: Request, res: Response): Promise<void> {
  const category = await categoryService.get(req.params["id"]!);
  res.status(200).json({ success: true, message: "Category fetched.", data: category });
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  const category = await categoryService.create(
    req.body as CreateCategoryInput,
    actor(req)
  );
  res.status(201).json({ success: true, message: "Category created.", data: category });
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  const category = await categoryService.update(
    req.params["id"]!,
    req.body as UpdateCategoryInput,
    actor(req)
  );
  res.status(200).json({ success: true, message: "Category updated.", data: category });
}

export async function setCategoryStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body as { status: ContentStatus };
  const category = await categoryService.setStatus(req.params["id"]!, status, actor(req));
  res.status(200).json({
    success: true,
    message: `Category ${status}.`,
    data: category,
  });
}

export async function deleteCategory(req: Request, res: Response): Promise<void> {
  await categoryService.remove(req.params["id"]!, actor(req));
  res.status(200).json({ success: true, message: "Category deleted.", data: {} });
}

// --- Products ---

export async function listProducts(_req: Request, res: Response): Promise<void> {
  const q = query<ProductListQuery>(res);
  const { items, total } = await productService.list(q);
  paged(res, items, total, q.page, q.limit, "Products fetched.");
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const product = await productService.get(req.params["id"]!);
  res.status(200).json({ success: true, message: "Product fetched.", data: product });
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  const product = await productService.create(
    req.body as CreateProductInput,
    actor(req)
  );
  res.status(201).json({ success: true, message: "Product created.", data: product });
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  const product = await productService.update(
    req.params["id"]!,
    req.body as UpdateProductInput,
    actor(req)
  );
  res.status(200).json({ success: true, message: "Product updated.", data: product });
}

export async function setProductStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body as { status: ContentStatus };
  const product = await productService.setStatus(req.params["id"]!, status, actor(req));
  res.status(200).json({
    success: true,
    message: `Product ${status}.`,
    data: product,
  });
}

export async function reorderProducts(req: Request, res: Response): Promise<void> {
  const { items } = req.body as { items: { id: string; displayOrder: number }[] };
  const modified = await productService.reorder(items, actor(req));
  res.status(200).json({
    success: true,
    message: "Order updated.",
    data: { modified },
  });
}

export async function duplicateProduct(req: Request, res: Response): Promise<void> {
  const product = await productService.duplicate(req.params["id"]!, actor(req));
  res.status(201).json({ success: true, message: "Product duplicated.", data: product });
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  await productService.remove(req.params["id"]!, actor(req));
  res.status(200).json({ success: true, message: "Product deleted.", data: {} });
}
