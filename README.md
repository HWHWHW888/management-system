# Management System

## Project Overview
The Management System is a comprehensive solution designed to manage various aspects of an organization effectively. This system aims to streamline operations, enhance productivity, and provide insightful analytics to help in decision-making.

## Features
- **User Management**: Add, edit, and remove users from the system.
- **Role-Based Access Control**: Assign roles and permissions to users for better security.
- **Reporting**: Generate reports on different aspects of the organization’s performance. 
- **Analytics Dashboard**: Visualize key metrics and data trends in real-time.
- **Integration**: Easy integration with existing systems through APIs.

## Tech Stack
- **Frontend**: React, CSS, HTML.
- **Backend**: Node.js, Express.
- **Database**: MongoDB.
- **Authentication**: JWT (JSON Web Tokens).
- **Deployment**: Docker, Kubernetes.

## Installation
1. Clone the repository:
   ```
   git clone https://github.com/HWHWHW888/management-system.git
   ```
2. Navigate to the project directory:
   ```
   cd management-system
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Set up environment variables in a `.env` file based on the `.env.example`.
5. Run the application:
   ```
   npm start
   ```

## Usage
- Access the application in your browser at `http://localhost:3000`.
- Follow the on-screen instructions to set up your account and start using the Management System.

## Development Guidelines
- Follow the **Git branching model** for managing code changes.
- Each feature should be developed in its own branch and merged after review.
- Ensure that all code is peer-reviewed before merging.
- Write clear, concise commit messages describing your changes.
- Document any new features in the README.

🚀 Junket Management System Prompt（分步骤执行）
Step 1 – Database Schema (Supabase)
👉 生成 Supabase 的完整 schema（Postgres），包含以下表：
* users (extends Supabase auth, roles: admin/staff)
* customers (profile, preferences, passport, notes, linked rolling & transactions)
* agents (profile, commission %)
* staff (profile, login account, attendance, check-in/out photos)
* trips (CRUD trips, link customers/agents/staff/expenses)
* rolling (customer rolling records, linked to trips, staff)
* transactions (customer transaction records, linked to trips, staff)
* expenses (trip expenses)
* commissions (agent commissions per trip)
* attendance (staff check-in/out with photo, timestamp)
要求：
* 使用 foreign keys 建立关系
* Supabase Row Level Security (RLS)
* Role-based access control (Admin full, Staff limited)

Step 2 – Authentication & Access Control
👉 实现基于 Supabase Auth 的登录：
* 支持 Admin / Staff 两种角色
* Admin 可以 CRUD 一切
* Staff 只能：登录、Check-in/out、查看分配的 Trip、录 Rolling & Transactions
* 登录页 UI：简洁，Tailwind + shadcn/ui

Step 3 – Core CRUD Modules
👉 实现以下 CRUD 界面 + API：
1. Customer Management
    * Basic Info（姓名、电话、生日、护照、社交账号、喜好）
    * Linked Rolling / Transactions / Trips
    * Reports
2. Agent Management
    * Agent Profile
    * Commission % 设置
    * Linked Customers / Trips
    * Commission 历史记录
3. Staff Management
    * Staff Profile CRUD
    * Login 权限
    * Attendance 记录（Check-in/out with photo）
4. Trip Management
    * Trip CRUD（日期、地点、参与人）
    * Assign Customers, Agents, Staff
    * Record Expenses
    * Linked Rolling & Transactions

Step 4 – Rolling & Transaction Entry
👉 实现 OCR Upload + Manual Entry
* Staff 可上传照片 → OCR → 自动填入 Rolling / Transaction
* 录入数据时自动计算并更新 HGW, HNW, HFP, Agent/Company Share
* 数据自动写入对应 Trip + Customer + Staff

Step 5 – Dashboard & Reports
👉 实现 实时 Dashboard（Admin 权限）：
* Real-time House Gross Win, Net Win, Final Profit
* Customer rolling & transaction overview
* Agent commission overview
* Trip overview (with expenses)
* Staff attendance overview
👉 Reports (支持 PDF/Excel 导出)：
* Rolling Reports
* Transaction Reports
* Trip Reports
* Commission Reports
* Staff Attendance Reports

Step 6 – Deployment
👉 部署到 **www.hoewingroup.com**：
* Frontend: React (Tailwind + shadcn/ui + TypeScript)
* Backend: Node.js + TypeScript + Supabase API
* Domain: HTTPS enforced, whitelist login
* Daily Supabase Backup enabled
