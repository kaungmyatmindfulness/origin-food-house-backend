import { registerAs } from "@nestjs/config";

export interface AdminAuth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  issuer: string;
}

export default registerAs(
  "adminAuth0",
  (): AdminAuth0Config => ({
    domain: process.env.ADMIN_AUTH0_DOMAIN ?? "",
    clientId: process.env.ADMIN_AUTH0_CLIENT_ID ?? "",
    clientSecret: process.env.ADMIN_AUTH0_CLIENT_SECRET ?? "",
    audience: process.env.ADMIN_AUTH0_AUDIENCE ?? "",
    issuer: process.env.ADMIN_AUTH0_ISSUER ?? "",
  }),
);
