import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  get isProduction() {
    return this.nodeEnv === "production";
  },
  port: Number(process.env.PORT) || 3000,
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1d",
  authCookieName: process.env.AUTH_COOKIE_NAME ?? "examflow_token",
};
