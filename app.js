const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const os = require('os');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs'); // 导入完整的fs模块
const fsPromises = require('fs').promises; // 使用Promise版本
const archiver = require('archiver'); // 用于文件夹压缩

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

const PORT = process.env.PORT || 3678;
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

// 中间件配置 - 支持大文件上传
console.log('⚙️ [后端] 配置Express中间件 - 请求体大小限制: 无限制');
app.use(express.json({ limit: '50gb' }));
app.use(express.urlencoded({ extended: true, limit: '50gb' }));

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
    // 注意：部分浏览器/客户端在 multipart header 中会以 latin1 编码传回文件名，
    // multer 的 file.originalname 可能会是 latin1 编码的字符串，直接使用会导致中文文件名在磁盘上出现乱码。
    // 这里先把 originalname 从 latin1 解码为 utf8，再提取扩展名和基础名字。
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

      // 将可能的 latin1 编码转换为 UTF-8
      const originalNameDecoded = Buffer.from(file.originalname, 'latin1').toString('utf8');

      const ext = path.extname(originalNameDecoded);
      let baseName = path.basename(originalNameDecoded, ext);

      // 防止文件名中包含路径分隔符或特殊控制字符
      baseName = baseName.replace(/[/\\\0]/g, '_');

      const finalName = `${baseName}-${uniqueSuffix}${ext}`;
      cb(null, finalName);
    } catch (err) {
      // 在极少数情况下回退到原始处理方式，保证不会阻塞上传
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext).replace(/[/\\\0]/g, '_');
      cb(null, baseName + '-' + uniqueSuffix + ext);
    }
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
  // 文件大小限制已移除，允许上传任意大小的文件
  fileFilter: function (req, file, cb) {
    console.log('🔍 [后端] 检查文件类型:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname
    });
    
    // 只检查危险文件扩展名，允许所有其他文件类型
    const dangerousExts = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar', '.js', '.vbs', '.ps1'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (dangerousExts.includes(fileExt)) {
      console.error('❌ [后端] 危险文件类型被拒绝:', fileExt);
      cb(new Error('不允许上传可执行文件'));
      return;
    }
    
    console.log('✅ [后端] 文件类型检查通过');
    cb(null, true);
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
app.post('/api/upload/file', authenticateToken, (req, res) => {
  console.log('🔄 [后端] 收到文件上传请求:', {
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
      'authorization': req.headers['authorization'] ? '已提供' : '未提供'
    },
    user: req.user ? req.user.username : '未知用户'
  });

  fileUpload.single('file')(req, res, (err) => {
    if (err) {
      console.error('❌ [后端] Multer处理错误:', {
        name: err.name,
        message: err.message,
        code: err.code,
        field: err.field,
        stack: err.stack
      });
      return res.status(400).json({ error: `文件上传处理失败: ${err.message}` });
    }

    try {
      console.log('📦 [后端] Multer处理完成，检查文件...');
      
      if (!req.file) {
        console.error('❌ [后端] 没有接收到文件');
        return res.status(400).json({ error: '没有上传文件' });
      }

      // 处理并确保 originalname 为 UTF-8（防止上传中文名出现乱码）
      let decodedOriginalName = req.file.originalname;
      try {
        decodedOriginalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      } catch (e) {
        // 如解码失败则保留原始值
        decodedOriginalName = req.file.originalname;
      }

      // 更新 req.file.originalname，后续逻辑（或其它中间件）可以使用已解码的值
      req.file.originalname = decodedOriginalName;

      console.log('✅ [后端] 文件接收成功:', {
        originalname: decodedOriginalName,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
        sizeMB: (req.file.size / 1024 / 1024).toFixed(2) + 'MB',
        destination: req.file.destination,
        path: req.file.path
      });

      const fileUrl = `/uploads/${req.file.filename}`;
      const responseData = {
        success: true,
        fileUrl: fileUrl,
        filename: req.file.filename,
        originalName: decodedOriginalName,
        size: req.file.size,
        mimetype: req.file.mimetype
      };

      console.log('🎉 [后端] 文件上传成功，返回响应:', responseData);
      res.json(responseData);
      
    } catch (error) {
      console.error('💥 [后端] 文件上传处理异常:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: `文件上传失败: ${error.message}` });
    }
  });
});

