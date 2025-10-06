// =============================================================================
// 设计令牌 (Design Tokens) - 统一的字体、颜色和样式配置
// =============================================================================

// 颜色系统 - 基于语义化的颜色定义
export const colors = {
  // 主色调 (Primary) - 蓝色系
  primary: {
    50: '#eff6ff',
    100: '#dbeafe', 
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // 主色
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // 成功色 (Success) - 绿色系
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // 成功色
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },

  // 警告色 (Warning) - 黄色系
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b', // 警告色
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // 错误色 (Error) - 红色系
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444', // 错误色
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // 中性色 (Neutral) - 灰色系
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },

  // 特殊颜色
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',

  // 品牌色 (琥珀色系 - 用于登录等特殊场景)
  brand: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  }
};

// 字体系统
export const typography = {
  // 字体族
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
  },

  // 字体大小 - 响应式
  fontSize: {
    xs: {
      mobile: '0.75rem',    // 12px
      desktop: '0.75rem',   // 12px
      lineHeight: '1rem',   // 16px
    },
    sm: {
      mobile: '0.875rem',   // 14px
      desktop: '0.875rem',  // 14px
      lineHeight: '1.25rem', // 20px
    },
    base: {
      mobile: '0.875rem',   // 14px (移动端稍小)
      desktop: '1rem',      // 16px
      lineHeight: '1.5rem', // 24px
    },
    lg: {
      mobile: '1rem',       // 16px
      desktop: '1.125rem',  // 18px
      lineHeight: '1.75rem', // 28px
    },
    xl: {
      mobile: '1.125rem',   // 18px
      desktop: '1.25rem',   // 20px
      lineHeight: '1.75rem', // 28px
    },
    '2xl': {
      mobile: '1.25rem',    // 20px
      desktop: '1.5rem',    // 24px
      lineHeight: '2rem',   // 32px
    },
    '3xl': {
      mobile: '1.5rem',     // 24px
      desktop: '1.875rem',  // 30px
      lineHeight: '2.25rem', // 36px
    },
    '4xl': {
      mobile: '1.875rem',   // 30px
      desktop: '2.25rem',   // 36px
      lineHeight: '2.5rem', // 40px
    },
  },

  // 字体粗细
  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },

  // 行高
  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },

  // 字母间距
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  }
};

// 间距系统 (基于 4px 网格)
export const spacing = {
  0: '0px',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
  32: '8rem',     // 128px
  40: '10rem',    // 160px
  48: '12rem',    // 192px
  56: '14rem',    // 224px
  64: '16rem',    // 256px
};

// 圆角系统
export const borderRadius = {
  none: '0px',
  sm: '0.125rem',   // 2px
  base: '0.25rem',  // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
};

// 阴影系统
export const boxShadow = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: '0 0 #0000',
};

// 断点系统 (响应式设计)
export const breakpoints = {
  sm: '640px',    // 平板
  md: '768px',    // 小桌面
  lg: '1024px',   // 桌面
  xl: '1280px',   // 大桌面
  '2xl': '1536px', // 超大桌面
};

// Z-index 层级系统
export const zIndex = {
  auto: 'auto',
  0: '0',
  10: '10',
  20: '20',
  30: '30',
  40: '40',
  50: '50',
  dropdown: '1000',
  sticky: '1020',
  fixed: '1030',
  modal: '1040',
  popover: '1050',
  tooltip: '1060',
  toast: '1070',
};

// 动画和过渡
export const animation = {
  // 过渡时长
  duration: {
    75: '75ms',
    100: '100ms',
    150: '150ms',
    200: '200ms',
    300: '300ms',
    500: '500ms',
    700: '700ms',
    1000: '1000ms',
  },

  // 缓动函数
  easing: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // 预定义动画
  keyframes: {
    spin: 'spin 1s linear infinite',
    ping: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
    pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    bounce: 'bounce 1s infinite',
  }
};

// 语义化颜色映射 (将颜色映射到具体用途)
export const semanticColors = {
  // 文本颜色
  text: {
    primary: colors.gray[900],
    secondary: colors.gray[600],
    tertiary: colors.gray[500],
    disabled: colors.gray[400],
    inverse: colors.white,
    link: colors.primary[600],
    linkHover: colors.primary[700],
  },

  // 背景颜色
  background: {
    primary: colors.white,
    secondary: colors.gray[50],
    tertiary: colors.gray[100],
    inverse: colors.gray[900],
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // 边框颜色
  border: {
    primary: colors.gray[200],
    secondary: colors.gray[300],
    focus: colors.primary[500],
    error: colors.error[500],
    success: colors.success[500],
    warning: colors.warning[500],
  },

  // 状态颜色
  status: {
    success: colors.success[500],
    warning: colors.warning[500],
    error: colors.error[500],
    info: colors.primary[500],
  }
};

// 组件特定的设计令牌
export const components = {
  // 按钮
  button: {
    height: {
      sm: '2rem',      // 32px
      md: '2.5rem',    // 40px
      lg: '3rem',      // 48px
    },
    padding: {
      sm: '0.5rem 0.75rem',    // 8px 12px
      md: '0.75rem 1rem',      // 12px 16px
      lg: '1rem 1.5rem',       // 16px 24px
    },
    fontSize: {
      sm: typography.fontSize.sm,
      md: typography.fontSize.base,
      lg: typography.fontSize.lg,
    }
  },

  // 输入框
  input: {
    height: {
      sm: '2rem',      // 32px
      md: '2.5rem',    // 40px
      lg: '3rem',      // 48px
    },
    padding: '0.75rem', // 12px
    borderRadius: borderRadius.md,
    borderWidth: '1px',
  },

  // 卡片
  card: {
    padding: {
      sm: spacing[3],  // 12px
      md: spacing[4],  // 16px
      lg: spacing[6],  // 24px
    },
    borderRadius: borderRadius.lg,
    shadow: boxShadow.sm,
  },

  // 徽章
  badge: {
    padding: {
      sm: '0.25rem 0.5rem',    // 4px 8px
      md: '0.375rem 0.75rem',  // 6px 12px
    },
    fontSize: {
      sm: typography.fontSize.xs,
      md: typography.fontSize.sm,
    },
    borderRadius: borderRadius.full,
  }
};

// 导出所有设计令牌
export const designTokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  boxShadow,
  breakpoints,
  zIndex,
  animation,
  semanticColors,
  components,
};

// 默认导出
export default designTokens;
