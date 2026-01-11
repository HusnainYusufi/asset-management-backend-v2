export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  roleId: string;
  roleName: string;
  clientId?: string;
}
