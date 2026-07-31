import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "../models/User";
import { AppError, ErrorCode } from "./AppError";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

export function signAccessToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiry,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized("Session expired.", ErrorCode.TOKEN_EXPIRED);
    }
    throw AppError.unauthorized("Invalid token.", ErrorCode.TOKEN_INVALID);
  }
}
