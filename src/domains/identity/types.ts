import { User, CustomerProfile, AdminProfile, Session } from "@/infrastructure/database/schema";
import { AdminRoleAssignment } from "../rbac/types";

export interface AuthenticatedUser {
  user: User;
  customerProfile?: CustomerProfile | null;
  adminProfile?: AdminProfile | null;
  adminRoles?: AdminRoleAssignment[];
  session: Session;
}

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
