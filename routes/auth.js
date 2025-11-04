const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isUsingMemoryStorage, memoryUserOperations } = require('../config/database');

const router = express.Router();

// JWT密钥（生产环境应使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'wjairdrop_secret_key_2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 生成JWT令牌
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// 验证JWT令牌中间件
const authenticateToken = async (req, res, next) => {
  try {
    // 支持从 Authorization header 或 query 参数 token 获取 JWT
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token && req.query && req.query.token) {
      token = req.query.token;
      console.log('从 query.token 中获取令牌');
    }
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: '访问令牌缺失' 
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(`Token解码成功，用户ID: ${decoded.userId}`);
    
    let user;
    
    if (isUsingMemoryStorage()) {
      console.log('使用内存存储查找用户');
      user = await memoryUserOperations.findById(decoded.userId);
      console.log(`内存存储查找结果:`, user ? `找到用户 ${user.username}` : '用户不存在');
    } else {
      console.log('使用数据库查找用户');
      user = await User.findById(decoded.userId).select('-password');
    }
    
    if (!user) {
      console.log(`认证失败：用户ID ${decoded.userId} 不存在`);
      return res.status(401).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }
    
    console.log(`认证成功：用户 ${user.username}`);
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: '无效的访问令牌' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: '访问令牌已过期' 
      });
    }
    
    console.error('认证中间件错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '服务器内部错误' 
    });
  }
};

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // 输入验证
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码是必需的'
      });
    }
    
    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({
        success: false,
        message: '用户名长度必须在2-20个字符之间'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '密码至少需要6个字符'
      });
    }
    
    // 检查用户名格式
    const usernameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message: '用户名只能包含字母、数字、下划线和中文字符'
      });
    }
    
    let existingUser;
    
    if (isUsingMemoryStorage()) {
      // 使用内存存储
      existingUser = await memoryUserOperations.findByUsername(username);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: '用户名已存在'
        });
      }
      
      // 如果提供了邮箱，检查邮箱格式
      if (email) {
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            message: '邮箱格式不正确'
          });
        }
      }
      
      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // 创建新用户
      const user = await memoryUserOperations.create({
        username: username.trim(),
        password: hashedPassword,
        email: email ? email.trim().toLowerCase() : undefined,
        avatar: username.charAt(0).toUpperCase(),
        isOnline: false
      });
      
      // 生成JWT令牌
      const token = generateToken(user._id);
      
      res.status(201).json({
        success: true,
        message: '注册成功',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            isOnline: user.isOnline
          },
          token
        }
      });
    } else {
      // 使用MongoDB
      existingUser = await User.findByUsername(username);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: '用户名已存在'
        });
      }
      
      // 如果提供了邮箱，检查邮箱格式和唯一性
      if (email) {
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            message: '邮箱格式不正确'
          });
        }
        
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
          return res.status(409).json({
            success: false,
            message: '邮箱已被使用'
          });
        }
      }
      
      // 创建新用户
      const user = new User({
        username: username.trim(),
        password,
        email: email ? email.trim().toLowerCase() : undefined
      });
      
      await user.save();
      
      // 生成JWT令牌
      const token = generateToken(user._id);
      
      // 返回用户信息（不包含密码）
      const userProfile = user.getPublicProfile();
      
      res.status(201).json({
        success: true,
        message: '注册成功',
        data: {
          user: userProfile,
          token
        }
      });
    }
    
    console.log(`新用户注册: ${username}`);
    
  } catch (error) {
    console.error('注册错误:', error);
    
    // 处理MongoDB验证错误
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || '输入数据无效'
      });
    }
    
    // 处理重复键错误
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `${field === 'username' ? '用户名' : '邮箱'}已存在`
      });
    }
    
    res.status(500).json({
      success: false,
      message: '注册失败，请稍后重试'
    });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 输入验证
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码是必需的'
      });
    }
    
    let user;
    let isPasswordValid = false;
    
    if (isUsingMemoryStorage()) {
      // 使用内存存储
      user = await memoryUserOperations.findByUsername(username);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }
      
      // 验证密码
      isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }
      
      // 更新在线状态
      await memoryUserOperations.updateById(user._id, { isOnline: true });
      
    } else {
      // 使用MongoDB
      user = await User.findByUsername(username);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }
      
      // 验证密码
      isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }
    }
    
    // 生成JWT令牌
    const token = generateToken(user._id);
    
    // 更新用户在线状态
    if (isUsingMemoryStorage()) {
      await memoryUserOperations.updateById(user._id, { isOnline: true });
    } else {
      await User.findByIdAndUpdate(user._id, { isOnline: true });
    }
    
    console.log(`用户登录成功: ${user.username}, ID: ${user._id}`);
    console.log(`生成Token包含用户ID: ${user._id}`);
    
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          isOnline: true
        }
      }
    });
    
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试'
    });
  }
});

// 验证令牌
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    console.log('Token验证端点被调用');
    console.log('req.user:', req.user);
    
    // authenticateToken中间件已经验证了Token并设置了req.user
    // 直接使用req.user即可，无需再次查找
    const user = req.user;
    
    const userProfile = isUsingMemoryStorage() ? {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isOnline: user.isOnline
    } : user.getPublicProfile();
    
    console.log('Token验证成功，返回用户信息:', userProfile);
    
    res.json({
      success: true,
      message: '令牌有效',
      data: {
        user: userProfile
      }
    });
  } catch (error) {
    console.error('令牌验证错误:', error);
    res.status(500).json({
      success: false,
      message: '验证失败'
    });
  }
});

// 获取用户信息
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    let user;
    
    if (isUsingMemoryStorage()) {
      user = await memoryUserOperations.findById(req.user.userId);
    } else {
      user = await User.findById(req.user.userId).select('-password');
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    const userProfile = isUsingMemoryStorage() ? {
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      isOnline: user.isOnline
    } : user.getPublicProfile();
    
    res.json({
      success: true,
      data: {
        user: userProfile
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
});

// 更新用户信息
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    const user = req.user;
    
    // 更新邮箱
    if (email !== undefined) {
      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({
          success: false,
          message: '邮箱格式不正确'
        });
      }
      
      if (email && email !== user.email) {
        const existingEmail = await User.findOne({ email, _id: { $ne: user._id } });
        if (existingEmail) {
          return res.status(409).json({
            success: false,
            message: '邮箱已被使用'
          });
        }
      }
      
      user.email = email || undefined;
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: '用户信息更新成功',
      data: {
        user: user.getPublicProfile()
      }
    });
    
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '更新失败'
    });
  }
});

// 修改密码
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '当前密码和新密码是必需的'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码至少需要6个字符'
      });
    }
    
    const user = await User.findById(req.user._id);
    
    // 验证当前密码
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '当前密码错误'
      });
    }
    
    // 更新密码
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: '密码修改成功'
    });
    
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({
      success: false,
      message: '密码修改失败'
    });
  }
});

module.exports = {
  router,
  authenticateToken
};