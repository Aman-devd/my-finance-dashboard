import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { useAuth } from '../lib/auth'
import { Button, Card, PageHead, Tag } from '../components/ui'
import { Home, Wallet, List, TrendingUp, Users, Car, Calculator, Bell, Settings, Database, Download, Upload, Sparkles, Trash2, Coins, History, Plus, Cloud, HardDrive } from 'lucide-react'
import { NAV } from '../components/Layout'

export default function More() {
  const { data, loadDemo, clearAll, importData, history, backupNow, restoreHistory, deleteHistory, cloudSnapshots, cloudSnapshotsLoading, refreshCloudSnapshots, restoreCloudSnapshot, deleteCloudSnapshot } = useApp()
  const { user, cloud, logout } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [histTab, setHistTab] = useState<'local' | 'cloud'>('local')

  useEffect(() => { if (cloud) refreshCloudSnapshots() }, [cloud])

  const counts = [
    { label: '账户', n: data.accounts.length },
    { label: '本月账单', n: data.transactions.filter((t) => t.date.startsWith(dayjs().format('YYYY-MM'))).length },
    { label: '亲友', n: data.people.length },
    { label: '随礼记录', n: data.gifts.length },
    { label: '车辆', n: data.cars.length },
    { label: '持仓', n: data.holdings.length },
  ]

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-backup-${dayjs().format('YYYYMMDD-HHmm')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJson(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const d = JSON.parse(String(reader.result))
        if (d && (d.version === 1 || d.version === 2) && Array.isArray(d.accounts) && d.settings) {
          importData(d)
          alert('导入成功')
        } else alert('文件格式不正确')
      } catch {
        alert('读取文件失败')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto w-full">
      <PageHead title="我的" sub="数据管理 · 各功能入口" />
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white grid place-items-center text-lg font-bold uppercase">{user?.username?.slice(0, 1)}</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">账号：{user?.username}</div>
            <div className="text-[11px] text-slate-400 truncate">{user?.email || '未绑定邮箱'}{user?.email ? '' : ' · 建议绑定邮箱用于找回密码'}</div>
          </div>
          <button onClick={() => { if (window.confirm('确定退出登录吗？')) logout() }} className="text-xs bg-slate-100 text-slate-600 rounded-xl px-3 py-2 hover:bg-slate-200">退出登录</button>
        </div>
        <div className="text-[10px] text-slate-400 mt-2">登录后 90 天免登录（偶尔打开会自动续期）· {cloud ? '已开启云端多设备同步' : '当前为本地演示登录（账号保存在本机浏览器）'}</div>
      </Card>


      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white grid place-items-center"><Coins size={20} /></div>
          <div>
            <div className="font-semibold">{cloud ? '云端同步' : '本地演示模式'}</div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1"><Sparkles size={11} /> {cloud ? '手机 / 平板 / 电脑登录同一账号，数据实时同步' : '数据存于本机浏览器，登录同一账号后多设备同步'}</div>
          </div>
          <Tag tone={cloud ? 'blue' : 'amber'}>{cloud ? '已同步' : '演示'}</Tag>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {counts.map((c) => <div key={c.label} className="rounded-xl bg-slate-50 p-2 text-center"><div className="text-base font-bold num">{c.n}</div><div className="text-[10px] text-slate-400">{c.label}</div></div>)}
        </div>
      </Card>

      <Card className="p-2">
        {NAV.filter((n) => n.to !== '/more').map((n) => (
          <Link key={n.to} to={n.to} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm hover:bg-slate-50">
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 grid place-items-center"><n.icon size={16} /></span>
            <span className="flex-1 font-medium">{n.label}</span>
            
          </Link>
        ))}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold flex items-center gap-1.5"><Database size={15} className="text-slate-500" /> 数据管理</div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={exportJson}><Download size={15} /> 导出备份</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload size={15} /> 导入数据</Button>
          <Button variant="soft" onClick={() => { if (window.confirm('将用一套演示数据覆盖当前内容，继续？')) loadDemo() }}><Sparkles size={15} /> 载入演示数据</Button>
          <Button variant="danger" onClick={() => { if (window.confirm('确定清空全部数据？建议先导出备份。')) clearAll() }}><Trash2 size={15} /> 清空全部</Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = '' }} />
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="text-sm font-semibold flex items-center gap-1.5"><History size={15} className="text-slate-500" /> 历史备份与恢复</div>
          <Button variant="ghost" className="!px-2.5 !py-1.5 text-xs shrink-0" onClick={() => { backupNow('手动存档'); alert('已保存一份当前数据') }}><Plus size={14} /> 立即存一份</Button>
        </div>
        <p className="text-[11px] text-slate-400 leading-4 mb-2">清空、载入演示、导入数据前会自动先存一份；可随时一键恢复。</p>
        {cloud && (
          <div className="flex gap-1 mb-2 p-0.5 bg-slate-100 rounded-xl">
            <button onClick={() => setHistTab('local')} className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg transition ${histTab === 'local' ? 'bg-white text-slate-700 shadow-sm font-medium' : 'text-slate-400'}`}><HardDrive size={12} /> 本机（{history.length}）</button>
            <button onClick={() => setHistTab('cloud')} className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg transition ${histTab === 'cloud' ? 'bg-white text-slate-700 shadow-sm font-medium' : 'text-slate-400'}`}><Cloud size={12} /> 云端（{cloudSnapshots.length}）</button>
          </div>
        )}
        {histTab === 'local' ? (
          history.length === 0 ? (
            <div className="text-xs text-slate-300 py-3">还没有备份记录。</div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-72 overflow-auto">
              {history.map((h) => (
                <div key={h.at} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{dayjs(h.at).format('M月D日 HH:mm')} · {h.reason}</div>
                    <div className="text-[11px] text-slate-400 num">{h.data.accounts.length} 账户 · {h.data.transactions.length} 笔账单 · {h.data.people.length} 亲友</div>
                  </div>
                  <button onClick={() => { if (window.confirm('恢复这份备份会覆盖当前数据（会自动先存一份当前状态），继续？')) restoreHistory(h.at) }} className="text-xs text-blue-600 shrink-0">恢复</button>
                  <button onClick={() => deleteHistory(h.at)} className="text-xs text-slate-300 hover:text-red-400 shrink-0">删除</button>
                </div>
              ))}
            </div>
          )
        ) : (
          cloudSnapshotsLoading ? (
            <div className="text-xs text-slate-300 py-3">加载云端备份中…</div>
          ) : cloudSnapshots.length === 0 ? (
            <div className="text-xs text-slate-300 py-3">云端还没有备份记录。执行清空/载入演示/导入或点"立即存一份"后会自动同步到云端。</div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-72 overflow-auto">
              {cloudSnapshots.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{dayjs(s.createdAt).format('M月D日 HH:mm')} · {s.reason || '云端备份'}</div>
                    <div className="text-[11px] text-slate-400 num">{s.data.accounts.length} 账户 · {s.data.transactions.length} 笔账单 · {s.data.people.length} 亲友</div>
                  </div>
                  <button onClick={async () => { if (window.confirm('恢复这份云端备份会覆盖当前数据（会自动先存一份当前状态），继续？')) await restoreCloudSnapshot(s.id) }} className="text-xs text-blue-600 shrink-0">恢复</button>
                  <button onClick={() => deleteCloudSnapshot(s.id)} className="text-xs text-slate-300 hover:text-red-400 shrink-0">删除</button>
                </div>
              ))}
            </div>
          )
        )}
      </Card>
      <Card className="p-4 text-xs text-slate-400 leading-5">
        <div className="font-semibold text-slate-500 mb-1">关于</div>
        版本 v3.2（2026-09-09）。数据已在手机 / 平板 / 电脑间自动同步；新增云端历史备份，多设备可查看并恢复；美股四大指数已接入真实分时数据（交易时段）。<br />
        功能仍在讨论与打磨中，UI 会继续优化。
      </Card>
    </div>
  )
}





