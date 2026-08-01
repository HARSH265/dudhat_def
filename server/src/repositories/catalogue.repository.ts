import mongoose, { type FilterQuery, type Types } from "mongoose";
import Category, { type ICategory } from "../models/Category";
import Product, { type IProduct } from "../models/Product";
import type { Paged } from "./lead.repository";
import type {
  CategoryListQuery,
  ProductListQuery,
} from "../validators/catalogue.validator";

/**
 * A user-supplied search string reaches a $regex. Without escaping, input
 * like `(((((` is a malformed pattern (500) and `(a+)+$` is catastrophic
 * backtracking — a denial of service from a search box.
 */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const categoryRepository = {
  async create(data: Partial<ICategory>): Promise<ICategory> {
    return Category.create(data);
  },

  async findById(id: string): Promise<ICategory | null> {
    return Category.findOne({ _id: id, isDeleted: false });
  },

  async findBySlug(slug: string): Promise<ICategory | null> {
    return Category.findOne({ slug, isDeleted: false });
  },

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const filter: FilterQuery<ICategory> = { slug, isDeleted: false };
    if (excludeId) filter._id = { $ne: excludeId };
    return (await Category.countDocuments(filter)) > 0;
  },

  async list(q: CategoryListQuery): Promise<Paged<ICategory>> {
    const filter: FilterQuery<ICategory> = { isDeleted: false };
    if (q.status) filter.status = q.status;
    if (q.parentId) filter.parentId = q.parentId;
    // trusted(): this filter reaches Category.find(), which applies
    // sanitizeFilter's $eq wrapping and would fail to cast the operator
    // object against the String path. docs/MONGOOSE_GOTCHAS.md §1
    if (q.search) {
      filter.name = mongoose.trusted({ $regex: escapeRegex(q.search), $options: "i" });
    }

    const [items, total] = await Promise.all([
      Category.find(filter)
        .sort({ displayOrder: 1, name: 1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean<ICategory[]>(),
      Category.countDocuments(filter),
    ]);
    return { items, total };
  },

  async update(id: string, patch: Partial<ICategory>): Promise<ICategory | null> {
    return Category.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: patch },
      { new: true, runValidators: true }
    );
  },

  async softDelete(id: string, deletedBy: Types.ObjectId): Promise<ICategory | null> {
    return Category.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
      { new: true }
    );
  },

  async countChildren(parentId: string): Promise<number> {
    return Category.countDocuments({ parentId, isDeleted: false });
  },
};

export const productRepository = {
  async create(data: Partial<IProduct>): Promise<IProduct> {
    return Product.create(data);
  },

  async findById(id: string): Promise<IProduct | null> {
    return Product.findOne({ _id: id, isDeleted: false });
  },

  async findBySlug(slug: string): Promise<IProduct | null> {
    return Product.findOne({ slug, isDeleted: false });
  },

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const filter: FilterQuery<IProduct> = { slug, isDeleted: false };
    if (excludeId) filter._id = { $ne: excludeId };
    return (await Product.countDocuments(filter)) > 0;
  },

  async list(q: ProductListQuery): Promise<Paged<IProduct>> {
    const filter: FilterQuery<IProduct> = { isDeleted: false };
    if (q.status) filter.status = q.status;
    if (q.categoryId) filter.categoryId = q.categoryId;
    if (q.featured !== undefined) filter.isFeatured = q.featured;
    if (q.search) filter.$text = { $search: q.search };

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort(q.sort)
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean<IProduct[]>(),
      Product.countDocuments(filter),
    ]);
    return { items, total };
  },

  async update(id: string, patch: Partial<IProduct>): Promise<IProduct | null> {
    return Product.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: patch },
      { new: true, runValidators: true }
    );
  },

  async softDelete(id: string, deletedBy: Types.ObjectId): Promise<IProduct | null> {
    return Product.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
      { new: true }
    );
  },

  /** Blocks archiving a category that published products still reference. */
  async countPublishedInCategory(categoryId: string): Promise<number> {
    return Product.countDocuments({
      categoryId,
      status: "published",
      isDeleted: false,
    });
  },

  async countInCategory(categoryId: string): Promise<number> {
    return Product.countDocuments({ categoryId, isDeleted: false });
  },

  async listPublishedInCategory(categoryId: string): Promise<IProduct[]> {
    return Product.find({ categoryId, status: "published", isDeleted: false })
      .select("name slug")
      .lean<IProduct[]>();
  },

  async bulkReorder(items: { id: string; displayOrder: number }[]): Promise<number> {
    const ops = items.map((i) => ({
      updateOne: {
        filter: { _id: i.id, isDeleted: false },
        update: { $set: { displayOrder: i.displayOrder } },
      },
    }));
    const result = await Product.bulkWrite(ops);
    return result.modifiedCount;
  },

  async refreshCategoryName(categoryId: string, categoryName: string): Promise<number> {
    // Denormalised copy must follow a category rename.
    const result = await Product.updateMany(
      { categoryId, isDeleted: false },
      { $set: { categoryName } }
    );
    return result.modifiedCount;
  },
};
