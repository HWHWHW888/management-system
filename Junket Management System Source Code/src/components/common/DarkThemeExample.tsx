import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Eye, EyeOff } from 'lucide-react';

// =============================================================================
// 深色主题设计示例 - 基于您提供的设计风格
// =============================================================================

// 深色主题设计令牌
export const darkThemeTokens = {
  // 背景色系
  background: {
    primary: '#1e293b',      // 深蓝灰色主背景
    secondary: '#334155',    // 次要背景
    card: '#f8fafc',         // 卡片背景 (浅色)
    overlay: 'rgba(0, 0, 0, 0.5)', // 遮罩层
  },
  
  // 品牌色 - 橙色系 (基于HW logo)
  brand: {
    primary: '#f97316',      // 主橙色
    secondary: '#ea580c',    // 深橙色
    light: '#fed7aa',        // 浅橙色
    gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
  },
  
  // 文本色系
  text: {
    primary: '#1e293b',      // 深色文本 (在浅色卡片上)
    secondary: '#64748b',    // 次要文本
    muted: '#94a3b8',        // 静音文本
    inverse: '#f8fafc',      // 反色文本 (在深色背景上)
    brand: '#f97316',        // 品牌色文本
  },
  
  // 边框和分割线
  border: {
    primary: '#e2e8f0',      // 主边框
    secondary: '#cbd5e1',    // 次要边框
    focus: '#f97316',        // 焦点边框
  },
  
  // 阴影系统
  shadow: {
    card: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    button: '0 4px 14px 0 rgba(249, 115, 22, 0.25)',
    input: '0 0 0 3px rgba(249, 115, 22, 0.1)',
  }
};

