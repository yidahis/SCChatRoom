import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import ChatScreen from './components/ChatScreen';
import FileBrowser from './components/FileBrowser';
import { io } from 'socket.io-client';

function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // 不在这里初始化socket，等登录后再连接
  }, []);

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
      }
    });
    
    setSocket(newSocket);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen('login');
    
    // 清除localStorage中的token
    localStorage.removeItem('token');
    
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  // 根据当前屏幕状态显示不同组件
  const renderContent = () => {
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