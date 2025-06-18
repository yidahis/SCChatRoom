// 全局变量
let socket;
let currentUser = null;
let isConnected = false;
let onlineUsers = new Map();
let authToken = localStorage.getItem('authToken');

// DOM 元素
const authScreen = document.getElementById('authScreen');
const chatScreen = document.getElementById('chatScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginFormElement = document.getElementById('loginFormElement');
const registerFormElement = document.getElementById('registerFormElement');
const showRegisterBtn = document.getElementById('showRegister');
const showLoginBtn = document.getElementById('showLogin');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const messagesContainer = document.getElementById('messages');
const usersList = document.getElementById('usersList');
const userCount = document.getElementById('userCount');
const toggleUsersBtn = document.getElementById('toggleUsers');
const usersSidebar = document.getElementById('usersSidebar');
const connectionIndicator = document.getElementById('connectionIndicator');
const connectionText = document.getElementById('connectionText');
const currentUserAvatar = document.getElementById('currentUserAvatar');
const currentUsername = document.getElementById('currentUsername');
const logoutBtn = document.getElementById('logoutBtn');
const closeSidebarBtn = document.getElementById('closeSidebar');
const messageForm = document.getElementById('messageForm');
const sendBtn = document.getElementById('sendBtn');
const messagesList = document.getElementById('messagesList');
const errorToast = document.getElementById('errorToast');
const successToast = document.getElementById('successToast');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');

// 初始化应用
function initApp() {
    // 这个函数保留用于兼容性，但不执行任何操作
    // 实际的初始化逻辑已移到DOMContentLoaded事件中
}

// Socket连接管理
function initializeSocket() {
    updateConnectionStatus('connecting', '连接中...');
    connectSocket();
}

function connectSocket() {
    if (socket) {
        socket.disconnect();
    }
    
    console.log('开始连接Socket，authToken:', authToken ? '已设置' : '未设置');
    
    const socketOptions = {};
    if (authToken) {
        socketOptions.auth = {
            token: authToken
        };
        console.log('使用Token认证连接');
    } else {
        console.warn('警告：没有authToken，可能导致认证失败');
    }
    
    socket = io(socketOptions);
    
    // 连接成功
    socket.on('connect', () => {
        console.log('Socket连接成功');
        isConnected = true;
        updateConnectionStatus('connected', '已连接');
        if (messageInput) messageInput.focus();
    });
    
    // 连接断开
    socket.on('disconnect', (reason) => {
        console.log('Socket连接断开，原因:', reason);
        isConnected = false;
        updateConnectionStatus('disconnected', '连接断开');
        onlineUsers.clear();
        updateUsersList();
        
        // 只有在意外断开时才显示错误提示
        if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'transport error') {
            showError('与服务器连接断开，请刷新页面重试');
        }
    });
    
    // 连接错误
    socket.on('connect_error', (error) => {
        console.error('Socket连接错误:', error);
        updateConnectionStatus('error', '连接失败');
        if (error.message === 'Authentication error') {
            showError('认证失败，请重新登录');
            handleLogout();
        } else {
            showError('连接服务器失败，请检查网络');
        }
    });
    
    // 用户加入
    socket.on('userJoined', (data) => {
        console.log('用户加入:', data);
        addMessage({
            type: 'system',
            content: `${data.user.username} 加入了聊天室`,
            timestamp: new Date()
        });
    });
    
    // 用户离开
    socket.on('userLeft', (data) => {
        console.log('用户离开:', data);
        addMessage({
            type: 'system',
            content: `${data.user.username} 离开了聊天室`,
            timestamp: new Date()
        });
    });
    
    // 接收消息
    socket.on('message', (data) => {
        console.log('收到消息:', data);
        addMessage(data);
    });
    
    // 更新用户列表
    socket.on('usersList', (users) => {
        console.log('用户列表更新:', users);
        onlineUsers.clear();
        users.forEach(user => {
            onlineUsers.set(user.id, user);
        });
        updateUsersList();
    });
    
    // 监听服务器事件
    setupSocketListeners();
}

