import { Navigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import type { ReactNode } from "react";

interface RoleProtectedRoutesProps {
  allowedRoles: string[];
  children: ReactNode;
}

const RoleProtectedRoutes = ({
  allowedRoles,
  children,
}: RoleProtectedRoutesProps): ReactNode => {
  const { isAuthenticated, user } = useAuth();

  // Not logged in → send to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If role is not allowed → block
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RoleProtectedRoutes;