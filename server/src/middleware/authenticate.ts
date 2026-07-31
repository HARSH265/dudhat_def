import type { NextFunction, Request, Response } from "express";
import type { Role } from "../models/User";
import { userRepository } from "../repositories/user.repository";
import { AppError, ErrorCode } from "../utils/AppError";
import { verifyAccessToken } from "../utils/jwt";
import { asyncHandler } from "../utils/asyncHandler";

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthenticatedUser;
  }
}

/**
 * Applied at the admin router mount, not per route, so a route added without
 * an explicit gate is inaccessible rather than open.
 * docs/SECURITY_ARCHITECTURE.md §4
 */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw AppError.unauthorized("Authentication required.", ErrorCode.TOKEN_INVALID);
    }

    const payload = verifyAccessToken(header.slice(7));

    // The token is valid, but the account may have been deactivated or its
    // password changed since it was issued.
    const user = await userRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      throw AppError.unauthorized("Session invalid.", ErrorCode.TOKEN_INVALID);
    }

    if (user.passwordChangedAt) {
      const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (payload.iat < changedAtSec) {
        throw AppError.unauthorized("Session expired.", ErrorCode.TOKEN_EXPIRED);
      }
    }

    // Role comes from the database, not the token, so a role change takes
    // effect without waiting for the access token to expire.
    req.user = { id: user._id.toString(), role: user.role };
    next();
  }
);