// 深色主题登录组件示例
export const DarkThemeLoginExample: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // 模拟登录过程
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ 
        background: `linear-gradient(135deg, ${darkThemeTokens.background.primary} 0%, ${darkThemeTokens.background.secondary} 100%)` 
      }}
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10"
          style={{ background: darkThemeTokens.brand.gradient }}
        />
        <div 
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-10"
          style={{ background: darkThemeTokens.brand.gradient }}
        />
      </div>

      {/* 登录卡片 */}
      <Card 
        className="w-full max-w-md relative z-10 border-0"
        style={{ 
          backgroundColor: darkThemeTokens.background.card,
          boxShadow: darkThemeTokens.shadow.card 
        }}
      >
        <CardHeader className="text-center pb-6 pt-8">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ background: darkThemeTokens.brand.gradient }}
            >
              HW
            </div>
          </div>
          
          {/* 标题 */}
          <h1 
            className="text-2xl font-bold mb-2"
            style={{ color: darkThemeTokens.text.primary }}
          >
            Hoe Win Junket Management System
          </h1>
          
          <p 
            className="text-sm"
            style={{ color: darkThemeTokens.text.secondary }}
          >
            Professional Gaming Management Platform
          </p>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 用户名输入 */}
            <div className="space-y-2">
              <Label 
                htmlFor="username"
                className="text-sm font-medium"
                style={{ color: darkThemeTokens.text.primary }}
              >
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 border-2 transition-all duration-200 focus:ring-0"
                style={{
                  borderColor: darkThemeTokens.border.primary,
                  backgroundColor: darkThemeTokens.background.card,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = darkThemeTokens.border.focus;
                  e.target.style.boxShadow = darkThemeTokens.shadow.input;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = darkThemeTokens.border.primary;
                  e.target.style.boxShadow = 'none';
                }}
                required
              />
            </div>

            {/* 密码输入 */}
            <div className="space-y-2">
              <Label 
                htmlFor="password"
                className="text-sm font-medium"
                style={{ color: darkThemeTokens.text.primary }}
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-2 pr-12 transition-all duration-200 focus:ring-0"
                  style={{
                    borderColor: darkThemeTokens.border.primary,
                    backgroundColor: darkThemeTokens.background.card,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = darkThemeTokens.border.focus;
                    e.target.style.boxShadow = darkThemeTokens.shadow.input;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = darkThemeTokens.border.primary;
                    e.target.style.boxShadow = 'none';
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors"
                  style={{ color: darkThemeTokens.text.secondary }}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* 登录按钮 */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-white font-semibold text-base border-0 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: darkThemeTokens.brand.gradient,
                boxShadow: darkThemeTokens.shadow.button,
              }}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </div>
              ) : (
                'Access Dashboard'
              )}
            </Button>

            {/* 忘记密码链接 */}
            <div className="text-center">
              <button
                type="button"
                className="text-sm font-medium hover:underline transition-colors"
                style={{ color: darkThemeTokens.text.brand }}
              >
                Forgot your password?
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// 深色主题仪表板示例
export const DarkThemeDashboardExample: React.FC = () => {
  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: darkThemeTokens.background.primary }}
    >
      {/* 顶部导航栏 */}
      <nav 
        className="border-b px-6 py-4"
        style={{ 
          backgroundColor: darkThemeTokens.background.secondary,
          borderColor: darkThemeTokens.border.secondary 
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ background: darkThemeTokens.brand.gradient }}
            >
              HW
            </div>
            <h1 
              className="text-xl font-bold"
              style={{ color: darkThemeTokens.text.inverse }}
            >
              Junket Management System
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <span 
              className="text-sm"
              style={{ color: darkThemeTokens.text.muted }}
            >
              Welcome, Admin
            </span>
            <div 
              className="w-8 h-8 rounded-full"
              style={{ backgroundColor: darkThemeTokens.brand.primary }}
            />
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <main className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 统计卡片示例 */}
          {[
            { title: 'Total Revenue', value: 'HK$2,456,789', change: '+12.5%', positive: true },
            { title: 'Active Customers', value: '1,234', change: '+5.2%', positive: true },
            { title: 'Active Agents', value: '56', change: '-2.1%', positive: false },
            { title: 'Ongoing Trips', value: '8', change: '+25%', positive: true },
          ].map((stat, index) => (
            <Card 
              key={index}
              className="border-0"
              style={{ 
                backgroundColor: darkThemeTokens.background.card,
                boxShadow: darkThemeTokens.shadow.card 
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p 
                      className="text-sm font-medium"
                      style={{ color: darkThemeTokens.text.secondary }}
                    >
                      {stat.title}
                    </p>
                    <p 
                      className="text-2xl font-bold mt-2"
                      style={{ color: darkThemeTokens.text.primary }}
                    >
                      {stat.value}
                    </p>
                    <p 
                      className="text-sm mt-1"
                      style={{ 
                        color: stat.positive ? '#10b981' : '#ef4444' 
                      }}
                    >
                      {stat.change} from last month
                    </p>
                  </div>
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ 
                      backgroundColor: `${darkThemeTokens.brand.primary}20`,
                      color: darkThemeTokens.brand.primary 
                    }}
                  >
                    📊
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

// 深色主题组件集合
export const DarkThemeShowcase: React.FC = () => {
  const [currentView, setCurrentView] = useState<'login' | 'dashboard'>('login');

  return (
    <div className="min-h-screen">
      {/* 切换按钮 */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setCurrentView('login')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentView === 'login' 
              ? 'bg-orange-500 text-white' 
              : 'bg-white text-gray-700 border'
          }`}
        >
          Login View
        </button>
        <button
          onClick={() => setCurrentView('dashboard')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentView === 'dashboard' 
              ? 'bg-orange-500 text-white' 
              : 'bg-white text-gray-700 border'
          }`}
        >
          Dashboard View
        </button>
      </div>

      {/* 内容展示 */}
      {currentView === 'login' ? (
        <DarkThemeLoginExample />
      ) : (
        <DarkThemeDashboardExample />
      )}
    </div>
  );
};

export default DarkThemeShowcase;
