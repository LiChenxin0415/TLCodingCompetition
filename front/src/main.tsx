/**
 * 应用入口
 * 需求依据：UI 设计令牌 —— 主色 #2F54EB、圆角 8px、背景 #F5F7FA
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('找不到 #root 挂载节点');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2F54EB',
          borderRadius: 8,
          colorBgLayout: '#F5F7FA',
        },
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
);
