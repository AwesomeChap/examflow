import type { Request } from "express";

/**
 * Reads a route parameter as a string. Express 5 types `req.params` values as
 * `string | string[]`; for our single-value path params this helper narrows
 * the type in one place instead of casting at every call site.
 */
export function param(req: Request, name: string): string {
  return (req.params as Record<string, string>)[name];
}
