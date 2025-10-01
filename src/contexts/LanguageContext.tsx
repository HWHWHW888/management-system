import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 翻译字典
const translations = {
  en: {
    // Navigation & Tabs
    'dashboard': 'Dashboard',
    'customers': 'Customers',
    'agents': 'Agents',
    'staff': 'Staff',
    'projects': 'Projects',
    'data': 'Data',
    'checkinout': 'Check-in/Out',
    'boss': 'Boss',
    'trips': 'Trips',
    'trip_details': 'Trip Details',
    'expenses': 'Expenses',
    'transactions': 'Transactions',
    'sharing': 'Sharing',
    'reports': 'Reports',
    'settings': 'Settings',
    
    // Trip Management
    'project_management': 'Project Management',
    'back_to_trips': 'Back to Trips',
    'view_in': 'View in:',
    'total_rolling': 'Total Rolling',
    'total_win_loss': 'Total Win/Loss',
    'total_buy_in': 'Total Buy In',
    'total_buy_out': 'Total Buy Out',
    'net_result': 'Net Result',
    'total_expenses': 'Total Expenses',
    'active_customers': 'Active Customers',
    'recent_activity': 'Recent Activity',
    
    // Actions
    'refresh': 'Refresh',
    'add_new': 'Add New',
    'edit': 'Edit',
    'delete': 'Delete',
    'save': 'Save',
    'cancel': 'Cancel',
    'confirm': 'Confirm',
    'close': 'Close',
    
    // Status
    'active': 'Active',
    'completed': 'Completed',
    'in_progress': 'In Progress',
    'cancelled': 'Cancelled',
    'pending': 'Pending',
    
    // Common
    'name': 'Name',
    'description': 'Description',
    'date': 'Date',
    'amount': 'Amount',
    'status': 'Status',
    'actions': 'Actions',
    'loading': 'Loading...',
    'error': 'Error',
    'success': 'Success',
    'no_data': 'No data available',
    
    // Currency
    'currency': 'Currency',
    'exchange_rate': 'Exchange Rate',
    'hkd': 'HKD',
    'myr': 'MYR',
    'peso': 'PESO',
    
    // Reports
    'reports_title': 'Real-time Reports Dashboard',
    'reports_subtitle': 'Comprehensive business intelligence and analytics',
    'overview_metrics': 'Overview Metrics',
    'financial_summary': 'Financial Summary',
    'customer_metrics': 'Customer Metrics',
    'agent_performance': 'Agent Performance',
    'operational_metrics': 'Operational Metrics',
    'agent_hierarchy': 'Agent Performance Hierarchy',
    'agent_hierarchy_desc': 'Hierarchical view of agents and their customers - expand to see customer details',
    'sort_by': 'Sort by:',
    'reports_total_rolling': 'Total Rolling',
    'win_loss': 'Win/Loss',
    'customer_count': 'Customer Count',
    'average_rolling': 'Average Rolling',
    'agent_name': 'Agent Name',
    'individual_rolling': 'Individual Rolling',
    'individual_win': 'Individual Win',
    'trip_count': 'Trip Count',
    'profit_loss': 'Profit/Loss',
    'house_gross_win': 'House Gross Win',
    'house_net_win': 'House Net Win',
    'house_final_profit': 'House Final Profit',
    'reports_total_customers': 'Total Customers',
    'reports_active_customers': 'Active Customers',
    'total_agents': 'Total Agents',
    'active_agents': 'Active Agents',
    'total_trips': 'Total Trips',
    'completed_trips': 'Completed Trips',
    'ongoing_trips': 'Ongoing Trips',
    'profit_margin': 'Profit Margin',
    'rolling_percentage': 'Rolling Percentage',
    'company_share': 'Company Share',
    'net_cash_flow': 'Net Cash Flow',
    'real_time_sync': 'Real-time Sync',
    'last_sync': 'Last Sync',
    'connection_status': 'Connection Status',
    'connected': 'Connected',
    'disconnected': 'Disconnected',
    'sync_error': 'Sync Error',
    'auto_refresh': 'Auto Refresh',
    'manual_refresh': 'Manual Refresh',
    'export_data': 'Export Data',
    
    // Financial Overview
    'financial_overview': 'Real-time Financial Overview',
    'total_rolling_amount': 'Total Rolling Amount',
    'company_gross_profit': 'Company Gross Profit',
    'overview_expenses': 'Expenses',
    'company_net_profit': 'Company Net Profit',
    'from_rolling_records': 'From rolling records across customers',
    'from_trip_sharing': 'From trip sharing without data',
    'total_operational_expenses': 'Total operational expenses from trip sharing',
    'company_share_from_trip': 'Company share from trip sharing',
    
    // Operations Overview
    'operations_overview': 'Operations Overview',
    'overview_active_customers': 'Active Customers',
    'overview_active_agents': 'Active Agents',
    'overview_trip_summary': 'Trip Summary',
    'overview_recent_activity': 'Recent Activity',
    'of_total_customers': 'of total customers',
    'of_total_agents': 'of total agents',
    'completed_ongoing_planned': 'completed, ongoing, planned',
    'transactions_in_last_hours': 'Transactions in last 24 hours',
    
    // Active Trips
    'overview_active_trips': 'Active Trips',
    'current_ongoing_trips': 'Current ongoing trips with real-time performance data',
    'testing_trip': 'Testing Trip',
    'manila_okada': 'Manila Okada',
    'overview_progress': 'Progress',
    'overview_rolling': 'Rolling',
    'overview_win_loss': 'Win/Loss',
    
    // Customer Performance
    'customer_performance': 'Real-time Customer Performance',
    'all_customers_based_on': 'All customers based on live rolling data',
    'sort_by_rolling': 'Sort by: Rolling',
    'agent_active': 'Agent: • Active',
    'overview_commission_rate': 'Commission Rate',
    
    // Additional Common Terms
    'welcome_user': 'Welcome',
    'silver_vip': 'Silver',
    'gold_vip': 'Gold',
    'platinum_vip': 'Platinum',
    'diamond_vip': 'Diamond',
    
    // Dashboard specific terms
    'company_loss': 'Company Loss',
    'company_win': 'Company Win', 
    'break_even': 'Break Even',
    'agent': 'Agent',
    'unknown_destination': 'Unknown Destination',
    'progress': 'Progress',
    
    // Customer Management specific
    'update_customer_info': 'Update basic customer information',
    'add_customer_desc': 'Add a new customer with basic details. You can add extended details after creation.',
    'customer_full_name': 'Customer full name',
    'select_agent': 'Select an agent',
    'no_customers_found': 'No customers found',
    'contact_admin': 'Contact an administrator to add customers',
    'add_first_customer': 'Add your first customer to get started',
    'records': 'records',
    'live_data': 'Live Data',
    'customer_since': 'Customer since',
    'details_available': 'Details available',
    'no_details_available': 'No details available',
    'edit_basic_info': 'Edit Basic Info',
    'edit_details': 'Edit Details',
    'promote_to_agent': 'Promote to Agent',
    'delete_customer': 'Delete Customer',
    
    // Project Management specific
    'trips_loaded': 'Trips Loaded',
    'customers_available': 'Customers Available', 
    'agents_available': 'Agents Available',
    'create_trip': 'Create Trip',
    'create_new_trip': 'Create New Trip',
    'create_trip_desc': 'Create a new trip that will be saved to Supabase database.',
    'trip_name': 'Trip Name',
    'start_date': 'Start Date',
    'end_date': 'End Date',
    'creating': 'Creating...',
    'loading_trips': 'Loading trips...',
    'no_trips_found': 'No trips found',
    'view_details': 'View Details',
    'amount_hkd': 'Amount (HKD)',
    'buy_in': 'Buy-in',
    'buy_out': 'Buy-out',
  },
  zh: {
    // Navigation & Tabs
    'dashboard': '仪表板',
    'customers': '客户',
    'agents': '代理',
    'staff': '员工',
    'projects': '项目',
    'data': '数据',
    'checkinout': '签到/签退',
    'boss': '老板',
    'trips': '行程',
    'trip_details': '行程详情',
    'expenses': '费用',
    'transactions': '交易',
    'sharing': '分成',
    'reports': '报告',
    'settings': '设置',
    
    // Trip Management
    'project_management': '项目管理',
    'back_to_trips': '返回行程',
    'view_in': '查看币种:',
    'total_rolling': '总流水',
    'total_win_loss': '总输赢',
    'total_buy_in': '总买入',
    'total_buy_out': '总买出',
    'net_result': '净结果',
    'total_expenses': '总费用',
    'active_customers': '活跃客户',
    'recent_activity': '最近活动',
    
    // Actions
    'refresh': '刷新',
    'add_new': '新增',
    'edit': '编辑',
    'delete': '删除',
    'save': '保存',
    'cancel': '取消',
    'confirm': '确认',
    'close': '关闭',
    
    // Status
    'active': '活跃',
    'completed': '已完成',
    'in_progress': '进行中',
    'cancelled': '已取消',
    'pending': '待处理',
    
    // Common
    'name': '名称',
    'description': '描述',
    'date': '日期',
    'amount': '金额',
    'status': '状态',
    'actions': '操作',
    'loading': '加载中...',
    'error': '错误',
    'success': '成功',
    'no_data': '暂无数据',
    
    // Currency
    'currency': '币种',
    'exchange_rate': '汇率',
    'hkd': '港币',
    'myr': '马币',
    'peso': '比索',
    
    // Reports
    'reports_title': '实时报告仪表板',
    'reports_subtitle': '全面的商业智能和分析',
    'overview_metrics': '概览指标',
    'financial_summary': '财务摘要',
    'customer_metrics': '客户指标',
    'agent_performance': '代理表现',
    'operational_metrics': '运营指标',
    'agent_hierarchy': '代理表现层级',
    'agent_hierarchy_desc': '代理和客户的层级视图 - 展开查看客户详情',
    'sort_by': '排序方式:',
    'reports_total_rolling': '总流水',
    'win_loss': '输赢',
    'customer_count': '客户数量',
    'average_rolling': '平均流水',
    'agent_name': '代理姓名',
    'individual_rolling': '个人流水',
    'individual_win': '个人输赢',
    'trip_count': '行程数量',
    'profit_loss': '盈亏',
    'house_gross_win': '庄家毛利',
    'house_net_win': '庄家净利',
    'house_final_profit': '庄家最终利润',
    'reports_total_customers': '总客户数',
    'reports_active_customers': '活跃客户',
    'total_agents': '总代理数',
    'active_agents': '活跃代理',
    'total_trips': '总行程数',
    'completed_trips': '已完成行程',
    'ongoing_trips': '进行中行程',
    'profit_margin': '利润率',
    'rolling_percentage': '流水百分比',
    'company_share': '公司分成',
    'net_cash_flow': '净现金流',
    'real_time_sync': '实时同步',
    'last_sync': '最后同步',
    'connection_status': '连接状态',
    'connected': '已连接',
    'disconnected': '已断开',
    'sync_error': '同步错误',
    'auto_refresh': '自动刷新',
    'manual_refresh': '手动刷新',
    'export_data': '导出数据',
    
    // Financial Overview
    'financial_overview': '实时财务概览',
    'total_rolling_amount': '总流水金额',
    'company_gross_profit': '公司毛利',
    'overview_expenses': '费用',
    'company_net_profit': '公司净利润',
    'from_rolling_records': '来自客户流水记录',
    'from_trip_sharing': '来自行程分成数据',
    'total_operational_expenses': '行程分成的总运营费用',
    'company_share_from_trip': '行程分成的公司份额',
    
    // Operations Overview
    'operations_overview': '运营概览',
    'overview_active_customers': '活跃客户',
    'overview_active_agents': '活跃代理',
    'overview_trip_summary': '行程摘要',
    'overview_recent_activity': '最近活动',
    'of_total_customers': '总客户数',
    'of_total_agents': '总代理数',
    'completed_ongoing_planned': '已完成，进行中，计划中',
    'transactions_in_last_hours': '过去24小时交易',
    
    // Active Trips
    'overview_active_trips': '活跃行程',
    'current_ongoing_trips': '当前进行中的行程及实时表现数据',
    'testing_trip': '测试行程',
    'manila_okada': '马尼拉奥卡达',
    'overview_progress': '进度',
    'overview_rolling': '流水',
    'overview_win_loss': '输赢',
    
    // Customer Performance
    'customer_performance': '实时客户表现',
    'all_customers_based_on': '基于实时流水数据的所有客户',
    'sort_by_rolling': '排序方式：流水',
    'agent_active': '代理：• 活跃',
    'overview_commission_rate': '佣金率',
    
    // Additional Common Terms
    'welcome_user': '欢迎',
    'silver_vip': '银卡',
    'gold_vip': '金卡',
    'platinum_vip': '白金卡',
    'diamond_vip': '钻石卡',
    
    // Dashboard specific terms
    'company_loss': '公司输钱',
    'company_win': '公司赢钱',
    'break_even': '持平',
    'agent': '代理',
    'unknown_destination': '未知目的地',
    'progress': '进度',
    
    // Customer Management specific
    'update_customer_info': '更新基本客户信息',
    'add_customer_desc': '添加新客户的基本详情。创建后可以添加扩展详情。',
    'customer_full_name': '客户全名',
    'select_agent': '选择代理',
    'no_customers_found': '未找到客户',
    'contact_admin': '联系管理员添加客户',
    'add_first_customer': '添加您的第一个客户开始使用',
    'records': '记录',
    'live_data': '实时数据',
    'customer_since': '客户注册时间',
    'details_available': '详情可用',
    'no_details_available': '无详情可用',
    'edit_basic_info': '编辑基本信息',
    'edit_details': '编辑详情',
    'promote_to_agent': '提升为代理',
    'delete_customer': '删除客户',
    
    // Project Management specific
    'trips_loaded': '已加载行程',
    'customers_available': '可用客户', 
    'agents_available': '可用代理',
    'create_trip': '创建行程',
    'create_new_trip': '创建新行程',
    'create_trip_desc': '创建一个新行程，将保存到 Supabase 数据库。',
    'trip_name': '行程名称',
    'start_date': '开始日期',
    'end_date': '结束日期',
    'creating': '创建中...',
    'loading_trips': '加载行程中...',
    'no_trips_found': '未找到行程',
    'view_details': '查看详情',
    'amount_hkd': '金额 (港币)',
    'buy_in': '买入',
    'buy_out': '买出',
  }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    // 从 localStorage 获取保存的语言设置，默认为英文
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'en';
  });

  // 保存语言设置到 localStorage
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  // 翻译函数
  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations[typeof language]] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
