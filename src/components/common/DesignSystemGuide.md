# 设计系统使用指南

## 概述

这个设计系统提供了统一的UI组件和样式规范，确保整个应用程序的一致性和响应式设计。基于 `designTokens.ts` 的设计令牌系统，提供了完整的视觉语言基础。

## 核心原则

1. **设计令牌驱动** - 基于统一的设计令牌 (`src/styles/designTokens.ts`)
2. **移动端优先** - 所有组件都采用移动端优先的响应式设计
3. **一致性** - 统一的颜色、间距、字体大小和交互模式
4. **可访问性** - 符合无障碍设计标准
5. **性能优化** - 轻量级组件，优化的CSS类
6. **类型安全** - 完整的TypeScript支持

## 设计令牌系统

### 核心设计令牌

设计系统基于 `src/styles/designTokens.ts` 中定义的设计令牌：

```tsx
import { colors, typography, spacing, components } from '../styles/designTokens';

// 使用颜色令牌
const primaryColor = colors.primary[500]; // #3b82f6

// 使用字体令牌
const headingSize = typography.fontSize['2xl'];

// 使用间距令牌
const padding = spacing[4]; // 1rem (16px)
```

### 语义化颜色

```tsx
import { semanticColors } from '../styles/designTokens';

// 推荐使用语义化颜色
const textColor = semanticColors.text.primary;
const backgroundColor = semanticColors.background.primary;
const successColor = semanticColors.status.success;
```

## 组件使用指南

### 1. 容器组件

#### DSContainer
用于页面的主要容器，提供统一的间距和响应式布局。

```tsx
import { DSContainer } from './common/DesignSystem';

<DSContainer>
  {/* 页面内容 */}
</DSContainer>
```

#### DSHeader
统一的页面头部组件，包含标题、副标题、徽章和操作按钮。

```tsx
<DSHeader
  title="页面标题"
  subtitle="页面描述"
  badges={[
    { text: "状态信息", variant: "success" },
    { text: "数量: 5", variant: "primary" }
  ]}
  actions={
    <DSButton variant="outline" size="mobile">
      刷新
    </DSButton>
  }
/>
```

### 2. 按钮组件

#### DSButton
统一的按钮组件，支持多种变体和尺寸。

```tsx
// 基础用法
<DSButton variant="primary" size="md">
  确认
</DSButton>

// 带图标
<DSButton 
  variant="outline" 
  size="mobile"
  icon={<Camera className={iconSizes.sm} />}
>
  上传照片
</DSButton>

// 移动端全宽按钮
<DSButton variant="success" size="mobile">
  提交表单
</DSButton>
```

**变体类型：**
- `primary` - 主要按钮（蓝色）
- `secondary` - 次要按钮（灰色）
- `success` - 成功按钮（绿色）
- `warning` - 警告按钮（黄色）
- `error` - 错误按钮（红色）
- `outline` - 边框按钮

**尺寸类型：**
- `xs` - 超小按钮
- `sm` - 小按钮
- `md` - 中等按钮
- `lg` - 大按钮
- `mobile` - 移动端自适应按钮（移动端全宽，桌面端自动宽度）

### 3. 卡片组件

#### DSCard
统一的卡片组件，支持不同的样式变体。

```tsx
// 基础卡片
<DSCard padding="md">
  <h3>卡片标题</h3>
  <p>卡片内容</p>
</DSCard>

// 带左边框的强调卡片
<DSCard 
  variant="accent" 
  accentColor="success" 
  padding="lg"
  hover={true}
>
  <h3>重要信息</h3>
  <p>这是一个带绿色左边框的卡片</p>
</DSCard>
```

### 4. 徽章组件

#### DSBadge
统一的徽章组件，用于显示状态或标签信息。

```tsx
<DSBadge variant="success" size="sm">
  已完成
</DSBadge>

<DSBadge variant="warning" size="md">
  待处理
</DSBadge>
```

### 5. 通知组件

