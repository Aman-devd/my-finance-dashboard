import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { StoreProvider } from './lib/store'
import { AuthProvider } from './lib/auth'
import ErrorBoundary from './components/ErrorBoundary'

// 自动更新：检测到服务器有新构建时自动刷新一次，避免旧版本页面互相覆盖数据
let versionReloaded = false
function checkVersionUpdate() {
  if (versionReloaded) return
  try {
    if (document.querySelector('.fixed.inset-0')) return // 有弹窗时暂不刷新，避免打断操作
    const ae = document.activeElement
    if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return // 正在输入时暂不刷新
    fetch('./version.json?b=' + encodeURIComponent(__BUILD_TS__), { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (String(j?.v) && String(j.v) !== String(__BUILD_TS__)) {
          versionReloaded = true
          window.location.reload()
        }
      })
      .catch(() => { /* 离线或版本文件缺失时忽略 */ })
  } catch { /* ignore */ }
}
setTimeout(checkVersionUpdate, 1500)
window.addEventListener('focus', checkVersionUpdate)
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkVersionUpdate() })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <StoreProvider>
            <App />
          </StoreProvider>
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
