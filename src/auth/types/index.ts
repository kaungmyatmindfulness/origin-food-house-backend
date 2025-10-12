import { Request } from 'express';

import { SessionContext } from 'src/auth/customer-session-jwt.strategy';

export interface RequestWithUser extends Request {
  user: {
    sub: string; // User ID
  };
}

export interface RequestWithCustomer extends Request {
  user: SessionContext; // SessionContext
}
