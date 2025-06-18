# WJAirDrop - 局域网即时通讯应用

一个基于Node.js和Socket.IO的局域网即时通讯应用，支持Mac服务器和移动端Web客户端。

## 功能特性

- 🚀 实时消息传输
- 📱 移动端友好的Web界面
- 🌐 局域网内设备互联
- 💬 多用户聊天室
- 🎨 现代化UI设计

## 项目结构

```
WJAirDrop/
├── server/
│   ├── app.js          # 主服务器文件
│   ├── package.json    # 服务器依赖
│   └── public/         # 静态文件目录
│       ├── index.html  # 聊天界面
│       ├── style.css   # 样式文件
│       └── script.js   # 客户端脚本
└── README.md
```

## 快速开始

1. 安装依赖：
   ```bash
   cd server
   npm install
   ```

2. 启动服务器：
   ```bash
   npm start
   ```

3. 在手机浏览器中访问：
   ```
   http://[Mac的IP地址]:3000
   ```

## 使用说明

1. 确保Mac和手机连接在同一个WiFi网络
2. 在Mac上启动服务器
3. 手机浏览器访问服务器地址
4. 输入昵称开始聊天

## 技术栈

- **后端**: Node.js + Express + Socket.IO
- **前端**: HTML5 + CSS3 + JavaScript
- **实时通信**: WebSocket