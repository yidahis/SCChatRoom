const mongoose = require('mongoose');

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wjairdrop';

// 连接选项
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // 5秒超时
    socketTimeoutMS: 45000, // 45秒socket超时
    maxPoolSize: 10, // 最大连接池大小
    bufferMaxEntries: 0, // 禁用mongoose缓冲
    bufferCommands: false, // 禁用mongoose缓冲命令
};

// 内存存储作为备选方案
let useMemoryStorage = false;
const memoryUsers = new Map();

// 连接数据库
const connectDB = async () => {
    try {
        console.log('正在连接MongoDB...');
        const conn = await mongoose.connect(MONGODB_URI, options);
        console.log(`MongoDB连接成功: ${conn.connection.host}`);
        useMemoryStorage = false;
        return conn;
    } catch (error) {
        console.error('MongoDB连接失败:', error.message);
        console.log('将使用内存存储作为备选方案');
        useMemoryStorage = true;
        return null;
    }
};

// 监听连接事件
mongoose.connection.on('connected', () => {
    console.log('Mongoose连接已建立');
    useMemoryStorage = false;
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose连接错误:', err);
    console.log('切换到内存存储模式');
    useMemoryStorage = true;
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose连接已断开');
    console.log('切换到内存存储模式');
    useMemoryStorage = true;
});

// 应用终止时关闭数据库连接
process.on('SIGINT', async () => {
    try {
        if (!useMemoryStorage) {
            await mongoose.connection.close();
            console.log('MongoDB连接已关闭');
        }
        process.exit(0);
    } catch (error) {
        console.error('关闭MongoDB连接时出错:', error);
        process.exit(1);
    }
});

// 检查连接状态
const isConnected = () => {
    return !useMemoryStorage && mongoose.connection.readyState === 1;
};

// 检查是否使用内存存储
const isUsingMemoryStorage = () => {
    return useMemoryStorage;
};

// 获取数据库统计信息
const getDBStats = async () => {
    try {
        if (useMemoryStorage) {
            return {
                storage: 'memory',
                users: memoryUsers.size,
                message: '使用内存存储模式'
            };
        }
        
        if (!isConnected()) {
            return { error: '数据库未连接' };
        }
        
        const stats = await mongoose.connection.db.stats();
        return {
            storage: 'mongodb',
            database: mongoose.connection.name,
            collections: stats.collections,
            dataSize: stats.dataSize,
            indexSize: stats.indexSize
        };
    } catch (error) {
        return { error: error.message };
    }
};

// 内存存储的用户操作
const memoryUserOperations = {
    async create(userData) {
        const id = Date.now().toString();
        const user = {
            _id: id,
            ...userData,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        memoryUsers.set(id, user);
        return user;
    },
    
    async findByUsername(username) {
        for (const user of memoryUsers.values()) {
            if (user.username === username) {
                return user;
            }
        }
        return null;
    },
    
    async findById(id) {
        return memoryUsers.get(id) || null;
    },
    
    async updateById(id, updateData) {
        const user = memoryUsers.get(id);
        if (user) {
            Object.assign(user, updateData, { updatedAt: new Date() });
            memoryUsers.set(id, user);
            return user;
        }
        return null;
    }
};

module.exports = {
    connectDB,
    isConnected,
    isUsingMemoryStorage,
    getDBStats,
    mongoose,
    memoryUserOperations
};