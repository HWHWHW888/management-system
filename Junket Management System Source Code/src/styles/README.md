# 设计令牌系统使用指南

## 概述

设计令牌 (Design Tokens) 是设计系统的核心，它们定义了应用程序的视觉语言基础。这个系统提供了统一的颜色、字体、间距和其他设计属性。

## 文件结构

```
src/styles/
├── designTokens.ts          # 核心设计令牌定义
├── README.md               # 使用指南 (本文件)
└── globals.css             # 全局样式 (如果需要)
```

## 设计令牌的优势

1. **一致性**: 确保整个应用程序的视觉一致性
2. **可维护性**: 集中管理设计属性，便于全局更新
3. **可扩展性**: 易于添加新的设计属性和变体
4. **协作性**: 设计师和开发者共享同一套设计语言
5. **主题化**: 支持多主题切换 (如深色模式)

## 使用方法

### 1. 在组件中导入设计令牌

```typescript
import { colors, typography, spacing, components } from '../styles/designTokens';
```

### 2. 使用颜色系统

```typescript
// 直接使用颜色值
const primaryColor = colors.primary[500]; // #3b82f6

// 在样式中使用
const buttonStyle = {
  backgroundColor: colors.primary[500],
  color: colors.white,
  border: `1px solid ${colors.primary[600]}`
};

// 在Tailwind类名中使用 (需要配置)
className="bg-blue-500 text-white border-blue-600"
```

### 3. 使用字体系统

```typescript
// 获取响应式字体大小
const headingSize = typography.fontSize['2xl'];
// { mobile: '1.25rem', desktop: '1.5rem', lineHeight: '2rem' }

// 在CSS-in-JS中使用
const headingStyle = {
  fontSize: typography.fontSize['2xl'].mobile,
  lineHeight: typography.fontSize['2xl'].lineHeight,
  fontWeight: typography.fontWeight.bold,
  '@media (min-width: 640px)': {
    fontSize: typography.fontSize['2xl'].desktop,
  }
};
```

### 4. 使用间距系统

```typescript
// 获取间距值
const padding = spacing[4]; // '1rem' (16px)

// 在样式中使用
const cardStyle = {
  padding: spacing[6],        // 24px
  margin: spacing[4],         // 16px
  borderRadius: borderRadius.lg, // 8px
};
```

### 5. 使用语义化颜色

```typescript
import { semanticColors } from '../styles/designTokens';

// 使用语义化颜色
const textStyle = {
  color: semanticColors.text.primary,     // 主要文本颜色
  backgroundColor: semanticColors.background.primary, // 主要背景色
};

// 状态颜色
const successStyle = {
  color: semanticColors.status.success,
  borderColor: semanticColors.border.success,
};
```

## 组件设计令牌

### 按钮组件

```typescript
import { components } from '../styles/designTokens';

// 使用预定义的按钮样式
const buttonStyle = {
  height: components.button.height.md,     // 40px
  padding: components.button.padding.md,   // 12px 16px
  fontSize: components.button.fontSize.md.mobile, // 14px on mobile
};
```

### 输入框组件

```typescript
const inputStyle = {
  height: components.input.height.md,      // 40px
  padding: components.input.padding,       // 12px
  borderRadius: components.input.borderRadius, // 6px
  borderWidth: components.input.borderWidth,   // 1px
};
```

## 响应式设计

设计令牌支持响应式设计，特别是字体大小：

```typescript
// 响应式字体实现示例
const ResponsiveText = ({ children }) => {
  const fontSize = typography.fontSize.lg;
  
  return (
    <span style={{
      fontSize: fontSize.mobile,
      lineHeight: fontSize.lineHeight,
      '@media (min-width: 640px)': {
        fontSize: fontSize.desktop,
      }
    }}>
      {children}
    </span>
  );
};
```

## 主题化支持

设计令牌为主题化提供了基础：

```typescript
// 主题配置示例
const lightTheme = {
  colors: colors,
  background: semanticColors.background.primary,
  text: semanticColors.text.primary,
};

const darkTheme = {
  colors: {
    ...colors,
    // 覆盖特定颜色用于深色主题
    primary: { ...colors.primary, 500: '#60a5fa' },
  },
  background: colors.gray[900],
  text: colors.white,
};
```

## 最佳实践

### 1. 优先使用语义化颜色

```typescript
// ✅ 好的做法
color: semanticColors.text.primary

// ❌ 避免直接使用颜色值
color: colors.gray[900]
```

### 2. 使用组件特定的设计令牌

```typescript
// ✅ 好的做法
height: components.button.height.md

// ❌ 避免硬编码尺寸
height: '40px'
```

### 3. 保持一致的间距

```typescript
// ✅ 好的做法 - 使用4px网格系统
margin: spacing[4]  // 16px
padding: spacing[6] // 24px

// ❌ 避免任意值
margin: '15px'
padding: '22px'
```

### 4. 响应式优先

```typescript
// ✅ 好的做法 - 考虑移动端
fontSize: typography.fontSize.base.mobile,
'@media (min-width: 640px)': {
  fontSize: typography.fontSize.base.desktop,
}

// ❌ 避免固定尺寸
fontSize: '16px'
```

## 扩展设计令牌

### 添加新颜色

```typescript
// 在 designTokens.ts 中添加
export const colors = {
  // 现有颜色...
  
  // 新的品牌色
  accent: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    // ... 其他色阶
    500: '#0ea5e9',
    // ... 其他色阶
    900: '#0c4a6e',
  }
};
```

### 添加新的组件令牌

```typescript
export const components = {
  // 现有组件...
  
  // 新的组件
  modal: {
    maxWidth: '32rem',        // 512px
    padding: spacing[6],      // 24px
    borderRadius: borderRadius.xl, // 12px
    shadow: boxShadow.xl,
  }
};
```

## 与Tailwind CSS集成

如果使用Tailwind CSS，可以在`tailwind.config.js`中集成设计令牌：

```javascript
const { colors, spacing, typography } = require('./src/styles/designTokens');

module.exports = {
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        success: colors.success,
        // ... 其他颜色
      },
      spacing: spacing,
      fontSize: {
        // 转换设计令牌为Tailwind格式
        'xs': typography.fontSize.xs.mobile,
        'sm': typography.fontSize.sm.mobile,
        // ...
      }
    }
  }
};
```

## 工具和验证

### 类型安全

设计令牌使用TypeScript，提供完整的类型安全：

```typescript
// 类型会自动推断和检查
const color: string = colors.primary[500]; // ✅
const invalidColor = colors.primary[1000]; // ❌ TypeScript错误
```

### 设计令牌验证

```typescript
// 可以添加运行时验证
const validateColor = (color: string) => {
  const validColors = Object.values(colors).flatMap(palette => 
    Object.values(palette)
  );
  return validColors.includes(color);
};
```

## 总结

设计令牌系统提供了：

- 🎨 **统一的视觉语言**
- 📱 **响应式设计支持**
- 🔧 **易于维护和扩展**
- 🎯 **类型安全**
- 🌙 **主题化支持**
- 👥 **团队协作友好**

通过使用这个设计令牌系统，我们可以构建一致、可维护且用户友好的界面。
