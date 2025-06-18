import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import ChatScreen from './components/ChatScreen';
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
    const serverUrl = window.location.protocol + '//' + window.location.hostname + ':3000';
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

  return (
    <div className="app">
      {currentScreen === 'login' ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <ChatScreen 
          currentUser={currentUser} 
          socket={socket} 
          onLogout={handleLogout} 
        />
      )}
    </div>
  );
}

export default App;