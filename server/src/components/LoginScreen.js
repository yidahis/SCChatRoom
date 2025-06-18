import React, { useState } from 'react';

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }

    if (username.trim().length < 2) {
      setError('用户名至少需要2个字符');
      return;
    }

    if (username.trim().length > 20) {
      setError('用户名不能超过20个字符');
      return;
    }

    // 检查用户名格式
    const usernameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/;
    if (!usernameRegex.test(username.trim())) {
      setError('用户名只能包含字母、数字、下划线和中文字符');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 调用登录API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: 'default_password' // 临时密码，实际应用中需要密码输入
        })
      });

      const data = await response.json();

      if (data.success) {
        // 登录成功，传递用户信息和token
        onLogin({
          username: data.data.user.username,
          token: data.data.token,
          user: data.data.user
        });
      } else {
        // 如果用户不存在，尝试注册
        if (data.message.includes('用户名或密码错误')) {
          const registerResponse = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: username.trim(),
              password: 'default_password'
            })
          });

          const registerData = await registerResponse.json();
          
          if (registerData.success) {
            onLogin({
              username: registerData.data.user.username,
              token: registerData.data.token,
              user: registerData.data.user
            });
          } else {
            setError(registerData.message || '注册失败，请重试');
          }
        } else {
          setError(data.message || '登录失败，请重试');
        }
      }
    } catch (error) {
      console.error('登录错误:', error);
      setError('网络错误，请检查连接');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <div className="logo">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1>WJAirDrop</h1>
          <p>局域网即时通讯</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              maxLength="20"
              autoComplete="off"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="error-message">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="spinner"></div>
                登录中...
              </>
            ) : (
              '进入聊天室'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>输入用户名即可开始聊天</p>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;