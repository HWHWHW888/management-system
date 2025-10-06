import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { colors, typography as typographyTokens, spacing as spacingTokens, components } from '../../styles/designTokens';

// =============================================================================
// 设计系统 - 统一的UI组件样式规范
// 基于 designTokens.ts 的设计令牌
// =============================================================================

// 颜色系统 - 基于设计令牌的Tailwind类名映射
export const colorClasses = {
  // 主色调
  primary: {
    50: 'bg-blue-50 text-blue-700 border-blue-200',
    100: 'bg-blue-100 text-blue-800 border-blue-300',
    500: 'bg-blue-500 text-white border-blue-500',
    600: 'bg-blue-600 text-white border-blue-600',
  },
  // 成功色
  success: {
    50: 'bg-green-50 text-green-700 border-green-200',
    100: 'bg-green-100 text-green-800 border-green-300',
    500: 'bg-green-500 text-white border-green-500',
    600: 'bg-green-600 text-white border-green-600',
  },
  // 警告色
  warning: {
    50: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    100: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    500: 'bg-yellow-500 text-white border-yellow-500',
    600: 'bg-yellow-600 text-white border-yellow-600',
  },
  // 错误色
  error: {
    50: 'bg-red-50 text-red-700 border-red-200',
    100: 'bg-red-100 text-red-800 border-red-300',
    500: 'bg-red-500 text-white border-red-500',
    600: 'bg-red-600 text-white border-red-600',
  },
  // 中性色
  gray: {
    50: 'bg-gray-50 text-gray-700 border-gray-200',
    100: 'bg-gray-100 text-gray-800 border-gray-300',
    500: 'bg-gray-500 text-white border-gray-500',
    600: 'bg-gray-600 text-white border-gray-600',
  }
};

// 间距系统 - 移动端优先 (基于设计令牌)
export const spacing = {
  // 容器间距
  container: 'space-y-4 sm:space-y-6 px-2 sm:px-0',
  // 卡片间距
  card: 'space-y-3 sm:space-y-4',
  // 元素间距
  element: 'space-y-2 sm:space-y-3',
  // 按钮组间距
  buttonGroup: 'flex flex-col sm:flex-row gap-2 sm:space-x-2',
  // 网格间距
  grid: 'gap-3 sm:gap-4',
};

// 响应式文本大小 (基于设计令牌)
export const typography = {
  // 标题 - 使用设计令牌的字体大小
  h1: 'text-2xl sm:text-3xl font-bold',
  h2: 'text-xl sm:text-2xl font-bold', 
  h3: 'text-lg sm:text-xl font-semibold',
  h4: 'text-base sm:text-lg font-medium',
  // 正文
  body: 'text-sm sm:text-base',
  small: 'text-xs sm:text-sm',
  // 标签
  label: 'text-xs sm:text-sm font-medium text-gray-500',
};

// 按钮尺寸系统
export const buttonSizes = {
  xs: 'h-6 px-2 text-xs',
  sm: 'h-8 px-3 text-xs sm:text-sm',
  md: 'h-10 px-4 text-sm sm:text-base',
  lg: 'h-12 px-6 text-base sm:text-lg',
  // 移动端全宽按钮
  mobile: 'w-full sm:w-auto h-10 px-4 text-sm sm:text-base',
};

// 图标尺寸系统
export const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-3 h-3 sm:w-4 sm:h-4',
  md: 'w-4 h-4 sm:w-5 sm:h-5',
  lg: 'w-5 h-5 sm:w-6 sm:h-6',
  xl: 'w-6 h-6 sm:w-8 sm:h-8',
};

// 卡片样式系统
export const cardStyles = {
  // 基础卡片
  base: 'bg-white rounded-lg shadow-sm border border-gray-200',
  // 带左边框的卡片
  accent: 'bg-white rounded-lg shadow-sm border border-gray-200 border-l-4',
  // 悬停效果
  hover: 'hover:shadow-md transition-shadow duration-200',
  // 内边距
  padding: {
    sm: 'p-2 sm:p-3',
    md: 'p-3 sm:p-4',
    lg: 'p-4 sm:p-6',
  },
  // 头部内边距
  headerPadding: {
    sm: 'pb-2 sm:pb-3',
    md: 'pb-3 sm:pb-4',
    lg: 'pb-4 sm:pb-6',
  }
};

// =============================================================================
// 统一组件
// =============================================================================

