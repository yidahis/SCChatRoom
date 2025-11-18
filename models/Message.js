const mongoose = require('mongoose');

// 消息模型定义
const messageSchema = new mongoose.Schema({
  user: {
    id: mongoose.Schema.Types.ObjectId,
    username: String,
    avatar: String
  },
  content: String,
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  imageUrl: String,
  fileUrl: String,
  filename: String,
  originalName: String,
  size: Number,
  mimetype: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// 创建索引以优化查询性能
messageSchema.index({ timestamp: -1 });
messageSchema.index({ 'user.id': 1 });
messageSchema.index({ type: 1 });

module.exports = mongoose.model('Message', messageSchema);
