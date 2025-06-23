const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const os = require('os');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

// 导入数据库和模型
const { connectDB, isUsingMemoryStorage, memoryUserOperations } = require('./config/database');
const { router: authRouter, authenticateToken } = require('./routes/auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'wjairdrop_secret_key_2024';

// 连接数据库
connectDB().then(() => {
    if (isUsingMemoryStorage()) {
        console.log('✅ 应用启动成功 - 使用内存存储模式');
        console.log('⚠️  注意：用户数据将在服务器重启后丢失');
    } else {
        console.log('✅ 应用启动成功 - 使用MongoDB存储');
    }
}).catch(err => {
    console.error('数据库连接失败，但应用将继续运行:', err.message);
});

// 中间件配置
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 配置会话中间件（仅在MongoDB可用时使用MongoStore）
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'wjairdrop_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7天
  }
};

// 只有在不使用内存存储时才配置MongoStore
if (!isUsingMemoryStorage()) {
  try {
    sessionConfig.store = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/wjairdrop',
      touchAfter: 24 * 3600 // 24小时内不重复保存
    });
  } catch (error) {
    console.log('MongoStore配置失败，使用默认内存会话存储');
  }
}

app.use(session(sessionConfig));

// API路由
app.use('/api/auth', authRouter);

// 创建uploads目录
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名，保留原始文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, baseName + '-' + uniqueSuffix + ext);
  }
});

// 图片上传配置
const imageUpload = multer({
  storage: storage,

  fileFilter: function (req, file, cb) {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 通用文件上传配置
const fileUpload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 检查文件类型安全性
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'application/json',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'video/mp4',
      'video/avi',
      'video/quicktime'
    ];
    
    // 检查危险文件扩展名
    const dangerousExts = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar', '.js', '.vbs', '.ps1'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (dangerousExts.includes(fileExt)) {
      cb(new Error('不允许上传可执行文件'));
      return;
    }
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 图片上传路由
app.post('/api/upload/image', authenticateToken, imageUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('图片上传错误:', error);
    res.status(500).json({ error: '图片上传失败' });
  }
});

// 通用文件上传路由
app.post('/api/upload/file', authenticateToken, fileUpload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      fileUrl: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('文件上传错误:', error);
    res.status(500).json({ error: '文件上传失败' });
  }
});

// 文件下载路由
app.get('/api/download/:filename', authenticateToken, (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 获取文件信息
    const stats = fs.statSync(filePath);
    
    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stats.size);
    
    // 创建文件流并发送
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('文件下载错误:', error);
    res.status(500).json({ error: '文件下载失败' });
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// 存储在线用户（Socket ID到用户信息的映射）
const onlineUsers = new Map();

// Socket认证中间件
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    console.log(`Socket连接尝试: ${socket.id}`);
    console.log(`Token存在: ${!!token}`);
    
    // 允许无token的基础连接，但标记为未认证
    if (!token) {
      console.log(`Socket ${socket.id}: 无Token，标记为未认证`);
      socket.isAuthenticated = false;
      return next();
    }
    
    console.log(`Socket ${socket.id}: 开始验证Token`);
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(`Socket ${socket.id}: Token解码成功，用户ID: ${decoded.userId}`);
    
    let user;
    
    if (isUsingMemoryStorage()) {
      console.log(`Socket ${socket.id}: 使用内存存储查找用户`);
      user = await memoryUserOperations.findById(decoded.userId);
    } else {
      console.log(`Socket ${socket.id}: 使用数据库查找用户`);
      const User = require('./models/User');
      user = await User.findById(decoded.userId).select('-password');
    }
    
    if (!user) {
      console.log(`Socket ${socket.id}: 用户不存在，标记为未认证`);
      socket.isAuthenticated = false;
      return next();
    }
    
    console.log(`Socket ${socket.id}: 认证成功，用户: ${user.username}`);
    socket.user = user;
    socket.isAuthenticated = true;
    next();
  } catch (error) {
    console.log(`Socket ${socket.id}: 认证错误: ${error.message}`);
    socket.isAuthenticated = false;
    next();
  }
};

// 应用Socket认证中间件
io.use(authenticateSocket);

// 获取本机IP地址
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}

