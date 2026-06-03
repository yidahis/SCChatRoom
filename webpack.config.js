const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: 'bundle.js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html'
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    host: '0.0.0.0', // 允许局域网访问
    port: 3001,
    hot: true,
    proxy: [
      {
        context: ['/socket.io'],
        target: 'http://localhost:3678',
        ws: true,
        changeOrigin: true,
        timeout: 2 * 60 * 60 * 1000 // 2小时超时
      },
      {
        context: ['/api'],
        target: 'http://localhost:3678',
        changeOrigin: true,
        timeout: 2 * 60 * 60 * 1000 // 2小时超时
      },
      {
        context: ['/uploads'],
        target: 'http://localhost:3678',
        changeOrigin: true,
        timeout: 2 * 60 * 60 * 1000 // 2小时超时
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  }
};