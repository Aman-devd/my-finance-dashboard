import { useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { useApp } from '../lib/store'
import { latestOdo } from '../lib/reminders'
import { Button, Card, Empty, Field, Modal, PageHead, Select, Tag, TextInput, cx } from '../components/ui'
import { EChart, barGaugeOption } from '../components/charts'
import { Plus, Pencil, Trash2, Fuel, Wrench, Car as CarIcon, CalendarClock } from 'lucide-react'
import type { Car, CarExpenseKind, FuelKind } from '../types'

/** 读取图片并压缩为小尺寸 dataURL（用于车辆小照片） */
function readThumb(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 240
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no ctx'))
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = String(reader.result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const EXP_KINDS: CarExpenseKind[] = ['保险', '保养', '停车', '过路费', '罚款', '洗车', '维修', '其他']
const KIND_COLOR: Record<string, string> = { 保险: '#7c3aed', 保养: '#2563eb', 停车: '#0ea5e9', 过路费: '#14b8a6', 罚款: '#ef4444', 洗车: '#f59e0b', 维修: '#f97316', 其他: '#94a3b8', 加油: '#dc2626', 充电: '#22c55e' }

export default function Cars() {
  const { data, addCar, updateCar, deleteCar, addFuel, deleteFuel, addCarExpense, deleteCarExpense } = useApp()
  const [carForm, setCarForm] = useState<{ open: boolean; car?: Car }>({ open: false })
  const [fuelFor, setFuelFor] = useState<Car | null>(null)
  const [expFor, setExpFor] = useState<Car | null>(null)

  const thisYear = dayjs().format('YYYY')

  const carStats = (cid: string) => {
    const fuels = data.fuelRecords.filter((f) => f.carId === cid && f.date.startsWith(thisYear))
    const exps = data.carExpenses.filter((e) => e.carId === cid && e.date.startsWith(thisYear))
    const fuelCost = fuels.reduce((a, f) => a + f.amount, 0)
    const expCost = exps.reduce((a, e) => a + e.amount, 0)
    // 油耗（按相邻两次加油）
    const ordered = data.fuelRecords.filter((f) => f.carId === cid && f.kind === '加油' && f.odometerKm > 0 && f.liters).sort((a, b) => (a.date < b.date ? -1 : 1))
    let fuelUse: number | null = null
    if (ordered.length >= 2) {
      const ratios: number[] = []
      for (let i = 1; i < ordered.length; i++) {
        const km = ordered[i].odometerKm - ordered[i - 1].odometerKm
        if (km > 0) ratios.push((ordered[i].liters! / km) * 100)
      }
      if (ratios.length) fuelUse = ratios.reduce((a, b) => a + b, 0) / ratios.length
    }
    const byKind = new Map<string, number>()
    for (const e of exps) byKind.set(e.kind, (byKind.get(e.kind) || 0) + e.amount)
    for (const f of fuels) byKind.set(f.kind, (byKind.get(f.kind) || 0) + f.amount)
    const kindArr = [...byKind.entries()].map(([name, value]) => ({ name, value: Math.round(value), color: KIND_COLOR[name] || '#94a3b8' })).sort((a, b) => b.value - a.value)
    return { fuelCost, expCost, total: fuelCost + expCost, fuelUse, kindArr }
  }

  return (
    <div className="space-y-5">
      <PageHead title="车辆管理" sub="加油记录 · 保养与到期提醒 · 用车成本" right={<Button onClick={() => setCarForm({ open: true })}><Plus size={16} /> 添加车辆</Button>} />

      {data.cars.length === 0 && <Card><Empty text="还没有车辆，添加第一辆车吧" /></Card>}

      {data.cars.map((c) => {
        const s = carStats(c.id)
        const odo = latestOdo(data, c.id)
        return (
          <Card key={c.id} className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              {c.photo ? <img src={c.photo} alt={c.name} className="w-12 h-12 rounded-xl object-cover border border-slate-100" /> : <span className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 grid place-items-center"><CarIcon size={20} /></span>}
              <div className="flex-1">
                <div className="font-semibold flex items-center gap-2">{c.name}{c.plate && <span className="text-[11px] font-normal text-slate-400">{c.plate}</span>}</div>
                <div className="text-[11px] text-slate-400">{odo ? `当前里程 ${odo.toLocaleString()} km` : '里程未知'}{c.buyDate ? ` · ${c.buyDate.slice(0, 4)}年购入` : ''}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setFuelFor(c)} className="text-[11px] text-blue-600 flex items-center gap-0.5 px-2 py-1 rounded-lg bg-blue-50"><Fuel size={12} /> 加油</button>
                <button onClick={() => setExpFor(c)} className="text-[11px] text-slate-600 flex items-center gap-0.5 px-2 py-1 rounded-lg bg-slate-100"><Wrench size={12} /> 记费用</button>
                <button onClick={() => setCarForm({ open: true, car: c })} className="text-slate-400 p-1"><Pencil size={13} /></button>
                <button onClick={() => { if (window.confirm(`删除车辆「${c.name}」及其全部记录？`)) deleteCar(c.id) }} className="text-red-400 p-1"><Trash2 size={13} /></button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-2"><div className="text-[10px] text-slate-400">今年用车支出</div><div className="text-sm font-bold text-slate-800 num">¥{s.total.toLocaleString()}</div></div>
              <div className="rounded-xl bg-slate-50 p-2"><div className="text-[10px] text-slate-400">加油/充电</div><div className="text-sm font-bold text-slate-800 num">¥{s.fuelCost.toLocaleString()}</div></div>
              <div className="rounded-xl bg-slate-50 p-2"><div className="text-[10px] text-slate-400">平均油耗</div><div className="text-sm font-bold text-slate-800 num">{s.fuelUse ? s.fuelUse.toFixed(1) + 'L' : '--'}</div></div>
            </div>

            {s.kindArr.length > 0 && <EChart option={barGaugeOption(s.kindArr)} height={Math.max(120, s.kindArr.length * 34)} />}

            {(c.serviceEveryKm || c.serviceEveryMonth || c.insuranceExpire || c.inspectionExpire) && (
              <div className="flex flex-wrap gap-1.5">
                {c.serviceEveryKm && c.lastServiceKm != null && <Tag tone="amber">保养里程：{(c.lastServiceKm + c.serviceEveryKm).toLocaleString()} km</Tag>}
                {c.serviceEveryMonth && c.lastServiceDate && <Tag tone="amber">下次保养：{dayjs(c.lastServiceDate).add(c.serviceEveryMonth, 'month').format('YYYY-MM')}</Tag>}
                {c.insuranceExpire && <Tag tone={dayjs(c.insuranceExpire).diff(dayjs(), 'day') <= 30 ? 'red' : 'slate'}>车险到期：{c.insuranceExpire}</Tag>}
                {c.inspectionExpire && <Tag tone="slate">年检到期：{c.inspectionExpire}</Tag>}
              </div>
            )}

            <FuelExpenseLists carId={c.id} onDeleteFuel={deleteFuel} onDeleteExp={deleteCarExpense} />
          </Card>
        )
      })}

      {carForm.open && <CarForm car={carForm.car} onClose={() => setCarForm({ open: false })} onSave={(c) => { if (carForm.car) updateCar(carForm.car.id, c); else addCar(c); setCarForm({ open: false }) }} />}
      {fuelFor && <FuelForm car={fuelFor} latestOdo={latestOdo(data, fuelFor.id)} onClose={() => setFuelFor(null)} onSave={(f) => { addFuel(f); setFuelFor(null) }} />}
      {expFor && <ExpForm car={expFor} onClose={() => setExpFor(null)} onSave={(e) => { addCarExpense(e); setExpFor(null) }} />}
    </div>
  )
}

function FuelExpenseLists({ carId, onDeleteFuel, onDeleteExp }: { carId: string; onDeleteFuel: (id: string) => void; onDeleteExp: (id: string) => void }) {
  const { data } = useApp()
  const fuels = data.fuelRecords.filter((f) => f.carId === carId).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)
  const exps = data.carExpenses.filter((e) => e.carId === carId).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <div className="text-[11px] font-semibold text-slate-500 mb-1">最近加油</div>
        {fuels.length === 0 && <div className="text-[11px] text-slate-300">暂无</div>}
        {fuels.map((f) => (
          <div key={f.id} className="flex items-center gap-2 py-1 text-xs">
            <span className="flex-1 text-slate-600">{f.date} · {f.odometerKm.toLocaleString()} km{f.liters ? ` · ${f.liters}L` : ''}</span>
            <span className="num text-slate-800 font-medium">¥{f.amount}</span>
            <button onClick={() => onDeleteFuel(f.id)} className="text-slate-300 hover:text-red-400"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
      <div>
        <div className="text-[11px] font-semibold text-slate-500 mb-1">其他费用</div>
        {exps.length === 0 && <div className="text-[11px] text-slate-300">暂无</div>}
        {exps.map((e) => (
          <div key={e.id} className="flex items-center gap-2 py-1 text-xs">
            <Tag tone="slate">{e.kind}</Tag>
            <span className="flex-1 text-slate-600 truncate">{e.date}{e.note ? ` ${e.note}` : ''}</span>
            <span className="num text-slate-800 font-medium">¥{e.amount}</span>
            <button onClick={() => onDeleteExp(e.id)} className="text-slate-300 hover:text-red-400"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function CarForm({ car, onClose, onSave }: { car?: Car; onClose: () => void; onSave: (c: Omit<Car, 'id'>) => void }) {
  const [name, setName] = useState(car?.name || '')
  const [plate, setPlate] = useState(car?.plate || '')
  const [buyDate, setBuyDate] = useState(car?.buyDate || '')
  const [serviceEveryKm, setServiceEveryKm] = useState(car?.serviceEveryKm ? String(car.serviceEveryKm) : '')
  const [lastServiceKm, setLastServiceKm] = useState(car?.lastServiceKm != null ? String(car.lastServiceKm) : '')
  const [serviceEveryMonth, setServiceEveryMonth] = useState(car?.serviceEveryMonth ? String(car.serviceEveryMonth) : '')
  const [lastServiceDate, setLastServiceDate] = useState(car?.lastServiceDate || '')
  const [insuranceExpire, setInsuranceExpire] = useState(car?.insuranceExpire || '')
  const [inspectionExpire, setInspectionExpire] = useState(car?.inspectionExpire || '')
  const [photo, setPhoto] = useState(car?.photo || '')
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <Modal open title={car ? '编辑车辆' : '添加车辆'} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={!name.trim()} onClick={() => onSave({
      name: name.trim(), plate: plate || undefined, buyDate: buyDate || undefined,
      serviceEveryKm: serviceEveryKm ? parseInt(serviceEveryKm) : undefined, lastServiceKm: lastServiceKm ? parseInt(lastServiceKm) : undefined,
      serviceEveryMonth: serviceEveryMonth ? parseInt(serviceEveryMonth) : undefined, lastServiceDate: lastServiceDate || undefined,
      insuranceExpire: insuranceExpire || undefined, inspectionExpire: inspectionExpire || undefined,
    })}>保存</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="名称"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="如：我的车" /></Field>
          <Field label="车牌"><TextInput value={plate} onChange={(e) => setPlate(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="购入日期"><TextInput type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} /></Field>
          <Field label="上次保养里程(km)"><TextInput inputMode="numeric" value={lastServiceKm} onChange={(e) => setLastServiceKm(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="保养间隔(km)"><TextInput inputMode="numeric" value={serviceEveryKm} onChange={(e) => setServiceEveryKm(e.target.value)} placeholder="如 10000" /></Field>
          <Field label="上次保养日期"><TextInput type="date" value={lastServiceDate} onChange={(e) => setLastServiceDate(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="保养间隔(月)"><TextInput inputMode="numeric" value={serviceEveryMonth} onChange={(e) => setServiceEveryMonth(e.target.value)} placeholder="如 6" /></Field>
          <Field label="车险到期"><TextInput type="date" value={insuranceExpire} onChange={(e) => setInsuranceExpire(e.target.value)} /></Field>
        </div>
        <Field label="年检到期"><TextInput type="date" value={inspectionExpire} onChange={(e) => setInspectionExpire(e.target.value)} /></Field>
        <Field label="车辆照片（可选）">
          <div className="flex items-center gap-3">
            {photo ? <img src={photo} alt="车辆照片" className="w-16 h-16 rounded-xl object-cover border border-slate-200" /> : <span className="w-16 h-16 rounded-xl bg-slate-100 grid place-items-center text-2xl">📷</span>}
            <div className="flex flex-col gap-1.5">
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>上传照片</Button>
              {photo && <Button type="button" variant="ghost" onClick={() => setPhoto("")}>移除</Button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setPhoto(await readThumb(f)) } catch { /* ignore */ } } e.target.value = "" }} />
          </div>
        </Field>
      </div>
    </Modal>
  )
}

function FuelForm({ car, latestOdo, onClose, onSave }: { car: Car; latestOdo: number | null; onClose: () => void; onSave: (f: { carId: string; date: string; kind: FuelKind; odometerKm: number; liters?: number; amount: number; note?: string }) => void }) {
  const [kind, setKind] = useState<FuelKind>('加油')
  const [odo, setOdo] = useState(latestOdo ? String(latestOdo) : '')
  const [liters, setLiters] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const amt = parseFloat(amount) || 0
  return (
    <Modal open title={`${car.name} · 加油/充电`} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={!odo || amt <= 0} onClick={() => onSave({ carId: car.id, date, kind, odometerKm: parseInt(odo) || 0, liters: liters ? parseFloat(liters) : undefined, amount: amt })}>保存</Button></>}>
      <div className="space-y-3">
        <div className="flex gap-2">{(['加油', '充电'] as FuelKind[]).map((k) => <button key={k} onClick={() => setKind(k)} className={cx('flex-1 py-2 rounded-xl border text-sm', kind === k ? 'border-blue-400 bg-blue-50 text-blue-600 font-medium' : 'border-slate-200 text-slate-500')}>{k}</button>)}</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="当前里程 km"><TextInput inputMode="numeric" value={odo} onChange={(e) => setOdo(e.target.value)} /></Field>
          <Field label={`${kind === '加油' ? '加油量 L' : '电量(选填)'}`}><TextInput inputMode="decimal" value={liters} onChange={(e) => setLiters(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="金额"><TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="日期"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  )
}

function ExpForm({ car, onClose, onSave }: { car: Car; onClose: () => void; onSave: (e: { carId: string; date: string; kind: CarExpenseKind; amount: number; odometerKm?: number; note?: string }) => void }) {
  const [kind, setKind] = useState<CarExpenseKind>('保养')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [note, setNote] = useState('')
  const amt = parseFloat(amount) || 0
  return (
    <Modal open title={`${car.name} · 记费用`} onClose={onClose} footer={<><Button variant="soft" onClick={onClose}>取消</Button><Button disabled={amt <= 0} onClick={() => onSave({ carId: car.id, date, kind, amount: amt, note: note || undefined })}>保存</Button></>}>
      <div className="space-y-3">
        <Field label="费用类型">
          <div className="flex flex-wrap gap-1.5">{EXP_KINDS.map((k) => <button key={k} onClick={() => setKind(k)} className={cx('px-2.5 py-1 rounded-lg text-xs border', kind === k ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500')}>{k}</button>)}</div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="金额"><TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="日期"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="备注"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：4S店小保养 / 高速费" /></Field>
      </div>
    </Modal>
  )
}




