import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { UserRole } from "@examflow/shared-types";
import { env } from "./env.js";

const SALT_ROUNDS = 12;

export type AuthTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plain, passwordHash);
}

export function signAuthToken(payload: AuthTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret);

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.sub !== "string" ||
    typeof (decoded as Record<string, unknown>).email !== "string" ||
    typeof (decoded as Record<string, unknown>).role !== "string"
  ) {
    throw new Error("Invalid token payload");
  }

  return {
    sub: decoded.sub,
    email: (decoded as Record<string, unknown>).email as string,
    role: (decoded as Record<string, unknown>).role as UserRole,
  };
}
