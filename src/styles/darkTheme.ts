// =============================================================================
// 深色主题设计系统 - 基于您提供的设计风格
// =============================================================================

// 深色主题颜色系统
export const darkColors = {
  // 背景色系 - 深蓝灰渐变
  background: {
    primary: '#1e293b',      // 主背景 - 深蓝灰
    secondary: '#334155',    // 次要背景 - 中蓝灰
    tertiary: '#475569',     // 第三背景 - 浅蓝灰
    card: '#ffffff',         // 卡片背景 - 纯白
    overlay: 'rgba(30, 41, 59, 0.95)', // 遮罩层
    
    // 渐变背景
    gradient: {
      primary: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
      secondary: 'linear-gradient(135deg, #334155 0%, #475569 100%)',
    }
  },

  // 品牌色系 - HW橙色
  brand: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',         // 主品牌色
    600: '#ea580c',         // 深品牌色
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
    
    // 渐变
    gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    gradientHover: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
  },

  // 文本色系
  text: {
    // 在深色背景上的文本
    primary: '#f8fafc',      // 主要文本 - 几乎白色
    secondary: '#e2e8f0',    // 次要文本 - 浅灰
    tertiary: '#cbd5e1',     // 第三文本 - 中灰
    muted: '#94a3b8',        // 静音文本 - 深灰
    
    // 在浅色背景上的文本
    onLight: {
      primary: '#1e293b',    // 主要文本 - 深色
      secondary: '#475569',  // 次要文本 - 中深色
      tertiary: '#64748b',   // 第三文本 - 中色
      muted: '#94a3b8',      // 静音文本 - 浅色
    },
    
    // 品牌色文本
    brand: '#f97316',
    brandHover: '#fb923c',
    
    // 状态文本
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },

  // 边框色系
  border: {
    primary: '#475569',      // 主边框 - 在深色背景上
    secondary: '#64748b',    // 次要边框
    tertiary: '#94a3b8',     // 第三边框
    
    // 在浅色背景上的边框
    onLight: {
      primary: '#e2e8f0',    // 主边框
      secondary: '#cbd5e1',  // 次要边框
      tertiary: '#94a3b8',   // 第三边框
    },
    
    // 焦点和状态边框
    focus: '#f97316',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  },

  // 表面色系 (卡片、面板等)
  surface: {
    primary: '#334155',      // 主表面
    secondary: '#475569',    // 次要表面
    tertiary: '#64748b',     // 第三表面
    elevated: '#ffffff',     // 提升表面 (白色卡片)
    
    // 半透明表面
    overlay: 'rgba(51, 65, 85, 0.9)',
    glass: 'rgba(248, 250, 252, 0.1)',
  }
};

// 深色主题阴影系统
export const darkShadows = {
  // 卡片阴影
  card: {
    sm: '0 2px 4px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 25px rgba(0, 0, 0, 0.15), 0 8px 10px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 40px rgba(0, 0, 0, 0.2), 0 15px 25px rgba(0, 0, 0, 0.15)',
  },
  
  // 按钮阴影
  button: {
    primary: '0 4px 14px rgba(249, 115, 22, 0.25)',
    primaryHover: '0 6px 20px rgba(249, 115, 22, 0.35)',
    secondary: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  
  // 输入框阴影
  input: {
    focus: '0 0 0 3px rgba(249, 115, 22, 0.1)',
    error: '0 0 0 3px rgba(239, 68, 68, 0.1)',
  },
  
  // 导航阴影
  navigation: '0 2px 10px rgba(0, 0, 0, 0.1)',
  
  // 模态框阴影
  modal: '0 25px 50px rgba(0, 0, 0, 0.25)',
};

// 深色主题字体系统
export const darkTypography = {
  // 字体族 (与浅色主题相同)
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
  },

  // 字体大小 (响应式)
  fontSize: {
    xs: { mobile: '0.75rem', desktop: '0.75rem', lineHeight: '1rem' },
    sm: { mobile: '0.875rem', desktop: '0.875rem', lineHeight: '1.25rem' },
    base: { mobile: '0.875rem', desktop: '1rem', lineHeight: '1.5rem' },
    lg: { mobile: '1rem', desktop: '1.125rem', lineHeight: '1.75rem' },
    xl: { mobile: '1.125rem', desktop: '1.25rem', lineHeight: '1.75rem' },
    '2xl': { mobile: '1.25rem', desktop: '1.5rem', lineHeight: '2rem' },
    '3xl': { mobile: '1.5rem', desktop: '1.875rem', lineHeight: '2.25rem' },
    '4xl': { mobile: '1.875rem', desktop: '2.25rem', lineHeight: '2.5rem' },
  },

  // 字体粗细
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
};

