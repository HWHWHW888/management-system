// Permission utility functions for role-based access control

// Boss role: Can view all data but cannot edit anything
export const isBossRole = (role: string): boolean => {
  return role === 'boss';
};

// Staff role: Cannot view sensitive financial data, limited editing
export const isStaffRole = (role: string): boolean => {
  return role === 'staff';
};

// Read-only for editing purposes (boss cannot edit, staff has limited access)
export const isReadOnlyRole = (role: string): boolean => {
  return role === 'boss' || role === 'staff';
};

// Can view sensitive financial data (admin, agent, boss can see; staff cannot)
export const canViewFinancialData = (role: string): boolean => {
  return role === 'admin' || role === 'agent' || role === 'boss';
};

// Can edit data (only admin and agent can edit; boss and staff cannot)
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
