import { z } from "zod";
import { ROLES } from "../models/User";

/**
 * Minimum 12 characters, no composition rules — mandated symbol classes
 * produce "Password1!" and nothing else.
 * docs/SECURITY_ARCHITECTURE.md §3
 */
const password = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(200, "Password is too long.");

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Invalid email or password."),
    password: z.string().min(1, "Invalid email or password."),
  })
  .strip();

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
    password,
    role: z.enum(ROLES),
  })
  .strip();

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
