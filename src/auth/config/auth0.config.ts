import { registerAs } from '@nestjs/config';

export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  issuer: string;
  callbackUrl: string;
  managementApiToken?: string;
  algorithms: string[];
}

export default registerAs(
  'auth0',
  (): Auth0Config => ({
    domain: process.env.AUTH0_DOMAIN ?? '',
    clientId: process.env.AUTH0_CLIENT_ID ?? '',
    clientSecret: process.env.AUTH0_CLIENT_SECRET ?? '',
    audience: process.env.AUTH0_AUDIENCE ?? '',
    // Always construct issuer from domain to ensure consistency
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    callbackUrl:
      process.env.AUTH0_CALLBACK_URL ?? 'http://localhost:3002/auth/callback',
    managementApiToken: process.env.AUTH0_MANAGEMENT_API_TOKEN,
    algorithms: ['RS256'],
  }),
);
