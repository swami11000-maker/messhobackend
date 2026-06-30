export {};

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: string;
      type?: 'admin' | 'user';
      email?: string;
    }

    interface Request {
      user?: UserContext;
      accessToken?: string;
    }
  }
}