#### DSNotification
统一的通知组件，支持成功、错误、警告和信息类型。

```tsx
// 在组件状态中管理通知
const [notification, setNotification] = useState(null);

// 显示成功通知
setNotification({
  type: 'success',
  title: '操作成功',
  message: '数据已保存'
});

// 渲染通知
{notification && (
  <DSNotification
    type={notification.type}
    title={notification.title}
    message={notification.message}
    onClose={() => setNotification(null)}
  />
)}
```

### 6. 表单布局

#### DSFormLayout
统一的表单布局组件。

```tsx
// 单列布局
<DSFormLayout columns={1}>
  <div>
    <Label>姓名</Label>
    <Input />
  </div>
  <div>
    <Label>邮箱</Label>
    <Input />
  </div>
</DSFormLayout>

// 双列布局（桌面端）
<DSFormLayout columns={2}>
  <div>
    <Label>姓名</Label>
    <Input />
  </div>
  <div>
    <Label>电话</Label>
    <Input />
  </div>
</DSFormLayout>
```

## 样式常量

### 颜色系统
```tsx
import { colors } from './common/DesignSystem';

// 使用预定义颜色
className={colors.success[100]} // 浅绿色背景
className={colors.primary[500]} // 主蓝色
```

### 间距系统
```tsx
import { spacing } from './common/DesignSystem';

// 使用统一间距
className={spacing.container} // 容器间距
className={spacing.buttonGroup} // 按钮组间距
```

### 字体系统
```tsx
import { typography } from './common/DesignSystem';

// 使用响应式字体
className={typography.h1} // 主标题
className={typography.body} // 正文
className={typography.small} // 小字体
```

### 图标尺寸
```tsx
import { iconSizes } from './common/DesignSystem';

<Camera className={iconSizes.sm} /> // 响应式小图标
<Users className={iconSizes.md} />  // 响应式中图标
```

## 响应式设计原则

### 断点系统
- **移动端**: < 640px
- **平板端**: 640px - 1024px  
- **桌面端**: > 1024px

### 响应式模式
```tsx
// 移动端优先的类名
"text-sm sm:text-base"     // 移动端小字体，桌面端正常字体
"w-full sm:w-auto"         // 移动端全宽，桌面端自动宽度
"flex-col sm:flex-row"     // 移动端垂直，桌面端水平
"space-y-2 sm:space-y-3"   // 移动端小间距，桌面端大间距
```

## 最佳实践

### 1. 组件选择
- 优先使用设计系统组件
- 需要自定义时，继承设计系统的样式常量
- 保持一致的交互模式

### 2. 响应式设计
- 始终考虑移动端体验
- 使用设计系统提供的响应式类名
- 测试不同屏幕尺寸

### 3. 可访问性
- 使用语义化的HTML结构
- 提供适当的ARIA标签
- 确保足够的颜色对比度

### 4. 性能优化
- 避免不必要的重新渲染
- 使用适当的组件尺寸
- 优化图片和资源加载

## 迁移指南

### 从现有组件迁移到设计系统

1. **替换容器**
```tsx
// 旧方式
<div className="space-y-6 px-4">

// 新方式
<DSContainer>
```

2. **替换按钮**
```tsx
// 旧方式
<Button variant="outline" className="w-full sm:w-auto">

// 新方式
<DSButton variant="outline" size="mobile">
```

3. **替换通知**
```tsx
// 旧方式
{error && <div className="bg-red-50 text-red-800">错误信息</div>}

// 新方式
{error && (
  <DSNotification
    type="error"
    title="错误"
    message={error}
    onClose={() => setError('')}
  />
)}
```

## 扩展指南

如需添加新的组件或样式：

1. 在 `DesignSystem.tsx` 中添加新的样式常量
2. 创建新的组件并遵循现有模式
3. 更新此文档
4. 在现有组件中测试新功能

## 支持和反馈

如有问题或建议，请：
1. 检查此文档是否有相关信息
2. 查看现有组件的实现示例
3. 提出改进建议或报告问题
