// Permission utility functions for role-based access control

export const isReadOnlyRole = (role: string): boolean => {
  return role === 'boss' || role === 'staff';
};

export const canEdit = (role: string): boolean => {
  return role === 'admin' || role === 'agent';
};

export const canView = (role: string): boolean => {
  return ['admin', 'agent', 'staff', 'boss'].includes(role);
};

export const canManageStaff = (role: string): boolean => {
  return role === 'admin' || role === 'boss';
};

export const canManageAgents = (role: string): boolean => {
  return role === 'admin' || role === 'boss';
};

export const canManageCustomers = (role: string): boolean => {
  return role === 'admin' || role === 'agent';
};

export const canAccessDashboard = (role: string): boolean => {
  return role === 'admin' || role === 'agent' || role === 'boss';
};

export const canAccessProjects = (role: string): boolean => {
  return role === 'admin' || role === 'agent' || role === 'boss';
};

export const canAccessData = (role: string): boolean => {
  return role === 'admin' || role === 'boss';
};

export const getPermissionMessage = (role: string): string => {
  switch (role) {
    case 'boss':
      return 'You have read-only access to all system data.';
    case 'staff':
      return 'You have limited access to customer and agent information.';
    case 'agent':
      return 'You can manage your customers and view relevant data.';
    case 'admin':
      return 'You have full administrative access to all system features.';
    default:
      return 'Access level not recognized.';
  }
};
