# Junket Management System - Development Workflow

## 🚀 Quick Start

### Local Development (推荐工作流)

```bash
# 1. 启动完整开发环境 (前端 + 后端)
npm run dev

# 或者分别启动
npm run dev:frontend  # 前端: http://localhost:3000
npm run dev:backend   # 后端: http://localhost:3001
```

### 环境配置

#### 本地开发环境
- **前端**: `http://localhost:3000`
- **后端**: `http://localhost:3001`
- **API**: `http://localhost:3001/api`

#### 生产环境
- **前端**: Cloudflare Pages (自动部署)
- **后端**: Railway (自动部署)
- **API**: `https://management-system-production-9c14.up.railway.app/api`

## 📁 环境变量文件

### 前端环境变量

#### `.env.development` (本地开发)
```env
GENERATE_SOURCEMAP=false
CI=false
REACT_APP_API_URL=http://localhost:3001/api
```

#### `.env.production` (生产环境)
```env
GENERATE_SOURCEMAP=false
CI=false
REACT_APP_API_URL=https://management-system-production-9c14.up.railway.app/api
```

### 后端环境变量

#### `supabase/functions/server/.env` (本地开发)
```env
SUPABASE_URL=https://rtjdqnuzeupbgbovbriy.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-local-jwt-secret-key-change-this-in-production
PORT=3001
NODE_ENV=development
```

## 🔄 开发工作流

### 1. 本地开发阶段
```bash
# 克隆项目
git clone <repository-url>
cd "Junket Management System Source Code"

# 安装前端依赖
npm install

# 安装后端依赖
cd supabase/functions/server
npm install
cd ../../..

# 启动开发环境
npm run dev
```

### 2. 测试验证
- 前端自动刷新: 修改代码立即生效
- 后端热重载: 使用 nodemon 自动重启
- API 测试: 使用 `http://localhost:3001/api` 进行测试

### 3. 部署到生产环境
```bash
# 提交代码
git add .
git commit -m "feat: 新功能描述"
git push origin main

# 自动部署流程:
# 1. Railway 自动部署后端
# 2. Cloudflare Pages 自动部署前端
```

## 🛠️ 可用命令

### 前端命令
```bash
npm start              # 启动开发服务器
npm run build          # 构建生产版本
npm test               # 运行测试
npm run dev            # 启动完整开发环境 (前端+后端)
npm run dev:frontend   # 仅启动前端
npm run dev:backend    # 仅启动后端
```

### 后端命令
```bash
cd supabase/functions/server
npm start              # 启动生产服务器
npm run dev            # 启动开发服务器 (nodemon)
npm test               # 运行测试
```

## 🔧 开发技巧

### 1. 快速重启
- 前端: 保存文件自动刷新
- 后端: 保存文件自动重启 (nodemon)

### 2. 调试方法
- 浏览器开发者工具: 前端调试
- Console.log: 后端日志在终端显示
- Network 面板: 查看 API 请求

### 3. 常见问题
- **端口冲突**: 确保 3000 和 3001 端口未被占用
- **环境变量**: 检查 `.env` 文件是否正确配置
- **依赖问题**: 删除 `node_modules` 重新安装

## 📦 部署配置

### Railway (后端)
- 自动检测 `package.json`
- 使用 `npm start` 启动
- 环境变量通过 Railway Dashboard 配置

### Cloudflare Pages (前端)
- 构建命令: `npm run build`
- 输出目录: `build`
- 环境变量通过 Cloudflare Dashboard 配置

## 🔐 安全注意事项

1. **环境变量**: `.env` 文件已加入 `.gitignore`，不会提交到 Git
2. **API Keys**: 生产环境的密钥通过部署平台配置
3. **JWT Secret**: 本地和生产环境使用不同的密钥

## 📚 项目结构

```
Junket Management System Source Code/
├── src/                          # 前端源码
│   ├── components/              # React 组件
│   ├── utils/                   # 工具函数
│   └── styles/                  # 样式文件
├── supabase/functions/server/   # 后端 API
│   ├── auth.js                  # 认证模块
│   ├── agents.js                # 代理商管理
│   ├── customers.js             # 客户管理
│   ├── trips.js                 # 行程管理
│   └── index.js                 # 服务器入口
├── public/                      # 静态文件
├── .env.development            # 开发环境变量
├── .env.production             # 生产环境变量
└── dev-start.sh                # 开发启动脚本
```
