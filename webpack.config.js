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
        target: 'http://0.0.0.0:3678',
        ws: true
      },
      {
        context: ['/api'],
        target: 'http://0.0.0.0:3678'
      },
      {
        context: ['/uploads'],
        target: 'http://0.0.0.0:3678'
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  }
};