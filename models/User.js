const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 用户模式定义
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, '用户名是必需的'],
    unique: true,
    trim: true,
    minlength: [2, '用户名至少需要2个字符'],
    maxlength: [20, '用户名不能超过20个字符'],
    match: [/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线和中文字符']
  },
  password: {
    type: String,
    required: [true, '密码是必需的'],
    minlength: [6, '密码至少需要6个字符']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, '请输入有效的邮箱地址']
  },
  avatar: {
    type: String,
    default: function() {
      // 生成默认头像（使用用户名首字母）
      return this.username ? this.username.charAt(0).toUpperCase() : 'U';
    }
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  socketId: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// 密码加密中间件
userSchema.pre('save', async function(next) {
  // 只有密码被修改时才加密
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // 生成盐值并加密密码
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 密码验证方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('密码验证失败');
  }
};

// 获取用户公开信息（不包含密码）
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    joinDate: this.joinDate
  };
};

// 更新在线状态
userSchema.methods.updateOnlineStatus = function(isOnline, socketId = null) {
  this.isOnline = isOnline;
  this.socketId = socketId;
  if (!isOnline) {
    this.lastSeen = new Date();
  }
  return this.save();
};

// 静态方法：查找在线用户
userSchema.statics.findOnlineUsers = function() {
  return this.find({ isOnline: true }).select('username avatar isOnline');
};

// 静态方法：通过用户名查找用户
userSchema.statics.findByUsername = function(username) {
  return this.findOne({ username: new RegExp(`^${username}$`, 'i') });
};

// 索引优化
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ isOnline: 1 });

module.exports = mongoose.model('User', userSchema);