import type { FastifyRequest } from 'fastify';
import type { Role } from '../../common/enums/role.enum';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: Role;
}

export type AuthenticatedRequest = FastifyRequest & { user?: AuthenticatedUser };
