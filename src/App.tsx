import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import { useAuth } from './lib/auth'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const AddTransaction = lazy(() => import('./pages/AddTransaction'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Markets = lazy(() => import('./pages/Markets'))
const Holdings = lazy(() => import('./pages/Holdings'))
const Gains = lazy(() => import('./pages/Gains'))
const Annual = lazy(() => import('./pages/Annual'))
const People = lazy(() => import('./pages/People'))
const Borrow = lazy(() => import('./pages/Borrow'))
const Cars = lazy(() => import('./pages/Cars'))
const Reminders = lazy(() => import('./pages/Reminders'))
const Tools = lazy(() => import('./pages/Tools'))
const Vault = lazy(() => import('./pages/Vault'))
const More = lazy(() => import('./pages/More'))

function Fallback() {
  return (
    <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400">
      <div className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-blue-600 animate-spin" />
      <div className="text-xs">加载中…</div>
    </div>
  )
}

export default function App() {
  const { user, ready } = useAuth()
  if (!ready) {
    return <div className="min-h-full bg-[#f2f2f7] grid place-items-center"><div className="w-12 h-12 rounded-[1.4rem] bg-blue-600 animate-pulse" /></div>
  }
  if (!user) return <Login />
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add" element={<AddTransaction />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/holdings" element={<Holdings />} />
          <Route path="/gains" element={<Gains />} />
          <Route path="/annual" element={<Annual />} />
          <Route path="/people" element={<People />} />
          <Route path="/borrow" element={<Borrow />} />
          <Route path="/cars" element={<Cars />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/more" element={<More />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

