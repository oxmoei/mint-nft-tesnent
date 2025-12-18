# Mint NFT

一个基于 Next.js + React + Tailwind CSS + wagmi + viem + Bun 构建的 NFT Mint 前端项目。

## 技术栈

- **Next.js 16** - React 框架
- **React 19** - UI 库
- **Tailwind CSS 4** - 样式框架
- **wagmi** - React Hooks for Ethereum
- **viem** - TypeScript 以太坊库
- **Bun** - 运行时和包管理器
- **TypeScript** - 类型安全

## 快速开始

### 安装依赖

```bash
bun install
```

### 配置环境变量

创建 `.env.local` 文件：

```bash
# WalletConnect Project ID (可选，如果需要 WalletConnect 支持)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id

# NFT 合约地址
NEXT_PUBLIC_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
```

### 运行开发服务器

```bash
bun dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建生产版本

```bash
bun run build
bun start
```

## 项目结构

```
src/
├── app/              # Next.js App Router
│   ├── layout.tsx   # 根布局（包含 Web3Provider）
│   ├── page.tsx     # 首页
│   └── globals.css  # 全局样式
├── components/      # React 组件
│   ├── Web3Provider.tsx  # Web3 提供者
│   └── MintNFT.tsx       # Mint NFT 主组件
└── config/          # 配置文件
    └── wagmi.ts     # wagmi 配置
```

## 配置合约

在 `src/components/MintNFT.tsx` 中更新以下配置：

- `CONTRACT_ADDRESS` - 你的 NFT 合约地址
- `CONTRACT_ABI` - 合约 ABI（确保包含 `mint` 函数）
- `MINT_PRICE` - Mint 价格（ETH）

## 功能特性

- ✅ 钱包连接（MetaMask、Injected）
- ✅ NFT Mint 功能
- ✅ 交易状态显示
- ✅ 响应式设计
- ✅ 现代化 UI（渐变背景、毛玻璃效果）

## 部署

### Vercel

最简单的方式是使用 [Vercel Platform](https://vercel.com/new) 部署。

### 其他平台

```bash
bun run build
```

构建产物在 `.next` 目录中。

## 许可证

MIT
