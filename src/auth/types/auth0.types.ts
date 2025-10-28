import { User } from "@prisma/client";
import { Request } from "express";

export interface Auth0UserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  nickname?: string;
  updated_at?: string;
  created_at?: string;
}

export interface Auth0TokenPayload {
  iss: string;
  sub: string;
  aud: string[] | string;
  iat: number;
  exp: number;
  azp?: string;
  scope?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export interface Auth0UserCreateData {
  connection: string;
  email: string;
  password?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export interface Auth0ManagementApiError {
  statusCode: number;
  error: string;
  message: string;
  errorCode?: string;
}

export interface Auth0AuthenticatedUser extends User {
  auth0Payload?: Auth0TokenPayload;
}

export interface Auth0Request extends Request {
  auth?: Auth0TokenPayload;
  user?: Auth0AuthenticatedUser;
}
