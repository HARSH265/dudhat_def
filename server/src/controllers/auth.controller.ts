import type { CookieOptions, Request, Response } from "express";
import { authService } from "../services/auth.service";
import { userRepository } from "../repositories/user.repository";
import { isProduction } from "../config/env";
import { AppError } from "../utils/AppError";
import { hashIp } from "../utils/crypto";
import type { CreateUserInput, LoginInput } from "../validators/auth.validator";

const REFRESH_COOKIE = "dd_refresh";

/**
 * HttpOnly so JavaScript cannot read it; SameSite=Strict so it is not sent
 * cross-site; path-scoped so it is only transmitted to the auth routes that
 * need it. docs/API_SPECIFICATION.md §5.1
 */
function refreshCookieOptions(expires: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/api/v1/admin/auth",
    expires,
  };
}

function context(req: Request) {
  const ipHash = hashIp(req.ip);
  const userAgent = req.headers["user-agent"];
  return {
    ...(ipHash ? { ipHash } : {}),
    ...(typeof userAgent === "string" ? { userAgent } : {}),
  };
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;
  const result = await authService.login(email, password, context(req));

  res.cookie(
    REFRESH_COOKIE,
    result.refreshToken,
    refreshCookieOptions(result.refreshExpiresAt)
  );

  // The access token goes in the body, to be held in memory by the client.
  // Never localStorage. docs/SECURITY_ARCHITECTURE.md §3
  res.status(200).json({
    success: true,
    message: "Signed in.",
    data: { accessToken: result.accessToken, user: result.user },
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) throw AppError.unauthorized("Session expired.");

  const result = await authService.refresh(token, context(req));

  res.cookie(
    REFRESH_COOKIE,
    result.refreshToken,
    refreshCookieOptions(result.refreshExpiresAt)
  );

  res.status(200).json({
    success: true,
    message: "Session refreshed.",
    data: { accessToken: result.accessToken, user: result.user },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
  res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/admin/auth" });
  res.status(200).json({ success: true, message: "Signed out.", data: {} });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await userRepository.findById(req.user!.id);
  if (!user) throw AppError.unauthorized("Session invalid.");

  res.status(200).json({
    success: true,
    message: "Current user.",
    data: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
    },
  });
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateUserInput;
  const user = await authService.createUser(input);

  res.status(201).json({
    success: true,
    message: "User created.",
    data: { id: user._id.toString(), email: user.email, role: user.role },
  });
}