// 连接到服务器（旧版本，保留用于兼容性）
function connectToServer() {
    // 这个函数已被connectSocket()替代
    console.log('connectToServer() 已弃用，请使用 connectSocket()');
}

// 设置Socket事件监听器
function setupSocketListeners() {
    // 加入成功
    socket.on('joined', (data) => {
        currentUser = data.username;
        showChatScreen();
        showSuccess(data.message);
        addSystemMessage(`欢迎 ${data.username}！`);
    });
    
    // 新用户加入
    socket.on('user_joined', (data) => {
        addSystemMessage(data.message);
    });
    
    // 用户离开
    socket.on('user_left', (data) => {
        addSystemMessage(data.message);
    });
    
    // 新消息
    socket.on('new_message', (data) => {
        addMessage(data);
    });
    
    // 用户列表更新
    socket.on('users_update', (users) => {
        updateUsersList(users);
        updateUserCount(users.length);
    });
    
    // 错误处理
    socket.on('error', (message) => {
        showError(message);
    });
}

// 绑定事件监听器
function bindEventListeners() {
    // 登录表单提交
    loginForm.addEventListener('submit', handleLogin);
    
    // 消息表单提交
    messageForm.addEventListener('submit', handleSendMessage);
    
    // 消息输入框变化
    messageInput.addEventListener('input', handleMessageInputChange);
    messageInput.addEventListener('keypress', handleMessageKeyPress);
    
    // 用户侧边栏切换
    toggleUsersBtn.addEventListener('click', toggleUsersSidebar);
    closeSidebarBtn.addEventListener('click', closeUsersSidebar);
    
    // 点击侧边栏外部关闭
    document.addEventListener('click', (e) => {
        if (usersSidebar.classList.contains('open') && 
            !usersSidebar.contains(e.target) && 
            !toggleUsersBtn.contains(e.target)) {
            closeUsersSidebar();
        }
    });
    
    // 阻止表单默认提交
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (e) => e.preventDefault());
    });
}

// 认证相关函数
function showAuthScreen() {
    if (authScreen) {
        authScreen.style.display = 'flex';
        authScreen.classList.remove('hidden');
    }
    if (chatScreen) {
        chatScreen.style.display = 'none';
        chatScreen.classList.add('hidden');
    }
}

function showLoginForm() {
    if (loginForm) loginForm.classList.add('active');
    if (registerForm) registerForm.classList.remove('active');
}

function showRegisterForm() {
    if (registerForm) registerForm.classList.add('active');
    if (loginForm) loginForm.classList.remove('active');
}

// 验证Token
async function verifyToken() {
    try {
        const response = await fetch('/api/auth/verify', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                currentUser = data.data.user;
                updateUserProfile();
                showChatScreen();
                initializeSocket();
            } else {
                localStorage.removeItem('authToken');
                authToken = null;
                showAuthScreen();
            }
        } else {
            localStorage.removeItem('authToken');
            authToken = null;
            showAuthScreen();
        }
    } catch (error) {
        console.error('Token验证失败:', error);
        localStorage.removeItem('authToken');
        authToken = null;
        showAuthScreen();
    }
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    // 如果是新的认证系统
    if (document.getElementById('loginUsername')) {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!username || !password) {
            showError('请填写完整的登录信息');
            return;
        }
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success && data.data) {
                authToken = data.data.token;
                localStorage.setItem('authToken', authToken);
                currentUser = data.data.user;
                updateUserProfile();
                showSuccess('登录成功！');
                showChatScreen();
                // 确保token设置后再连接Socket
                setTimeout(() => {
                    initializeSocket();
                }, 100);
            } else {
                showError(data.message || '登录失败');
            }
        } catch (error) {
            console.error('登录错误:', error);
            showError('网络错误，请稍后重试');
        }
    } else {
        // 保持原有的简单登录逻辑
        const username = usernameInput.value.trim();
        
        if (!username) {
            showError('请输入用户名');
            usernameInput.focus();
            return;
        }
        
        if (username.length > 20) {
            showError('用户名不能超过20个字符');
            usernameInput.focus();
            return;
        }
        
        if (!isConnected) {
            showError('未连接到服务器，请稍后重试');
            return;
        }
        
        // 发送加入请求
        socket.emit('join', username);
    }
}

