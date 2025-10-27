export interface JwtPayload {
  sub: string; // User ID
  storeId: string;
  jwtVersion?: number; // JWT version for invalidation
}
