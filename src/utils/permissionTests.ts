// Permission system test suite
import { 
  isBossRole, 
  isStaffRole, 
  isReadOnlyRole, 
  canViewFinancialData, 
  canEdit, 
  canView,
  canManageStaff,
  canManageAgents,
  canManageCustomers,
  canAccessDashboard,
  canAccessProjects,
  canAccessData,
  getPermissionMessage
} from './permissions';

// Test data for different user roles
const testRoles = ['admin', 'agent', 'boss', 'staff', 'unknown'];

export const runPermissionTests = () => {
  console.group('🔐 Role-Based Permission Tests');
  
  testRoles.forEach(role => {
    console.group(`👤 Testing role: ${role}`);
    
    const results = {
      isBoss: isBossRole(role),
      isStaff: isStaffRole(role),
      isReadOnly: isReadOnlyRole(role),
      canViewFinancials: canViewFinancialData(role),
      canEdit: canEdit(role),
      canView: canView(role),
      canManageStaff: canManageStaff(role),
      canManageAgents: canManageAgents(role),
      canManageCustomers: canManageCustomers(role),
      canAccessDashboard: canAccessDashboard(role),
      canAccessProjects: canAccessProjects(role),
      canAccessData: canAccessData(role),
      message: getPermissionMessage(role)
    };
    
    console.table(results);
    console.groupEnd();
  });
  
  // Specific test cases for business logic
  console.group('🧪 Business Logic Tests');
  
  // Boss role tests
  console.log('✅ Boss can view financials:', canViewFinancialData('boss'));
  console.log('❌ Boss cannot edit:', !canEdit('boss'));
  console.log('✅ Boss is read-only:', isReadOnlyRole('boss'));
  
  // Staff role tests  
  console.log('❌ Staff cannot view financials:', !canViewFinancialData('staff'));
  console.log('❌ Staff cannot edit:', !canEdit('staff'));
  console.log('✅ Staff is read-only:', isReadOnlyRole('staff'));
  
  // Admin role tests
  console.log('✅ Admin can view financials:', canViewFinancialData('admin'));
  console.log('✅ Admin can edit:', canEdit('admin'));
  console.log('❌ Admin is not read-only:', !isReadOnlyRole('admin'));
  
  // Agent role tests
  console.log('✅ Agent can view financials:', canViewFinancialData('agent'));
  console.log('✅ Agent can edit:', canEdit('agent'));
  console.log('❌ Agent is not read-only:', !isReadOnlyRole('agent'));
  
  console.groupEnd();
  console.groupEnd();
  
  return {
    passed: true,
    message: 'All permission tests completed. Check console for detailed results.'
  };
};

// UI component permission verification
export const verifyUIPermissions = (userRole: string) => {
  console.group(`🎨 UI Permission Verification for ${userRole}`);
  
  const uiPermissions = {
    showAddButtons: canEdit(userRole),
    showEditButtons: canEdit(userRole),
    showDeleteButtons: canEdit(userRole),
    showFinancialData: canViewFinancialData(userRole),
    showTransactionForm: canEdit(userRole),
    showRollingForm: canEdit(userRole),
    showSharingConfig: canEdit(userRole),
    readOnlyMode: isReadOnlyRole(userRole)
  };
  
  console.table(uiPermissions);
  console.groupEnd();
  
  return uiPermissions;
};