// 处理注册
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const email = document.getElementById('registerEmail').value.trim();
    
    if (!username || !password || !confirmPassword) {
        showError('请填写完整的注册信息');
        return;
    }
    
    if (password !== confirmPassword) {
        showError('两次输入的密码不一致');
        return;
    }
    
    if (password.length < 6) {
        showError('密码长度至少6个字符');
        return;
    }
    
    if (username.length < 2 || username.length > 20) {
        showError('用户名长度应在2-20个字符之间');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('注册成功！请登录');
            showLoginForm();
            // 清空注册表单
            if (registerFormElement) registerFormElement.reset();
        } else {
            showError(data.message || '注册失败');
        }
    } catch (error) {
        console.error('注册错误:', error);
        showError('网络错误，请稍后重试');
    }
}

// 处理登出
function handleLogout() {
    if (socket) {
        socket.disconnect();
    }
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    onlineUsers.clear();
    showAuthScreen();
    showSuccess('已安全退出');
}

// 更新用户资料显示
function updateUserProfile() {
    if (currentUser) {
        if (currentUserAvatar) currentUserAvatar.textContent = currentUser.avatar || currentUser.username.charAt(0).toUpperCase();
        if (currentUsername) currentUsername.textContent = currentUser.username;
    }
}

// 发送消息函数
function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) {
        return;
    }
    
    if (message.length > 500) {
        showError('消息不能超过500个字符');
        return;
    }
    
    if (!isConnected) {
        showError('未连接到服务器');
        return;
    }
    
    // 发送消息
    socket.emit('send_message', { message });
    
    // 清空输入框
    messageInput.value = '';
    if (typeof updateSendButton === 'function') updateSendButton();
    messageInput.focus();
}

// 处理发送消息
function handleSendMessage(e) {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    
    if (!message) {
        return;
    }
    
    if (message.length > 500) {
        showError('消息不能超过500个字符');
        return;
    }
    
    if (!isConnected) {
        showError('未连接到服务器');
        return;
    }
    
    // 发送消息
    socket.emit('send_message', { message });
    
    // 清空输入框
    messageInput.value = '';
    updateSendButton();
    messageInput.focus();
}

// 处理消息输入变化
function handleMessageInputChange() {
    updateSendButton();
}

// 处理消息输入按键
function handleMessageKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(e);
    }
}

// 更新发送按钮状态
function updateSendButton() {
    const hasText = messageInput.value.trim().length > 0;
    sendBtn.disabled = !hasText || !isConnected;
}

// 显示聊天界面
function showChatScreen() {
    if (authScreen) {
        authScreen.style.display = 'none';
        authScreen.classList.add('hidden');
    }
    if (chatScreen) {
        chatScreen.style.display = 'block';
        chatScreen.classList.remove('hidden');
    }
    if (messageInput) messageInput.focus();
}

// 添加消息到聊天列表
function addMessage(data) {
    const messageElement = createMessageElement(data);
    messagesList.appendChild(messageElement);
    scrollToBottom();
}

// 添加系统消息
function addSystemMessage(text) {
    const messageData = {
        type: 'system',
        message: text,
        timestamp: new Date().toLocaleTimeString()
    };
    const messageElement = createMessageElement(messageData);
    messagesList.appendChild(messageElement);
    scrollToBottom();
}

