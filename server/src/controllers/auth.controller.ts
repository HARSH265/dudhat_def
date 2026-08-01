import mongoose from "mongoose";
import type { CookieOptions, Request, Response } from "express";
import { authService } from "../services/auth.service";
import type { Role } from "../models/User";
import { userRepository } from "../repositories/user.repository";
import { isProduction } from "../config/env";
import { AppError } from "../utils/AppError";
import { hashIp } from "../utils/crypto";
import type { CreateUserInput, LoginInput } from "../validators/auth.validator";

const REFRESH_COOKIE = "dd_refresh";

/**
 * Phase 1 review L6: this was a bare literal in three places. Changing the
 * router mount without changing all of them would silently break refresh and
 * logout — the browser simply stops sending a cookie scoped to a path that no
 * longer exists, with no error anywhere.
 */
const REFRESH_COOKIE_PATH = "/api/v1/admin/auth";

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
    path: REFRESH_COOKIE_PATH,
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
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
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

export async function logoutAll(req: Request, res: Response): Promise<void> {
  const revoked = await authService.logoutAll(
    new mongoose.Types.ObjectId(req.user!.id)
  );
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  res.status(200).json({
    success: true,
    message: "Signed out of all sessions.",
    data: { revoked },
  });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  const result = await authService.changePassword(
    new mongoose.Types.ObjectId(req.user!.id),
    currentPassword,
    newPassword,
    req.cookies?.[REFRESH_COOKIE] as string | undefined,
    context(req)
  );

  // The caller's session is rotated rather than ended, so changing a password
  // does not log you out of the device you are using.
  res.cookie(
    REFRESH_COOKIE,
    result.refreshToken,
    refreshCookieOptions(result.refreshExpiresAt)
  );

  res.status(200).json({
    success: true,
    message: "Password changed. Other sessions have been signed out.",
    data: { accessToken: result.accessToken, user: result.user },
  });
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  const sessions = await authService.listSessions(
    new mongoose.Types.ObjectId(req.user!.id),
    req.cookies?.[REFRESH_COOKIE] as string | undefined
  );
  res.status(200).json({
    success: true,
    message: "Sessions fetched.",
    data: sessions,
  });
}

export async function revokeSession(req: Request, res: Response): Promise<void> {
  await authService.revokeSession(
    new mongoose.Types.ObjectId(req.user!.id),
    req.params["id"]!,
    req.cookies?.[REFRESH_COOKIE] as string | undefined,
    context(req)
  );
  res.status(200).json({ success: true, message: "Session revoked.", data: {} });
}

export async function listUsers(_req: Request, res: Response): Promise<void> {
  const users = await authService.listUsers();
  res.status(200).json({ success: true, message: "Users fetched.", data: users });
}

export async function setUserStatus(req: Request, res: Response): Promise<void> {
  const { isActive } = req.body as { isActive: boolean };
  const user = await authService.setUserStatus(req.params["id"]!, isActive, {
    userId: new mongoose.Types.ObjectId(req.user!.id),
  });
  res.status(200).json({
    success: true,
    message: isActive ? "User activated." : "User deactivated.",
    data: user,
  });
}

export async function setUserRole(req: Request, res: Response): Promise<void> {
  const { role } = req.body as { role: Role };
  const user = await authService.setUserRole(req.params["id"]!, role, {
    userId: new mongoose.Types.ObjectId(req.user!.id),
  });
  res.status(200).json({ success: true, message: "Role updated.", data: user });
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
