import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import ChatScreen from './components/ChatScreen';
import FileBrowser from './components/FileBrowser';
import { io } from 'socket.io-client';

function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // 添加检查状态

  useEffect(() => {
    // 页面加载时检查是否已登录（通过Cookie）
    checkAutoLogin();
  }, []);

  // 检查自动登录
  const checkAutoLogin = async () => {
    try {
      console.log('🔍 检查自动登录状态...');
      
      // 尝试从服务器验证token（通过Cookie）
      const response = await fetch('/api/auth/verify', {
        method: 'GET',
        credentials: 'include' // 重要：允许发送Cookie
      });
      
      const data = await response.json();
      console.log('验证响应:', data);
      
      if (data.success && data.data.user) {
        console.log('✅ 自动登录成功:', data.data.user.username);
        
        // 获取token（优先从localStorage）
        let token = localStorage.getItem('token');
        
        // 如果localStorage中没有token，从Cookie中获取（通过再次请求）
        // 由于HttpOnly Cookie前端无法直接读取，我们需要让Socket.IO也使用Cookie认证
        if (!token) {
          console.log('⚠️ localStorage中无token，将使用Cookie进行Socket认证');
          // 不设置token，让Socket.IO使用withCredentials自动携带Cookie
        }
        
        // 设置用户状态
        setCurrentUser(data.data.user);
        setCurrentScreen('chat');
        
        // 连接Socket.IO
        const serverUrl = window.location.protocol + '//' + window.location.hostname + ':3678';
        const socketConfig = {
          withCredentials: true // 允许携带Cookie
        };
        
        // 如果有token，优先使用token认证
        if (token) {
          socketConfig.auth = { token };
          console.log('使用localStorage中的token进行Socket认证');
        } else {
          console.log('使用Cookie进行Socket认证');
        }
        
        const newSocket = io(serverUrl, socketConfig);
        
        setSocket(newSocket);
        console.log('✅ Socket连接已建立');
      } else {
        console.log('❌ 自动登录失败，显示登录页面');
        console.log('验证响应数据:', data);
      }
    } catch (error) {
      console.error('自动登录检查错误:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = (loginData) => {
    // loginData包含 { username, token, user }
    setCurrentUser(loginData.user);
    setCurrentScreen('chat');
    
    // 存储token到localStorage
    localStorage.setItem('token', loginData.token);
    
    // 用token连接Socket.IO - 动态获取服务器地址
    const serverUrl = window.location.protocol + '//' + window.location.hostname + ':3678';
    const newSocket = io(serverUrl, {
      auth: {
        token: loginData.token
      },
      withCredentials: true
    });
    
    setSocket(newSocket);
  };

  const handleLogout = async () => {
    try {
      // 调用后端登出接口清除Cookie
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include' // 重要：允许发送Cookie
      });
      
      console.log('✅ 登出成功，Cookie已清除');
    } catch (error) {
      console.error('登出请求失败:', error);
    } finally {
      // 无论后端请求是否成功，都清除前端状态
      setCurrentUser(null);
      setCurrentScreen('login');
      
      // 清除localStorage中的token
      localStorage.removeItem('token');
      
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  };

  // 根据当前屏幕状态显示不同组件
  const renderContent = () => {
    // 如果正在检查自动登录状态，显示加载提示
    if (isCheckingAuth) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#666'
        }}>
          <div>正在检查登录状态...</div>
        </div>
      );
    }
    
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} />;
      case 'chat':
        return (
          <ChatScreen 
            currentUser={currentUser} 
            socket={socket} 
            onLogout={handleLogout} 
          />
        );
      case 'file-browser':
        return <FileBrowser currentUser={currentUser} onLogout={handleLogout} />;
      default:
        return <LoginScreen onLogin={handleLogin} />;
    }
  };

  return (
    <div className="app">
      {renderContent()}
    </div>
  );
}

export default App;