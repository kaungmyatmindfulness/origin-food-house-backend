import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    id: number;
    shopId: number;
    email: string;
    verified?: boolean;
  };
}
