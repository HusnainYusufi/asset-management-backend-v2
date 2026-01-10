import { UserRole } from '../../users/schemas/user.schema';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: UserRole;
  clientId?: string;
}
