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