// 获取文件列表路由
app.get('/api/files', authenticateToken, async (req, res) => {
  try {
    console.log('📁 [后端] 收到文件列表请求');
    
    const files = await fs.promises.readdir(uploadsDir);
    const fileList = [];
    
    for (const filename of files) {
      const filePath = path.join(uploadsDir, filename);
      const stats = await fs.promises.stat(filePath);
      
      // 解析文件名，提取原始文件名
      const ext = path.extname(filename);
      const baseName = path.basename(filename, ext);
      const originalName = baseName.split('-').slice(0, -1).join('-') + ext;
      
      fileList.push({
        filename: filename,
        originalName: originalName,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        uploadTime: stats.mtime,
        type: path.extname(filename).toLowerCase()
      });
    }
    
    // 按上传时间倒序排列
    fileList.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
    
    console.log(`📁 [后端] 返回文件列表，共 ${fileList.length} 个文件`);
    res.json({
      success: true,
      files: fileList
    });
    
  } catch (error) {
    console.error('❌ [后端] 获取文件列表失败:', error);
    res.status(500).json({ error: '获取文件列表失败' });
  }
});

// 文件下载路由
app.get('/api/download/:filename', authenticateToken, (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    const userInfo = req.user ? { id: req.user.id, username: req.user.username } : 'Unknown';
    
    console.log(`🔽 [后端] 文件下载请求开始 [${requestId}]:`, {
      filename,
      filePath,
      user: userInfo,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString()
    });
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.error(`❌ [后端] 文件不存在 [${requestId}]:`, {
        filename,
        filePath,
        user: userInfo
      });
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 获取文件信息
    const stats = fs.statSync(filePath);
    console.log(`📊 [后端] 文件信息 [${requestId}]:`, {
      filename,
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile()
    });
    
    // 设置响应头（同时提供 filename 和 filename* 以支持带有 UTF-8 字符的文件名）
    // filename* 按 RFC5987 使用 UTF-8 编码并 URL-encode
    try {
      const encodedFilename = encodeURIComponent(filename);
      let asciiSafe = filename.replace(/[\"\\\r\n]/g, '');
      asciiSafe = asciiSafe.replace(/[^\x20-\x7E]/g, '_');
      if (!asciiSafe) asciiSafe = 'download';
      res.setHeader('Content-Disposition', `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encodedFilename}`);
    } catch (e) {
      try {
        res.setHeader('Content-Disposition', `attachment; filename="download"`);
      } catch (ee) {
        console.error('设置 Content-Disposition 失败:', ee);
      }
    }
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    console.log(`📤 [后端] 开始发送文件 [${requestId}]:`, {
      filename,
      contentLength: stats.size,
      headers: {
        'Content-Disposition': res.getHeader('Content-Disposition'),
        'Content-Length': stats.size,
        'Content-Type': 'application/octet-stream'
      }
    });
    
    // 创建文件流并发送
    const fileStream = fs.createReadStream(filePath);
    
    // 监听流事件
    let bytesTransferred = 0;
    
    fileStream.on('data', (chunk) => {
      bytesTransferred += chunk.length;
      // 每传输10%记录一次进度（避免日志过多）
      const progress = (bytesTransferred / stats.size) * 100;
      if (progress % 10 < (chunk.length / stats.size) * 100) {
        console.log(`📈 [后端] 下载进度 [${requestId}]: ${progress.toFixed(1)}% (${formatFileSize(bytesTransferred)}/${formatFileSize(stats.size)})`);
      }
    });
    
    fileStream.on('end', () => {
      const duration = Date.now() - startTime;
      const speed = stats.size / (duration / 1000); // bytes per second
      console.log(`✅ [后端] 文件下载完成 [${requestId}]:`, {
        filename,
        totalSize: formatFileSize(stats.size),
        duration: `${duration}ms`,
        averageSpeed: formatFileSize(speed) + '/s',
        user: userInfo
      });
    });
    
    fileStream.on('error', (streamError) => {
      const duration = Date.now() - startTime;
      console.error(`💥 [后端] 文件流错误 [${requestId}]:`, {
        filename,
        error: streamError.message,
        bytesTransferred: formatFileSize(bytesTransferred),
        duration: `${duration}ms`,
        user: userInfo
      });
    });
    
    // 监听响应关闭事件
    res.on('close', () => {
      const duration = Date.now() - startTime;
      if (bytesTransferred < stats.size) {
        console.warn(`⚠️ [后端] 下载中断 [${requestId}]:`, {
          filename,
          bytesTransferred: formatFileSize(bytesTransferred),
          totalSize: formatFileSize(stats.size),
          progress: `${((bytesTransferred / stats.size) * 100).toFixed(1)}%`,
          duration: `${duration}ms`,
          user: userInfo
        });
      }
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`💥 [后端] 文件下载错误 [${requestId}]:`, {
      filename: req.params.filename,
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`,
      user: req.user ? { id: req.user.id, username: req.user.username } : 'Unknown'
    });
    res.status(500).json({ error: '文件下载失败' });
  }
});

// 文件大小格式化函数
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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

// 添加文件下载API
app.get('/api/filesystem/download', authenticateToken, (req, res) => {
  try {
    const { filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ 
        success: false, 
        error: '文件路径不能为空' 
      });
    }
    
    // 解析并验证文件路径
    const resolvedPath = path.resolve(filePath);
    console.log('下载文件，路径:', resolvedPath);
    
    // 检查文件是否存在
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ 
        success: false, 
        error: '文件不存在' 
      });
    }
    
    // 检查是否为文件（而不是目录）
    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      return res.status(400).json({ 
        success: false, 
        error: '指定路径不是文件' 
      });
    }
    
    // 获取文件名
    const fileName = path.basename(resolvedPath);
    
    // 设置响应头并使用流式发送文件（支持 UTF-8 文件名）
    try {
      // 为了避免在 setHeader 时出现 Invalid character 错误，
      // 必须确保未编码的 filename 部分只包含 ASCII 可打印字符且没有控制字符。
      const encodedFilename = encodeURIComponent(fileName);
      let asciiSafe = fileName.replace(/["\\\r\n]/g, '');
      // 将非 ASCII 可打印字符替换为下划线
      asciiSafe = asciiSafe.replace(/[^\x20-\x7E]/g, '_');
      if (!asciiSafe) asciiSafe = 'download';
      res.setHeader('Content-Disposition', `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encodedFilename}`);
    } catch (e) {
      try {
        res.setHeader('Content-Disposition', `attachment; filename="download"`);
      } catch (ee) {
        console.error('设置 Content-Disposition 失败:', ee);
      }
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);

    // 使用流式传输，避免 sendFile 在某些挂载点或权限下的问题
    const readStream = fs.createReadStream(resolvedPath);

    readStream.on('open', () => {
      console.log('开始流式发送文件:', resolvedPath);
      readStream.pipe(res);
    });

    readStream.on('error', (streamErr) => {
      console.error('读取文件流错误:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: '文件读取失败' });
      } else {
        // 如果头已发送，直接销毁响应
        try { res.end(); } catch(e) {}
      }
    });

    // 如果客户端中断连接，销毁读取流
    res.on('close', () => {
      if (!readStream.destroyed) {
        console.warn('响应关闭：销毁文件读取流');
        readStream.destroy();
      }
    });
  } catch (error) {
    console.error('文件下载失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '文件下载失败: ' + error.message 
    });
  }
});

// 添加文件夹下载API
app.get('/api/filesystem/download-folder', authenticateToken, async (req, res) => {
  try {
    const { folderPath } = req.query;
    
    if (!folderPath) {
      return res.status(400).json({ 
        success: false, 
        error: '未提供文件夹路径' 
      });
    }
    
    // 解析并规范化路径
    const resolvedPath = path.resolve(folderPath);
    console.log('下载文件夹，路径:', resolvedPath);
    
    // 检查文件夹是否存在
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ 
        success: false, 
        error: '文件夹不存在' 
      });
    }
    
    // 检查是否为目录
    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ 
        success: false, 
        error: '指定路径不是文件夹' 
      });
    }
    
    // 获取文件夹名称
    const folderName = path.basename(resolvedPath);
    
    // 创建一个临时文件来存储zip
    const zipFileName = `${folderName}.zip`;
    const zipFilePath = path.join(os.tmpdir(), zipFileName);
    
    // 创建一个可写流
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // 设置压缩级别
    });
    
    // 监听所有存档数据被写入底层流
    output.on('close', function() {
      console.log('文件夹压缩完成，大小:', archive.pointer() + ' bytes');
      
      // 发送zip文件（支持 UTF-8 文件名），使用流式传输并在完成后删除临时文件
      try {
        const encodedZipName = encodeURIComponent(zipFileName);
        let asciiSafeZip = zipFileName.replace(/["\\\r\n]/g, '');
        asciiSafeZip = asciiSafeZip.replace(/[^\x20-\x7E]/g, '_');
        if (!asciiSafeZip) asciiSafeZip = 'archive.zip';
        res.setHeader('Content-Disposition', `attachment; filename="${asciiSafeZip}"; filename*=UTF-8''${encodedZipName}`);
      } catch (e) {
        try { res.setHeader('Content-Disposition', `attachment; filename="archive.zip"`); } catch (ee) { console.error('设置 Content-Disposition 失败:', ee); }
      }
      res.setHeader('Content-Type', 'application/zip');

      // 获取临时zip文件大小并以流式方式发送
      try {
        const zipStat = fs.statSync(zipFilePath);
        res.setHeader('Content-Length', zipStat.size);
        const zipStream = fs.createReadStream(zipFilePath);
        zipStream.on('open', () => zipStream.pipe(res));
        zipStream.on('error', (streamErr) => {
          console.error('zip 读取流错误:', streamErr);
          if (!res.headersSent) res.status(500).json({ success: false, error: '发送zip文件失败' });
        });
        res.on('close', () => {
          if (!zipStream.destroyed) zipStream.destroy();
          // 删除临时文件
          fs.unlink(zipFilePath, (unlinkErr) => {
            if (unlinkErr) console.error('删除临时zip文件失败:', unlinkErr);
          });
        });
        // 在 pipe 完成后（响应结束）也尝试删除临时文件（安全兜底）
        zipStream.on('end', () => {
          fs.unlink(zipFilePath, (unlinkErr) => {
            if (unlinkErr) console.error('删除临时zip文件失败:', unlinkErr);
          });
        });
      } catch (statErr) {
        console.error('读取zip文件信息失败:', statErr);
        return res.status(500).json({ success: false, error: '发送zip文件失败' });
      }
    });
    
    // 监听错误
    archive.on('error', function(err) {
      console.error('压缩文件夹失败:', err);
      res.status(500).json({ 
        success: false, 
        error: '压缩文件夹失败: ' + err.message 
      });
    });
    
    // 将存档数据通过管道传输到文件
    archive.pipe(output);
    
    // 将目录添加到存档
    archive.directory(resolvedPath, folderName);
    
    // 完成存档
    archive.finalize();
  } catch (error) {
    console.error('文件夹下载失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '文件夹下载失败: ' + error.message 
    });
  }
});

// 添加文件系统相关路由
app.get('/api/filesystem/list', authenticateToken, async (req, res) => {
  try {
    const { dirPath, showHidden } = req.query;
    let targetPath;
    
    console.log('接收到目录请求，路径:', dirPath);
    
    // 如果没有提供路径，则使用用户的主目录
    if (!dirPath) {
      targetPath = os.homedir();
      console.log('未提供路径，使用主目录:', targetPath);
    } else {
      // 处理路径，确保格式正确
      let processedPath = dirPath;
      
      // 确保路径在允许的范围内（基础安全检查）
      targetPath = path.resolve(processedPath);
      console.log('处理后的目标路径:', targetPath);
      
      // 检查是否为磁盘根路径（允许访问磁盘根路径）
      const rootPath = path.parse(targetPath).root;
      const isDiskRoot = targetPath === rootPath || targetPath === rootPath.slice(0, -1);
      console.log('根路径检查:', { targetPath, rootPath, isDiskRoot });
      
      // 放宽安全限制，允许访问更多目录
      // 如果不是磁盘根路径，则确保不会访问系统根目录以上的内容
      if (!isDiskRoot) {
        const homeDir = os.homedir();
        // 移除对主目录的限制，允许访问应用程序目录
        /*
        if (!targetPath.startsWith(homeDir) && targetPath !== homeDir) {
          return res.status(403).json({ 
            success: false, 
            error: '访问被拒绝：只能访问用户主目录下的文件' 
          });
        }
        */
      }
    }
    
    // 检查路径是否存在
    try {
      console.log('检查路径是否存在:', targetPath);
      
      // 确保路径末尾没有多余的斜杠（除了根目录）
      if (targetPath !== '/' && targetPath.endsWith('/')) {
        targetPath = targetPath.slice(0, -1);
        console.log('移除末尾斜杠后的路径:', targetPath);
      }
      
      await fsPromises.access(targetPath);
      console.log('路径存在，继续处理');
    } catch (err) {
      console.error('路径不存在错误:', err);
      return res.status(404).json({ 
        success: false, 
        error: '路径不存在: ' + targetPath 
      });
    }
    
    // 读取目录内容
    const items = await fsPromises.readdir(targetPath, { withFileTypes: true });
    
    // 根据showHidden参数过滤隐藏文件
    const filteredItems = showHidden === 'true' ? items : items.filter(item => !item.name.startsWith('.'));
    
    // 格式化返回数据
    const formattedItems = await Promise.all(filteredItems.map(async (item) => {
      const fullPath = path.join(targetPath, item.name);
      try {
        const stat = await fsPromises.stat(fullPath);
        
        return {
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          size: item.isFile() ? stat.size : 0,
          modified: stat.mtime,
          path: fullPath
        };
      } catch (statError) {
        // 如果无法获取文件信息，返回基本数据
        return {
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          size: 0,
          modified: new Date(),
          path: fullPath
        };
      }
    }));
    
    res.json({
      success: true,
      path: targetPath,
      items: formattedItems
    });
  } catch (error) {
    console.error('读取目录失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '读取目录失败: ' + error.message 
    });
  }
});

// 添加获取系统根目录的API
app.get('/api/filesystem/root', authenticateToken, (req, res) => {
  try {
    // 根据平台返回更合适的根目录
    // macOS (darwin) 上将根目录设为 '/'，以便可以访问主硬盘 (例如 Macintosh HD)
    // Windows 上使用 C:\ 作为默认根
    // 其他平台默认使用 / (可以根据需要调整为 /Volumes)
    let rootDir;
    if (process.platform === 'darwin') {
      rootDir = '/';
    } else if (process.platform === 'win32') {
      rootDir = 'C:\\';
    } else {
      rootDir = '/';
    }
    console.log('返回根目录:', rootDir);
    
    res.json({
      success: true,
      homeDir: rootDir,
      platform: process.platform
    });
  } catch (error) {
    console.error('获取系统信息失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取系统信息失败: ' + error.message 
    });
  }
});

// 添加获取系统磁盘列表的API
app.get('/api/filesystem/disks', authenticateToken, async (req, res) => {
  try {
    console.log('获取磁盘列表请求');
    const drivelist = require('drivelist');
    const drives = await drivelist.list();
    
    console.log('原始磁盘信息:', JSON.stringify(drives, null, 2));
    
    // 格式化磁盘信息
    const formattedDrives = drives.map(drive => {
      // 获取挂载点（如果有多个，取第一个）
      const mountPoint = drive.mountpoints && drive.mountpoints.length > 0 
        ? drive.mountpoints[0].path 
        : null;
      
      // 确保挂载点路径格式正确（以斜杠结尾）
      const formattedMountPoint = mountPoint && !mountPoint.endsWith('/') 
        ? mountPoint + '/' 
        : mountPoint;
      
      return {
        device: drive.device,
        description: drive.description || drive.device,
        size: drive.size,
        mountPoint: formattedMountPoint,
        isSystem: drive.system || false,
        isProtected: drive.protected || false
      };
    }).filter(drive => drive.mountPoint); // 只返回有挂载点的磁盘
    
    console.log('格式化后的磁盘信息:', JSON.stringify(formattedDrives, null, 2));
    
    res.json({
      success: true,
      drives: formattedDrives
    });
  } catch (error) {
    console.error('获取磁盘信息失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取磁盘信息失败: ' + error.message 
    });
  }
});

// 添加获取服务器信息的API
app.get('/api/server-info', (req, res) => {
  try {
    const ip = getLocalIP();
    res.json({
      success: true,
      ip: ip
    });
  } catch (error) {
    console.error('获取服务器信息失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取服务器信息失败: ' + error.message 
    });
  }
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('🚨 [后端] 全局错误处理:', {
    name: err.name,
    message: err.message,
    code: err.code,
    status: err.status,
    type: err.type,
    url: req.url,
    method: req.method,
    headers: {
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    },
    stack: err.stack
  });

  // 处理请求体过大错误
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ 
      error: '请求体过大，文件可能超出服务器限制',
      details: err.message 
    });
  }

  // 处理Multer错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ 
      error: '文件大小超出限制',
      details: err.message 
    });
  }

  // 处理其他错误
  res.status(err.status || 500).json({ 
    error: err.message || '服务器内部错误',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
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