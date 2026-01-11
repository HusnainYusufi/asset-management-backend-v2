declare module 'bcryptjs' {
  export function hash(data: string, saltOrRounds: number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
}

declare module 'passport-jwt' {
  import type { Request } from 'express';

  export interface StrategyOptions {
    jwtFromRequest: (req: Request) => string | null;
    secretOrKey: string;
    ignoreExpiration?: boolean;
    issuer?: string;
    audience?: string;
    algorithms?: string[];
  }

  export class Strategy {
    constructor(
      options: StrategyOptions,
      verify?: (...args: unknown[]) => void,
    );
  }

  export const ExtractJwt: {
    fromAuthHeaderAsBearerToken(): (req: Request) => string | null;
  };
}