// 统一按钮组件
interface DSButtonProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'mobile';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export const DSButton: React.FC<DSButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled = false,
  icon,
  className = '',
  type = 'button'
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white border-blue-500';
      case 'secondary':
        return 'bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800 border-gray-300';
      case 'success':
        return 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white border-green-500';
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-white border-yellow-500';
      case 'error':
        return 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white border-red-500';
      case 'outline':
        return 'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border-2 border-gray-300 hover:border-gray-400';
      default:
        return 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white border-blue-500';
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${buttonSizes[size]}
        ${getVariantClasses()}
        flex items-center justify-center
        rounded-md border
        font-medium
        transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        touch-manipulation
        ${className}
      `}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};

// 统一徽章组件
interface DSBadgeProps {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'gray';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export const DSBadge: React.FC<DSBadgeProps> = ({
  variant = 'gray',
  size = 'sm',
  children,
  className = ''
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return colorClasses.primary[100];
      case 'success':
        return colorClasses.success[100];
      case 'warning':
        return colorClasses.warning[100];
      case 'error':
        return colorClasses.error[100];
      case 'gray':
      default:
        return colorClasses.gray[100];
    }
  };

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5';

  return (
    <span className={`
      ${getVariantClasses()}
      ${sizeClasses}
      rounded-full font-medium w-fit
      ${className}
    `}>
      {children}
    </span>
  );
};

// 统一卡片组件
interface DSCardProps {
  variant?: 'base' | 'accent';
  accentColor?: 'primary' | 'success' | 'warning' | 'error';
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const DSCard: React.FC<DSCardProps> = ({
  variant = 'base',
  accentColor = 'primary',
  padding = 'md',
  hover = false,
  children,
  className = ''
}) => {
  const getAccentColor = () => {
    switch (accentColor) {
      case 'primary':
        return 'border-l-blue-400';
      case 'success':
        return 'border-l-green-400';
      case 'warning':
        return 'border-l-yellow-400';
      case 'error':
        return 'border-l-red-400';
      default:
        return 'border-l-blue-400';
    }
  };

  return (
    <div className={`
      ${variant === 'accent' ? cardStyles.accent : cardStyles.base}
      ${variant === 'accent' ? getAccentColor() : ''}
      ${cardStyles.padding[padding]}
      ${hover ? cardStyles.hover : ''}
      ${className}
    `}>
      {children}
    </div>
  );
};

// 统一通知组件
interface DSNotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
}

export const DSNotification: React.FC<DSNotificationProps> = ({
  type,
  title,
  message,
  onClose,
  autoClose = true,
  duration = 3000
}) => {
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          bgClass: 'border-green-200 bg-green-50',
          textClass: 'text-green-800',
          titleClass: 'text-green-800',
          buttonClass: 'text-green-500 hover:text-green-700'
        };
      case 'error':
        return {
          icon: <XCircle className="h-5 w-5 text-red-500" />,
          bgClass: 'border-red-200 bg-red-50',
          textClass: 'text-red-800',
          titleClass: 'text-red-800',
          buttonClass: 'text-red-500 hover:text-red-700'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
          bgClass: 'border-yellow-200 bg-yellow-50',
          textClass: 'text-yellow-800',
          titleClass: 'text-yellow-800',
          buttonClass: 'text-yellow-500 hover:text-yellow-700'
        };
      case 'info':
      default:
        return {
          icon: <Info className="h-5 w-5 text-blue-500" />,
          bgClass: 'border-blue-200 bg-blue-50',
          textClass: 'text-blue-800',
          titleClass: 'text-blue-800',
          buttonClass: 'text-blue-500 hover:text-blue-700'
        };
    }
  };

  const config = getTypeConfig();

  return (
    <div className="fixed top-4 right-4 left-4 md:left-auto md:max-w-md z-50">
      <div className={`${config.bgClass} shadow-lg rounded-lg p-4`}>
        <div className="flex justify-between items-start">
          <div className="flex items-start">
            <div className="mt-0.5 mr-3">{config.icon}</div>
            <div className="flex-1">
              <p className={`font-medium mb-1 ${config.titleClass}`}>{title}</p>
              <p className={`text-sm ${config.textClass}`}>{message}</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className={`${config.buttonClass} transition-colors`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// 统一表单布局组件
interface DSFormLayoutProps {
  children: React.ReactNode;
  columns?: 1 | 2;
  className?: string;
}

export const DSFormLayout: React.FC<DSFormLayoutProps> = ({
  children,
  columns = 1,
  className = ''
}) => {
  const gridClasses = columns === 2 
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'
    : 'space-y-3 sm:space-y-4';

  return (
    <div className={`${gridClasses} ${className}`}>
      {children}
    </div>
  );
};

// 统一响应式容器
interface DSContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const DSContainer: React.FC<DSContainerProps> = ({
  children,
  className = ''
}) => {
  return (
    <div className={`${spacing.container} ${className}`}>
      {children}
    </div>
  );
};

// 统一头部组件
interface DSHeaderProps {
  title: string;
  subtitle?: string;
  badges?: Array<{ text: string; variant?: 'primary' | 'success' | 'warning' | 'error' | 'gray' }>;
  actions?: React.ReactNode;
  className?: string;
}

export const DSHeader: React.FC<DSHeaderProps> = ({
  title,
  subtitle,
  badges = [],
  actions,
  className = ''
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0 ${className}`}>
      <div className="min-w-0 flex-1">
        <h2 className={typography.h2}>{title}</h2>
        {subtitle && (
          <p className={`${typography.body} text-gray-600 mt-1`}>{subtitle}</p>
        )}
        {badges.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {badges.map((badge, index) => (
              <DSBadge key={index} variant={badge.variant}>
                {badge.text}
              </DSBadge>
            ))}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex flex-col sm:flex-row gap-2">
          {actions}
        </div>
      )}
    </div>
  );
};

// 所有样式常量和组件已在上方定义时导出
