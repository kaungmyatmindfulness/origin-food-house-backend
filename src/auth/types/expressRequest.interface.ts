import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    id: number;
    storeId: number;
    email: string;
    verified?: boolean;
  };
}