// Socket.IO 连接处理
io.on('connection', async (socket) => {
  console.log(`Socket连接: ${socket.id}, 认证状态: ${socket.isAuthenticated}`);
  
  // 如果未认证，只允许基础连接，不执行用户相关操作
  if (!socket.isAuthenticated) {
    console.log(`未认证连接: ${socket.id}`);
    return;
  }
  
  try {
    const user = socket.user;
    console.log(`用户连接: ${user.username} (${socket.id})`);

    // 更新用户在线状态
    if (isUsingMemoryStorage()) {
      await memoryUserOperations.updateById(user._id, { isOnline: true });
    } else {
      const User = require('./models/User');
      const dbUser = await User.findById(user._id);
      if (dbUser) {
        await dbUser.updateOnlineStatus(true, socket.id);
      }
    }
    
    // 添加到在线用户映射
    onlineUsers.set(socket.id, {
      userId: user._id,
      username: user.username,
      avatar: user.avatar || user.username.charAt(0).toUpperCase(),
      joinTime: new Date()
    });

    // 加入全局聊天室
    socket.join('global-chat');
    
    // 发送欢迎消息给新用户
    socket.emit('message', {
      id: Date.now() + Math.random(),
      type: 'system',
      content: `欢迎 ${user.username} 加入 WJAirDrop 全局聊天室！`,
      timestamp: new Date()
    });

    // 通知其他用户有新用户加入
    socket.broadcast.to('global-chat').emit('userJoined', {
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar || user.username.charAt(0).toUpperCase()
      }
    });
    
    // 广播系统消息给其他用户
    socket.broadcast.to('global-chat').emit('message', {
      id: Date.now() + Math.random(),
      type: 'system',
      content: `${user.username} 加入了聊天室`,
      timestamp: new Date()
    });

    // 发送当前在线用户列表给所有用户
    const usersList = Array.from(onlineUsers.values()).map(u => ({
      id: u.userId,
      username: u.username,
      avatar: u.avatar
    }));
    io.to('global-chat').emit('usersList', usersList);

    console.log(`用户 ${user.username} 加入全局聊天室`);
  } catch (error) {
    console.error('用户连接处理错误:', error);
    socket.emit('error', '连接失败，请重新登录');
    socket.disconnect();
  }

  // 处理消息发送
  socket.on('send_message', async (data) => {
    // 检查认证状态
    if (!socket.isAuthenticated) {
      socket.emit('error', '请先登录');
      return;
    }
    
    try {
      const userInfo = onlineUsers.get(socket.id);
      if (!userInfo) {
        socket.emit('error', '用户信息不存在，请重新登录');
        return;
      }

      // 验证消息内容
      if (data.type === 'image') {
        if (!data.imageUrl) {
          socket.emit('error', '图片URL不能为空');
          return;
        }
      } else if (data.type === 'file') {
        if (!data.fileUrl || !data.filename) {
          socket.emit('error', '文件信息不完整');
          return;
        }
      } else {
        if (!data.message || data.message.trim() === '') {
          socket.emit('error', '消息不能为空');
          return;
        }

        if (data.message.trim().length > 500) {
          socket.emit('error', '消息长度不能超过500个字符');
          return;
        }
      }

      const messageData = {
        id: Date.now() + Math.random(),
        user: {
          id: userInfo.userId,
          username: userInfo.username,
          avatar: userInfo.avatar
        },
        timestamp: new Date(),
        type: data.type || 'text'
      };

      // 根据消息类型设置内容
      if (data.type === 'image') {
        messageData.imageUrl = data.imageUrl;
        messageData.content = data.message || ''; // 可选的图片描述
      } else if (data.type === 'file') {
        messageData.fileUrl = data.fileUrl;
        messageData.filename = data.filename;
        messageData.originalName = data.originalName;
        messageData.size = data.size;
        messageData.mimetype = data.mimetype;
        messageData.content = data.message || ''; // 可选的文件描述
      } else {
        messageData.content = data.message.trim();
      }

      // 广播消息给全局聊天室的所有用户
      io.to('global-chat').emit('message', messageData);
      
      if (data.type === 'image') {
        console.log(`[全局聊天室] ${userInfo.username} 发送了图片: ${data.imageUrl}`);
      } else if (data.type === 'file') {
        console.log(`[全局聊天室] ${userInfo.username} 发送了文件: ${data.originalName || data.filename}`);
      } else {
        console.log(`[全局聊天室] ${userInfo.username}: ${data.message.trim()}`);
      }
      
    } catch (error) {
      console.error('发送消息错误:', error);
      socket.emit('error', '发送消息失败');
    }
  });

  // 用户断开连接
  socket.on('disconnect', async () => {
    console.log(`Socket断开连接: ${socket.id}, 认证状态: ${socket.isAuthenticated}`);
    
    // 只有认证用户才需要清理用户相关数据
    if (!socket.isAuthenticated) {
      return;
    }
    
    try {
      const userInfo = onlineUsers.get(socket.id);
      if (userInfo) {
        // 更新数据库中的用户在线状态
        if (isUsingMemoryStorage()) {
          await memoryUserOperations.updateById(userInfo.userId, { isOnline: false });
        } else {
          const User = require('./models/User');
          const user = await User.findById(userInfo.userId);
          if (user) {
            await user.updateOnlineStatus(false);
          }
        }
        
        // 从在线用户映射中移除
        onlineUsers.delete(socket.id);
        
        // 通知全局聊天室其他用户有用户离开
        socket.broadcast.to('global-chat').emit('userLeft', {
          user: {
            id: userInfo.userId,
            username: userInfo.username,
            avatar: userInfo.avatar
          }
        });
        
        // 广播离开消息给全局聊天室
        socket.broadcast.to('global-chat').emit('message', {
          id: Date.now() + Math.random(),
          type: 'system',
          content: `${userInfo.username} 离开了聊天室`,
          timestamp: new Date()
        });

        // 更新在线用户列表
        const usersList = Array.from(onlineUsers.values()).map(u => ({
          id: u.userId,
          username: u.username,
          avatar: u.avatar
        }));
        io.to('global-chat').emit('usersList', usersList);

        console.log(`用户 ${userInfo.username} 离开全局聊天室`);
      }
    } catch (error) {
      console.error('用户断开连接处理错误:', error);
    }
  });

  // 处理错误
  socket.on('error', (error) => {
    console.error('Socket错误:', error);
  });
});

// 启动服务器 - 监听所有网络接口以支持局域网访问
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('\n🚀 WJAirDrop 聊天服务器已启动!');
  console.log(`📱 本地访问: http://localhost:${PORT}`);
  console.log(`🌐 局域网访问: http://${localIP}:${PORT}`);
  console.log('\n💡 手机用户请使用局域网地址访问');
  console.log('⚠️  确保设备连接在同一WiFi网络\n');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});