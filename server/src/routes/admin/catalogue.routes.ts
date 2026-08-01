import { Router } from "express";
import * as ctrl from "../../controllers/catalogue.controller";
import { authorize } from "../../middleware/authorize";
import { validateBody, validateQuery } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  categoryListQuerySchema,
  createCategorySchema,
  createProductSchema,
  productListQuerySchema,
  reorderSchema,
  statusSchema,
  updateCategorySchema,
  updateProductSchema,
} from "../../validators/catalogue.validator";

/**
 * `authenticate` is applied at the admin router mount.
 * Role matrix: docs/ADMIN_PANEL_SPECIFICATION.md §4
 *   read/write  — superadmin, admin, editor
 *   publish     — superadmin, admin, editor (products); admin+ (categories)
 *   delete      — superadmin, admin
 */

export const categoryRouter = Router();

categoryRouter.get(
  "/",
  authorize("superadmin", "admin", "editor"),
  validateQuery(categoryListQuerySchema),
  asyncHandler(ctrl.listCategories)
);

categoryRouter.post(
  "/",
  authorize("superadmin", "admin", "editor"),
  validateBody(createCategorySchema),
  asyncHandler(ctrl.createCategory)
);

categoryRouter.get(
  "/:id",
  authorize("superadmin", "admin", "editor"),
  asyncHandler(ctrl.getCategory)
);

categoryRouter.put(
  "/:id",
  authorize("superadmin", "admin", "editor"),
  validateBody(updateCategorySchema),
  asyncHandler(ctrl.updateCategory)
);

categoryRouter.patch(
  "/:id/status",
  authorize("superadmin", "admin"),
  validateBody(statusSchema),
  asyncHandler(ctrl.setCategoryStatus)
);

categoryRouter.delete(
  "/:id",
  authorize("superadmin", "admin"),
  asyncHandler(ctrl.deleteCategory)
);

export const productRouter = Router();

// Static path before /:id so "reorder" is not read as an identifier.
productRouter.patch(
  "/reorder",
  authorize("superadmin", "admin", "editor"),
  validateBody(reorderSchema),
  asyncHandler(ctrl.reorderProducts)
);

productRouter.get(
  "/",
  authorize("superadmin", "admin", "editor"),
  validateQuery(productListQuerySchema),
  asyncHandler(ctrl.listProducts)
);

productRouter.post(
  "/",
  authorize("superadmin", "admin", "editor"),
  validateBody(createProductSchema),
  asyncHandler(ctrl.createProduct)
);

productRouter.get(
  "/:id",
  authorize("superadmin", "admin", "editor"),
  asyncHandler(ctrl.getProduct)
);

productRouter.put(
  "/:id",
  authorize("superadmin", "admin", "editor"),
  validateBody(updateProductSchema),
  asyncHandler(ctrl.updateProduct)
);

productRouter.patch(
  "/:id/status",
  authorize("superadmin", "admin", "editor"),
  validateBody(statusSchema),
  asyncHandler(ctrl.setProductStatus)
);

productRouter.post(
  "/:id/duplicate",
  authorize("superadmin", "admin", "editor"),
  asyncHandler(ctrl.duplicateProduct)
);

productRouter.delete(
  "/:id",
  authorize("superadmin", "admin"),
  asyncHandler(ctrl.deleteProduct)
);