// 创建消息元素
function createMessageElement(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.type || 'user'}`;
    
    if (data.type === 'system') {
        messageDiv.innerHTML = `
            <div class="message-content">
                ${escapeHtml(data.message)}
            </div>
        `;
    } else {
        // 处理服务器发送的消息数据结构
        const username = data.user ? data.user.username : data.username;
        const messageText = data.content || data.message;
        const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : data.timestamp;
        
        const isOwnMessage = currentUser && username === currentUser.username;
        messageDiv.innerHTML = `
            <div class="message-content ${isOwnMessage ? 'own' : ''}">
                <div class="message-header">
                    <span class="message-username">${escapeHtml(username)}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-text">${escapeHtml(messageText)}</div>
            </div>
        `;
    }
    
    return messageDiv;
}

// 更新用户列表
function updateUsersList(users) {
    usersList.innerHTML = '';
    
    users.forEach(username => {
        const userElement = document.createElement('div');
        userElement.className = 'user-item';
        
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.textContent = username.charAt(0).toUpperCase();
        
        const name = document.createElement('div');
        name.className = 'user-name';
        name.textContent = username;
        
        userElement.appendChild(avatar);
        userElement.appendChild(name);
        usersList.appendChild(userElement);
    });
}

// 更新用户数量
function updateUserCount(count) {
    userCount.textContent = `${count} 人在线`;
}

// 切换用户侧边栏
function toggleUsersSidebar() {
    usersSidebar.classList.toggle('open');
}

// 关闭用户侧边栏
function closeUsersSidebar() {
    usersSidebar.classList.remove('open');
}

// 滚动到底部
function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// 更新连接状态
function updateConnectionStatus(status, text) {
    connectionIndicator.className = `status-indicator ${status}`;
    connectionText.textContent = text;
}

// 显示错误提示
function showError(message) {
    errorMessage.textContent = message;
    errorToast.classList.add('show');
    
    setTimeout(() => {
        errorToast.classList.remove('show');
    }, 4000);
}

// 显示成功提示
function showSuccess(message) {
    successMessage.textContent = message;
    successToast.classList.add('show');
    
    setTimeout(() => {
        successToast.classList.remove('show');
    }, 3000);
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 添加按钮点击波纹效果
function addRippleEffect(button, event) {
    const ripple = button.querySelector('.btn-ripple');
    if (!ripple) return;
    
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    
    ripple.style.animation = 'none';
    ripple.offsetHeight; // 触发重排
    ripple.style.animation = 'ripple 0.6s linear';
}

// 为按钮添加波纹效果
document.addEventListener('click', (e) => {
    if (e.target.closest('.join-btn')) {
        addRippleEffect(e.target.closest('.join-btn'), e);
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否已登录
    if (authToken) {
        verifyToken();
    } else {
        showAuthScreen();
    }
    
    // 绑定认证事件
    if (loginFormElement) loginFormElement.addEventListener('submit', handleLogin);
    if (registerFormElement) registerFormElement.addEventListener('submit', handleRegister);
    if (showRegisterBtn) showRegisterBtn.addEventListener('click', showRegisterForm);
    if (showLoginBtn) showLoginBtn.addEventListener('click', showLoginForm);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    
    // 绑定聊天事件
    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (toggleUsersBtn) toggleUsersBtn.addEventListener('click', toggleUsersSidebar);
    
    // 点击侧边栏外部关闭
    document.addEventListener('click', function(e) {
        if (usersSidebar && !usersSidebar.contains(e.target) && !toggleUsersBtn.contains(e.target)) {
            usersSidebar.classList.remove('active');
        }
    });
    
    // 保持原有的初始化逻辑
    initApp();
});

// 页面卸载时断开连接
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.disconnect();
    }
});

// 处理页面可见性变化
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !isConnected) {
        // 页面重新可见且未连接时尝试重连
        setTimeout(() => {
            if (!isConnected) {
                location.reload();
            }
        }, 1000);
    }
});

// 添加键盘快捷键支持
document.addEventListener('keydown', (e) => {
    // Esc键关闭侧边栏
    if (e.key === 'Escape') {
        closeUsersSidebar();
    }
    
    // Ctrl/Cmd + Enter 发送消息
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (messageInput.value.trim()) {
            handleSendMessage(e);
        }
    }
});

// 防止页面缩放
document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
});

// 优化移动端体验
if ('ontouchstart' in window) {
    // 移动端优化
    document.body.style.webkitUserSelect = 'none';
    document.body.style.webkitTouchCallout = 'none';
    
    // 防止双击缩放
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}