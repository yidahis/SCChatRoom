# WJAirDrop React版本

## 项目结构

```
server/
├── src/                    # React源码目录
│   ├── components/         # React组件
│   │   ├── LoginScreen.js  # 登录界面
│   │   ├── ChatScreen.js   # 聊天界面
│   │   ├── MessageList.js  # 消息列表
│   │   ├── MessageInput.js # 消息输入框
│   │   └── UsersSidebar.js # 用户侧边栏
│   ├── styles/            # 样式文件
│   │   └── index.css      # 主样式文件
│   ├── App.js             # 主应用组件
│   ├── index.js           # 应用入口
│   └── index.html         # HTML模板
├── public/                # 静态资源（原版本）
├── webpack.config.js      # Webpack配置
├── .babelrc              # Babel配置
└── package.json          # 项目配置
```

## 安装依赖

```bash
cd server
npm install
```

## 开发模式

### 方式一：同时启动服务器和客户端
```bash
npm run dev-all
```

### 方式二：分别启动
```bash
# 终端1：启动后端服务器
npm run dev

# 终端2：启动React开发服务器
npm run dev-client
```

## 访问地址

- **React版本**: http://localhost:3001
- **原版本**: http://localhost:3000
- **后端API**: http://localhost:3000

## 生产构建

```bash
npm run build
```

构建后的文件将输出到 `public/dist/` 目录。

## 主要特性

### ✅ 已实现功能

1. **用户认证**
   - 用户名验证
   - 登录状态管理

2. **实时聊天**
   - WebSocket连接
   - 消息发送和接收
   - 消息历史显示

3. **用户管理**
   - 在线用户列表
   - 用户加入/离开通知

4. **界面优化**
   - 响应式设计
   - 输入框固定在底部
   - 消息自动滚动
   - 现代化UI设计

### 🔧 技术栈

- **前端**: React 18, Socket.IO Client
- **构建工具**: Webpack 5, Babel
- **样式**: CSS3 (Flexbox, Grid)
- **后端**: Node.js, Express, Socket.IO

### 📱 响应式设计

- 支持桌面端和移动端
- 自适应布局
- 触摸友好的交互

### 🎨 UI/UX 改进

- 现代化的渐变背景
- 流畅的动画效果
- 直观的用户界面
- 固定底部输入框设计

## 开发说明

### 输入框固定设计

为了确保输入框始终固定在底部，采用了以下CSS布局策略：

```css
.chat-screen {
  display: flex;
  flex-direction: column;
  height: 100vh; /* 占满视口高度 */
}

.chat-main {
  flex: 1; /* 占据剩余空间 */
  overflow: hidden;
}

.chat-footer {
  flex-shrink: 0; /* 防止被压缩 */
}
```

### 组件架构

- **App.js**: 主应用状态管理
- **LoginScreen.js**: 登录界面和验证
- **ChatScreen.js**: 聊天主界面布局
- **MessageList.js**: 消息展示和滚动
- **MessageInput.js**: 消息输入和发送
- **UsersSidebar.js**: 用户列表侧边栏

## 故障排除

### 常见问题

1. **端口冲突**
   - 确保3000端口（后端）和3001端口（前端）未被占用

2. **WebSocket连接失败**
   - 检查后端服务器是否正常运行
   - 确认防火墙设置

3. **构建失败**
   - 清除node_modules重新安装依赖
   - 检查Node.js版本（推荐16+）

### 调试模式

在浏览器开发者工具中可以查看：
- WebSocket连接状态
- 消息发送/接收日志
- React组件状态