// 深色主题间距 (与浅色主题相同)
export const darkSpacing = {
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
};

// 深色主题组件样式
export const darkComponents = {
  // 按钮样式
  button: {
    primary: {
      background: darkColors.brand.gradient,
      backgroundHover: darkColors.brand.gradientHover,
      color: '#ffffff',
      shadow: darkShadows.button.primary,
      shadowHover: darkShadows.button.primaryHover,
    },
    secondary: {
      background: darkColors.surface.primary,
      backgroundHover: darkColors.surface.secondary,
      color: darkColors.text.primary,
      border: darkColors.border.primary,
      shadow: darkShadows.button.secondary,
    },
    outline: {
      background: 'transparent',
      backgroundHover: darkColors.surface.glass,
      color: darkColors.text.primary,
      border: darkColors.border.primary,
    },
  },

  // 输入框样式
  input: {
    background: darkColors.background.card,
    backgroundFocus: darkColors.background.card,
    color: darkColors.text.onLight.primary,
    border: darkColors.border.onLight.primary,
    borderFocus: darkColors.border.focus,
    placeholder: darkColors.text.onLight.muted,
    shadow: 'none',
    shadowFocus: darkShadows.input.focus,
  },

  // 卡片样式
  card: {
    background: darkColors.background.card,
    border: darkColors.border.onLight.primary,
    shadow: darkShadows.card.lg,
    borderRadius: '0.75rem', // 12px
  },

  // 导航样式
  navigation: {
    background: darkColors.surface.primary,
    border: darkColors.border.primary,
    shadow: darkShadows.navigation,
  },

  // 侧边栏样式
  sidebar: {
    background: darkColors.surface.primary,
    border: darkColors.border.primary,
    width: '16rem', // 256px
  },
};

// 深色主题动画
export const darkAnimations = {
  // 过渡时长
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },

  // 缓动函数
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // 预定义动画
  hover: {
    scale: 'transform: scale(1.02)',
    lift: 'transform: translateY(-2px)',
  },

  active: {
    scale: 'transform: scale(0.98)',
    press: 'transform: translateY(1px)',
  },
};

// 深色主题断点 (与浅色主题相同)
export const darkBreakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// 深色主题完整配置
export const darkTheme = {
  colors: darkColors,
  shadows: darkShadows,
  typography: darkTypography,
  spacing: darkSpacing,
  components: darkComponents,
  animations: darkAnimations,
  breakpoints: darkBreakpoints,
};

// CSS变量生成器 (用于动态主题切换)
export const generateDarkThemeCSSVariables = () => {
  return {
    // 背景色
    '--bg-primary': darkColors.background.primary,
    '--bg-secondary': darkColors.background.secondary,
    '--bg-card': darkColors.background.card,
    
    // 品牌色
    '--brand-primary': darkColors.brand[500],
    '--brand-secondary': darkColors.brand[600],
    
    // 文本色
    '--text-primary': darkColors.text.primary,
    '--text-secondary': darkColors.text.secondary,
    '--text-on-light': darkColors.text.onLight.primary,
    
    // 边框色
    '--border-primary': darkColors.border.primary,
    '--border-on-light': darkColors.border.onLight.primary,
    '--border-focus': darkColors.border.focus,
    
    // 阴影
    '--shadow-card': darkShadows.card.lg,
    '--shadow-button': darkShadows.button.primary,
  };
};

export default darkTheme;
