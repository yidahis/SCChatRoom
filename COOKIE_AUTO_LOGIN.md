# Cookie 自动登录功能说明

## 📋 功能概述

已成功实现基于 Cookie 的自动登录功能，用户刷新浏览器后无需重新输入用户名。

## ✨ 主要特性

### 1. **HttpOnly Cookie** 
- ✅ 安全性高：防止 XSS 攻击窃取 token
- ✅ 有效期：7 天
- ✅ 自动发送：每次请求自动携带

### 2. **双重存储机制**
- **Cookie**（HttpOnly）：用于 API 认证，前端无法直接读取
- **localStorage**：用于 Socket.IO 连接，前端可访问

### 3. **自动登录流程**
```
页面加载 
  ↓
检查 Cookie（通过 /api/auth/verify）
  ↓
Cookie 有效 + localStorage 有 token
  ↓
✅ 自动进入聊天室
```

## 🔧 技术实现

### 后端修改

#### 1. 安装依赖
```bash
npm install cookie-parser
```

#### 2. app.js - 添加 Cookie 解析中间件
```javascript
const cookieParser = require('cookie-parser');
app.use(cookieParser());
```

#### 3. routes/auth.js - 登录时设置 Cookie
```javascript
// 登录成功后设置 HttpOnly Cookie
res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
  path: '/'
});
```

#### 4. routes/auth.js - 从 Cookie 读取 Token
```javascript
// authenticateToken 中间件支持从 Cookie 获取 token
if (!token && req.cookies && req.cookies.token) {
  token = req.cookies.token;
}
```

#### 5. routes/auth.js - 登出接口
```javascript
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  res.json({ success: true, message: '登出成功' });
});
```

### 前端修改

#### src/App.js - 自动登录检查
```javascript
useEffect(() => {
  checkAutoLogin(); // 页面加载时检查
}, []);

const checkAutoLogin = async () => {
  const response = await fetch('/api/auth/verify', {
    credentials: 'include' // 允许发送 Cookie
  });
  
  if (data.success && data.data.user) {
    // 自动登录成功
    setCurrentUser(data.data.user);
    setCurrentScreen('chat');
    // 连接 Socket.IO
  }
};
```

## 🚀 使用方法

### 首次登录
1. 打开应用 http://localhost:3001
2. 输入用户名
3. 点击"进入聊天室"
4. ✅ Token 同时保存到 Cookie 和 localStorage

### 刷新浏览器
1. 按 F5 或 Ctrl+R 刷新页面
2. ✅ 自动检查 Cookie
3. ✅ 自动进入聊天室（无需输入用户名）

### 手动登出
1. 点击登出按钮
2. ✅ Cookie 被清除
3. ✅ localStorage 被清除
4. 返回登录页面

## ⚠️ 注意事项

### 1. Cookie vs localStorage
- **Cookie (HttpOnly)**：
  - ✅ 安全，防止 XSS
  - ❌ 前端 JavaScript 无法读取
  - 用于：API 请求认证
  
- **localStorage**：
  - ✅ 前端可读写
  - ❌ 可能受 XSS 攻击
  - 用于：Socket.IO 连接

### 2. 为什么需要两者？
由于我们使用 HttpOnly Cookie（更安全），前端无法直接读取 token。但 Socket.IO 需要在客户端代码中传递 token，所以我们仍然保留 localStorage 存储。

**最佳实践建议**：
- 如果只关心 API 认证，可以只用 Cookie
- 如果需要 WebSocket 连接，需要额外存储 token

### 3. 安全性配置
```javascript
{
  httpOnly: true,           // 防止 XSS
  secure: production,       // 生产环境仅 HTTPS
  sameSite: 'lax',          // CSRF 保护
  maxAge: 7 days            // 7天有效期
}
```

## 🧪 测试步骤

### 测试 1：正常自动登录
```bash
# 1. 启动服务
npm run dev-all

# 2. 访问应用
http://localhost:3001

# 3. 输入用户名登录

# 4. 刷新浏览器（F5）
# 预期：自动进入聊天室，无需重新登录
```

### 测试 2：查看 Cookie
```javascript
// 在浏览器控制台执行
document.cookie
// 应该看不到 token（因为是 HttpOnly）

// 查看 Network 面板中的请求
// 应该看到 Cookie header 包含 token
```

### 测试 3：登出功能
```bash
# 1. 点击登出按钮
# 2. 刷新浏览器
# 预期：显示登录页面，需要重新登录
```

### 测试 4：Cookie 过期
```bash
# 等待 7 天后
# 刷新浏览器
# 预期：Cookie 过期，需要重新登录
```

## 🔍 调试技巧

### 查看 Cookie 是否设置
1. 打开浏览器开发者工具
2. 切换到 **Application** 标签
3. 左侧选择 **Cookies** → `http://localhost:3001`
4. 应该看到 `token` cookie（HttpOnly 列打勾）

### 查看网络请求
1. 打开 **Network** 标签
2. 刷新页面
3. 查看 `/api/auth/verify` 请求
4. 检查 **Request Headers** 中的 `Cookie` 字段

### 查看控制台日志
```
🔍 检查自动登录状态...
✅ 自动登录成功: 用户名
✅ Socket连接已建立
```

## 📝 常见问题

### Q1: 为什么刷新后还是需要登录？
**A**: 可能的原因：
1. localStorage 中没有 token（只有 Cookie）
2. Cookie 已过期或被清除
3. 浏览器禁用了 Cookie

**解决方案**：
- 检查浏览器控制台日志
- 确认 Cookie 是否存在
- 重新登录一次

### Q2: 如何延长 Cookie 有效期？
**A**: 修改 `routes/auth.js` 中的 `maxAge`：
```javascript
maxAge: 30 * 24 * 60 * 60 * 1000, // 改为30天
```

### Q3: 生产环境需要注意什么？
**A**: 
1. 确保 `secure: true`（仅 HTTPS）
2. 设置正确的域名
3. 考虑使用更短的有效期
4. 实现 token 刷新机制

### Q4: 能否只用 Cookie，不用 localStorage？
**A**: 可以，但需要修改 Socket.IO 连接方式：
```javascript
// Socket.IO 会自动携带 Cookie
const socket = io(serverUrl, {
  withCredentials: true // 允许携带 Cookie
});
```

然后在后端的 Socket 认证中从 Cookie 读取 token。

## 🎯 下一步优化建议

1. **Token 刷新机制**：接近过期时自动刷新
2. **记住我选项**：让用户选择是否自动登录
3. **多设备管理**：显示已登录的设备列表
4. **会话超时提醒**：即将过期时提示用户
5. **强制登出其他设备**：安全功能

## 📊 代码变更总结

| 文件 | 变更内容 |
|------|---------|
| `package.json` | 新增 `cookie-parser` 依赖 |
| `app.js` | 添加 `cookieParser()` 中间件 |
| `routes/auth.js` | 登录设置 Cookie、登出清除 Cookie、认证支持 Cookie |
| `src/App.js` | 添加自动登录检查逻辑、改进登出流程 |

---

**实现完成时间**: 2026-05-06  
**功能状态**: ✅ 已完成并测试
