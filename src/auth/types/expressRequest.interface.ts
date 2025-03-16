import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    userId: number;
    shopId: number;
    email: string;
    verified?: boolean;
  };
}
