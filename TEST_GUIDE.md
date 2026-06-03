# 🧪 Cookie 自动登录功能测试指南

## ✅ 服务已启动

- **前端**: http://localhost:3001
- **后端**: http://localhost:3678

## 📝 测试步骤

### 测试 1：首次登录并设置 Cookie

1. **打开浏览器**
   ```
   访问: http://localhost:3001
   ```

2. **输入用户名**
   - 例如：`测试用户`
   - 点击"进入聊天室"

3. **验证 Cookie 已设置**
   - 按 `F12` 打开开发者工具
   - 切换到 **Application** 标签
   - 左侧选择 **Cookies** → `http://localhost:3001`
   - 应该看到 `token` cookie，且 **HttpOnly** 列打勾 ✓

4. **查看控制台日志**
   ```
   应该看到类似输出：
   ✅ 用户登录成功
   Token 已保存到 localStorage
   ```

---

### 测试 2：刷新浏览器（自动登录）

1. **刷新页面**
   - 按 `F5` 或 `Ctrl+R` (Mac: `Cmd+R`)

2. **观察自动登录过程**
   - 页面会显示"正在检查登录状态..."
   - 然后自动进入聊天室

3. **查看控制台日志**
   ```
   🔍 检查自动登录状态...
   ✅ 自动登录成功: 测试用户
   ✅ Socket连接已建立
   ```

4. **验证结果**
   - ✅ 无需重新输入用户名
   - ✅ 直接进入聊天界面
   - ✅ 可以正常发送消息

---

### 测试 3：验证 API 请求携带 Cookie

1. **打开 Network 面板**
   - 开发者工具 → **Network** 标签

2. **触发一个 API 请求**
   - 例如：发送一条消息

3. **检查请求头**
   - 点击任意 `/api/` 开头的请求
   - 查看 **Headers** → **Request Headers**
   - 应该看到：
     ```
     Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```

---

### 测试 4：手动登出

1. **点击登出按钮**
   - 在聊天界面找到登出按钮并点击

2. **验证登出**
   - 返回登录页面
   - 查看控制台日志：
     ```
     ✅ 登出成功，Cookie已清除
     ```

3. **检查 Cookie 是否清除**
   - Application → Cookies
   - `token` cookie 应该消失

4. **刷新浏览器**
   - 应该停留在登录页面
   - 不会自动登录

---

### 测试 5：Cookie 过期模拟

1. **手动删除 Cookie**
   - Application → Cookies
   - 右键 `token` → Delete

2. **刷新页面**
   - 应该显示登录页面
   - 控制台日志：
     ```
     ❌ 自动登录失败，显示登录页面
     ```

---

## 🔍 调试技巧

### 1. 查看 Cookie 详细信息

```javascript
// 在控制台执行
document.cookie
// 注意：看不到 HttpOnly cookie，这是正常的
```

### 2. 强制查看 HttpOnly Cookie

只能通过服务器端或 Network 面板查看：
- Network 面板 → 任意请求 → Request Headers → Cookie

### 3. 检查 localStorage

```javascript
// 在控制台执行
localStorage.getItem('token')
// 应该显示 token 字符串
```

### 4. 模拟不同场景

```javascript
// 清除 localStorage（保留 Cookie）
localStorage.removeItem('token')
// 刷新页面后，虽然有 Cookie 但无法自动登录
// 因为 Socket.IO 需要 token

// 清除 Cookie（保留 localStorage）
// 需要通过 Application 面板手动删除
// 刷新页面后，API 请求会失败
```

---

## ⚠️ 常见问题排查

### 问题 1：刷新后仍需登录

**可能原因**：
- Cookie 未正确设置
- localStorage 中没有 token
- 浏览器禁用了 Cookie

**解决方案**：
```javascript
// 1. 检查 Cookie 是否存在
// Application → Cookies → 查看 token

// 2. 检查 localStorage
console.log(localStorage.getItem('token'))

// 3. 检查控制台错误
// 查看是否有红色错误信息
```

### 问题 2：看到 "Cookie有效但localStorage中无token"

**原因**：
- 只设置了 Cookie，但 localStorage 被清除
- 或者使用了隐私模式

**解决方案**：
- 重新登录一次
- 确保不要使用隐私/无痕模式

### 问题 3：Socket 连接失败

**可能原因**：
- localStorage 中的 token 无效
- 后端服务未启动

**解决方案**：
```bash
# 检查后端是否运行
curl http://localhost:3678/api/server-info

# 重新登录获取新 token
```

---

## 📊 预期行为总结

| 操作 | Cookie | localStorage | 结果 |
|------|--------|--------------|------|
| 首次登录 | ✅ 设置 | ✅ 设置 | 进入聊天室 |
| 刷新页面 | ✅ 存在 | ✅ 存在 | ✅ 自动登录 |
| 刷新页面 | ✅ 存在 | ❌ 缺失 | ❌ 需重新登录 |
| 刷新页面 | ❌ 缺失 | ✅ 存在 | ❌ 需重新登录 |
| 点击登出 | ❌ 清除 | ❌ 清除 | 返回登录页 |

---

## 🎯 成功标准

✅ **全部通过以下测试即表示功能正常**：

1. [ ] 登录后能看到 Cookie 被设置（HttpOnly）
2. [ ] 刷新浏览器后自动进入聊天室
3. [ ] API 请求自动携带 Cookie
4. [ ] 点击登出后 Cookie 被清除
5. [ ] 登出后刷新需要重新登录
6. [ ] 控制台没有错误信息

---

## 💡 提示

- **开发环境**：Cookie 可以通过 HTTP 传输
- **生产环境**：需要 HTTPS 才能设置 `secure` Cookie
- **有效期**：当前设置为 7 天
- **安全性**：HttpOnly 防止 XSS 攻击窃取 token

---

**测试完成后，如果一切正常，恭喜！🎉**
**Cookie 自动登录功能已成功实现！**
