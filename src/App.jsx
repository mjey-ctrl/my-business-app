import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Monday
  const monday = new Date(date.setDate(diff))
  return monday.toISOString().slice(0, 10)
}
function endOfWeek(d) {
  const monday = new Date(startOfWeek(d))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return sunday.toISOString().slice(0, 10)
}

function App() {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('session')
    return saved ? JSON.parse(saved) : null
  })

  const [customers, setCustomers] = useState([])
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [sales, setSales] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [expenses, setExpenses] = useState([])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const [mName, setMName] = useState('')
  const [mPrice, setMPrice] = useState('')
  const [mStock, setMStock] = useState('')
  const [mCategory, setMCategory] = useState('')
  const [restockAmounts, setRestockAmounts] = useState({})

  const [expAmount, setExpAmount] = useState('')
  const [expCategory, setExpCategory] = useState('Ingredients')
  const [expNote, setExpNote] = useState('')

  const [rateInputs, setRateInputs] = useState({})

  const [rangeStart, setRangeStart] = useState(() => startOfWeek(new Date()))
  const [rangeEnd, setRangeEnd] = useState(() => endOfWeek(new Date()))

  const [cart, setCart] = useState([])
  const [checkingOut, setCheckingOut] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('Cash')

  const isOwner = session?.role === 'Owner'

  async function loadAll() {
    const { data: c } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    setCustomers(c || [])
    const { data: e } = await supabase.from('employees').select('*')
    setEmployees(e || [])
    const { data: att } = await supabase
      .from('attendance')
      .select('*, employees(name)')
      .order('clock_in', { ascending: false })
    setAttendance(att || [])
    const { data: sl } = await supabase
      .from('sales_log')
      .select('*, employees(name)')
      .order('created_at', { ascending: false })
    setSales(sl || [])
    const { data: mi } = await supabase
      .from('menu_items')
      .select('*')
      .order('name', { ascending: true })
    setMenuItems(mi || [])
    const { data: ex } = await supabase
      .from('expenses')
      .select('*, employees(name)')
      .order('created_at', { ascending: false })
    setExpenses(ex || [])
  }

  useEffect(() => {
    if (session) loadAll()
  }, [session])

  /* ---------------- LOGIN ---------------- */
  function LoginScreen() {
    const [pinEmployees, setPinEmployees] = useState([])
    const [selectedId, setSelectedId] = useState('')
    const [pin, setPin] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
      supabase.from('employees').select('id, name').then(({ data }) => setPinEmployees(data || []))
    }, [])

    async function handleLogin(e) {
      e.preventDefault()
      setError('')
      if (!selectedId || !pin) {
        setError('Please select your name and enter your PIN')
        return
      }
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', selectedId)
        .eq('pin', pin)
        .single()

      if (error || !data) {
        setError('Incorrect PIN. Try again.')
        return
      }
      const newSession = { id: data.id, name: data.name, role: data.role }
      localStorage.setItem('session', JSON.stringify(newSession))
      setSession(newSession)
    }

    return (
      <div className="login-wrap">
        <form className="login-card" onSubmit={handleLogin}>
          <img src="/logo.png" alt="Quick QC" className="login-logo-img" />
          <h1>Quick QC</h1>
          <p className="login-sub">Sign in to continue</p>

          <label className="field-label">Your name</label>
          <select className="input" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">Select your name</option>
            {pinEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>

          <label className="field-label">PIN code</label>
          <input
            className="input"
            type="password"
            inputMode="numeric"
            placeholder="••••"
            value={pin}
            onChange={e => setPin(e.target.value)}
          />

          {error && <div className="error-text">{error}</div>}

          <button className="btn btn-primary btn-block" type="submit">Sign in</button>
        </form>
      </div>
    )
  }

  if (!session) return <LoginScreen />

  /* ---------------- ACTIONS ---------------- */
  async function addCustomer(e) {
    e.preventDefault()
    if (!name.trim()) return
    await supabase.from('customers').insert([{ name, email }])
    setName(''); setEmail('')
    loadAll()
  }
  async function deleteCustomer(id) {
    await supabase.from('customers').delete().eq('id', id)
    loadAll()
  }
  async function clockIn() {
    const { error } = await supabase.from('attendance').insert([{ employee_id: session.id, clock_in: new Date().toISOString() }])
    if (error) { alert('Error: ' + error.message); return }
    loadAll()
  }
  async function clockOut() {
    const { data: openShift } = await supabase
      .from('attendance').select('*').eq('employee_id', session.id).is('clock_out', null)
      .order('clock_in', { ascending: false }).limit(1).single()
    if (!openShift) { alert('You are not currently clocked in'); return }
    const { error } = await supabase.from('attendance').update({ clock_out: new Date().toISOString() }).eq('id', openShift.id)
    if (error) { alert('Error: ' + error.message); return }
    loadAll()
  }
  async function deleteSale(id) {
    await supabase.from('sales_log').delete().eq('id', id)
    loadAll()
  }
  async function addMenuItem(e) {
    e.preventDefault()
    if (!mName.trim() || !mPrice) { alert('Item name and price are required'); return }
    const { error } = await supabase.from('menu_items').insert([{
      name: mName, price: Number(mPrice), stock_qty: mStock === '' ? 0 : Number(mStock), category: mCategory
    }])
    if (error) { alert('Error: ' + error.message); return }
    setMName(''); setMPrice(''); setMStock(''); setMCategory('')
    loadAll()
  }
  async function deleteMenuItem(id) {
    await supabase.from('menu_items').delete().eq('id', id)
    loadAll()
  }
  async function restock(itemId) {
    const amount = Number(restockAmounts[itemId])
    if (!amount || amount <= 0) { alert('Enter a positive number'); return }
    const item = menuItems.find(m => m.id === itemId)
    await supabase.from('menu_items').update({ stock_qty: (item.stock_qty || 0) + amount }).eq('id', itemId)
    setRestockAmounts(r => ({ ...r, [itemId]: '' }))
    loadAll()
  }
  async function addExpense(e) {
    e.preventDefault()
    if (!expAmount || Number(expAmount) <= 0) { alert('Enter a valid amount'); return }
    const { error } = await supabase.from('expenses').insert([{
      amount: Number(expAmount), category: expCategory, note: expNote, employee_id: session.id
    }])
    if (error) { alert('Error: ' + error.message); return }
    setExpAmount(''); setExpNote('')
    loadAll()
  }
  async function deleteExpense(id) {
    await supabase.from('expenses').delete().eq('id', id)
    loadAll()
  }
  async function updateRate(employeeId) {
    const rate = Number(rateInputs[employeeId])
    if (rate < 0 || rateInputs[employeeId] === undefined || rateInputs[employeeId] === '') {
      alert('Enter a valid daily rate')
      return
    }
    const { error } = await supabase.from('employees').update({ daily_rate: rate }).eq('id', employeeId)
    if (error) { alert('Error: ' + error.message); return }
    setRateInputs(r => ({ ...r, [employeeId]: '' }))
    loadAll()
  }
  function logout() {
    localStorage.removeItem('session')
    setSession(null)
  }

  /* ---------------- POS CART ---------------- */
  function addToCart(item) {
    const inCartQty = cart.find(c => c.id === item.id)?.qty || 0
    if (item.stock_qty !== null && inCartQty + 1 > item.stock_qty) {
      alert(`Only ${item.stock_qty} left in stock`)
      return
    }
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, stock_qty: item.stock_qty, qty: 1 }]
    })
  }

  function changeCartQty(itemId, delta) {
    setCart(prev => prev
      .map(c => {
        if (c.id !== itemId) return c
        const newQty = c.qty + delta
        if (c.stock_qty !== null && newQty > c.stock_qty) {
          alert(`Only ${c.stock_qty} left in stock`)
          return c
        }
        return { ...c, qty: newQty }
      })
      .filter(c => c.qty > 0)
    )
  }

  function removeFromCart(itemId) {
    setCart(prev => prev.filter(c => c.id !== itemId))
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0)

  async function checkout() {
    if (cart.length === 0) return
    setCheckingOut(true)
    for (const c of cart) {
      const total = c.qty * Number(c.price)
      const { error } = await supabase.from('sales_log').insert([{
        employee_id: session.id, item_name: c.name, quantity: c.qty, price: c.price, total, payment_method: paymentMethod
      }])
      if (error) { alert('Error saving ' + c.name + ': ' + error.message); continue }
      if (c.stock_qty !== null) {
        await supabase.from('menu_items').update({ stock_qty: c.stock_qty - c.qty }).eq('id', c.id)
      }
    }
    setCart([])
    setPaymentMethod('Cash')
    setCheckingOut(false)
    await loadAll()
    alert('Sale complete!')
  }

  /* ---------------- TODAY SNAPSHOT ---------------- */
  const todaySales = sales.filter(s => new Date(s.created_at).toDateString() === new Date().toDateString())
  const todayTotal = todaySales.reduce((sum, s) => sum + Number(s.total), 0)

  const workingNow = attendance.filter(a => !a.clock_out)
  const workingNowCount = new Set(workingNow.map(a => a.employee_id)).size

  const itemCounts = {}
  todaySales.forEach(s => {
    itemCounts[s.item_name] = (itemCounts[s.item_name] || 0) + s.quantity
  })
  const bestSellerEntry = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]
  const bestSeller = bestSellerEntry ? `${bestSellerEntry[0]} (${bestSellerEntry[1]} sold)` : '—'

  const lowStockItems = menuItems.filter(m => m.stock_qty !== null && m.stock_qty <= 5)

  const mySales = sales.filter(s => s.employee_id === session.id)
  const myAttendance = attendance.filter(a => a.employee_id === session.id)

  /* ---------------- PROFIT SUMMARY (date range) ---------------- */
  function inRange(dateStr) {
    const d = new Date(dateStr).toISOString().slice(0, 10)
    return d >= rangeStart && d <= rangeEnd
  }

  const rangeSales = sales.filter(s => inRange(s.created_at))
  const rangeSalesTotal = rangeSales.reduce((sum, s) => sum + Number(s.total), 0)

  const rangeExpenses = expenses.filter(ex => inRange(ex.created_at))
  const rangeExpensesTotal = rangeExpenses.reduce((sum, ex) => sum + Number(ex.amount), 0)

  const rangeAttendance = attendance.filter(a => inRange(a.clock_in))
  const daysWorkedByEmployee = {}
  rangeAttendance.forEach(a => {
    const dayKey = a.employee_id + '_' + new Date(a.clock_in).toDateString()
    daysWorkedByEmployee[dayKey] = a.employee_id
  })
  const dayCountByEmployee = {}
  Object.values(daysWorkedByEmployee).forEach(empId => {
    dayCountByEmployee[empId] = (dayCountByEmployee[empId] || 0) + 1
  })
  const rangeSalaryTotal = Object.entries(dayCountByEmployee).reduce((sum, [empId, days]) => {
    const emp = employees.find(e => e.id === empId)
    return sum + (days * Number(emp?.daily_rate || 0))
  }, 0)

  const netProfit = rangeSalesTotal - rangeExpensesTotal - rangeSalaryTotal

  const rangeCashTotal = rangeSales.filter(s => (s.payment_method || 'Cash') === 'Cash').reduce((sum, s) => sum + Number(s.total), 0)
  const rangeGcashTotal = rangeSales.filter(s => s.payment_method === 'GCash').reduce((sum, s) => sum + Number(s.total), 0)

  /* ---------------- APP SHELL ---------------- */
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><img src="/logo.png" alt="Quick QC" className="brand-logo" /><span>Quick QC</span></div>
        <div className="topbar-right">
          <span className={`role-badge ${isOwner ? 'role-owner' : 'role-employee'}`}>{session.role}</span>
          <span className="user-name">{session.name}</span>
          <button className="btn btn-ghost" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="content">

        {/* -------- TODAY AT A GLANCE -------- */}
        <section className="card">
          <h2>Today at a Glance</h2>
          <div className="snapshot-grid">
            <div className="snapshot-box">
              <span className="snapshot-label">Today's Sales</span>
              <span className="snapshot-value">${todayTotal.toFixed(2)}</span>
            </div>
            <div className="snapshot-box">
              <span className="snapshot-label">Working Now</span>
              <span className="snapshot-value">{workingNowCount}</span>
            </div>
            <div className="snapshot-box">
              <span className="snapshot-label">Best Seller Today</span>
              <span className="snapshot-value snapshot-value-sm">{bestSeller}</span>
            </div>
            <div className={`snapshot-box ${lowStockItems.length > 0 ? 'snapshot-box-alert' : ''}`}>
              <span className="snapshot-label">Low Stock Items</span>
              <span className="snapshot-value">{lowStockItems.length}</span>
            </div>
          </div>
          {lowStockItems.length > 0 && (
            <div className="snapshot-lowstock-list">
              {lowStockItems.map(item => (
                <span key={item.id} className="lowstock-chip">{item.name}: {item.stock_qty} left</span>
              ))}
            </div>
          )}
        </section>

        {/* -------- PROFIT SUMMARY -------- */}
        {isOwner && (
          <section className="card">
            <h2>Profit Summary</h2>
            <div className="date-range-row">
              <div>
                <label className="field-label">From</label>
                <input className="input" type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
              </div>
              <div>
                <label className="field-label">To</label>
                <input className="input" type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
              </div>
              <button className="btn btn-secondary" onClick={() => { setRangeStart(startOfWeek(new Date())); setRangeEnd(endOfWeek(new Date())) }}>This Week</button>
            </div>
            <div className="snapshot-grid">
              <div className="snapshot-box">
                <span className="snapshot-label">Sales</span>
                <span className="snapshot-value">${rangeSalesTotal.toFixed(2)}</span>
              </div>
              <div className="snapshot-box">
                <span className="snapshot-label">Expenses</span>
                <span className="snapshot-value">${rangeExpensesTotal.toFixed(2)}</span>
              </div>
              <div className="snapshot-box">
                <span className="snapshot-label">Salaries</span>
                <span className="snapshot-value">${rangeSalaryTotal.toFixed(2)}</span>
              </div>
              <div className={`snapshot-box ${netProfit >= 0 ? 'snapshot-box-good' : 'snapshot-box-alert'}`}>
                <span className="snapshot-label">Net Profit</span>
                <span className="snapshot-value">${netProfit.toFixed(2)}</span>
              </div>
            </div>
            <div className="payment-breakdown">
              <span className="payment-chip payment-chip-cash">Cash: ${rangeCashTotal.toFixed(2)}</span>
              <span className="payment-chip payment-chip-gcash">GCash: ${rangeGcashTotal.toFixed(2)}</span>
            </div>
          </section>
        )}

        {/* -------- POS -------- */}
        <section className="card">
          <h2>Point of Sale</h2>
          <div className="pos-grid">
            {menuItems.map(m => (
              <button
                key={m.id}
                className="pos-item"
                disabled={m.stock_qty !== null && m.stock_qty <= 0}
                onClick={() => addToCart(m)}
              >
                <span className="pos-item-name">{m.name}</span>
                <span className="pos-item-price">${m.price}</span>
                {m.stock_qty !== null && (
                  <span className={m.stock_qty <= 5 ? 'pos-item-stock-low' : 'pos-item-stock'}>
                    {m.stock_qty <= 0 ? 'Out of stock' : `${m.stock_qty} left`}
                  </span>
                )}
              </button>
            ))}
            {menuItems.length === 0 && <p>No menu items yet — add some in Menu & Inventory below.</p>}
          </div>

          {cart.length > 0 && (
            <div className="cart-panel">
              <h3>Current order</h3>
              {cart.map(c => (
                <div className="cart-row" key={c.id}>
                  <span className="cart-row-name">{c.name}</span>
                  <div className="cart-qty-controls">
                    <button className="qty-btn" onClick={() => changeCartQty(c.id, -1)}>−</button>
                    <span>{c.qty}</span>
                    <button className="qty-btn" onClick={() => changeCartQty(c.id, 1)}>+</button>
                  </div>
                  <span className="cart-row-total">${(c.price * c.qty).toFixed(2)}</span>
                  <button className="btn btn-danger-outline" onClick={() => removeFromCart(c.id)}>✕</button>
                </div>
              ))}
              <div className="payment-toggle">
                <button
                  className={`pay-btn ${paymentMethod === 'Cash' ? 'pay-btn-active' : ''}`}
                  onClick={() => setPaymentMethod('Cash')}
                >Cash</button>
                <button
                  className={`pay-btn ${paymentMethod === 'GCash' ? 'pay-btn-active' : ''}`}
                  onClick={() => setPaymentMethod('GCash')}
                >GCash</button>
              </div>
              <div className="cart-summary">
                <span>Total</span>
                <span className="cart-grand-total">${cartTotal.toFixed(2)}</span>
              </div>
              <button className="btn btn-primary btn-block" onClick={checkout} disabled={checkingOut}>
                {checkingOut ? 'Processing...' : 'Complete Sale'}
              </button>
            </div>
          )}
        </section>

        {isOwner && (
          <section className="card">
            <h2>Expenses</h2>
            <form onSubmit={addExpense} className="form-row">
              <input className="input" type="number" step="0.01" placeholder="Amount" value={expAmount} onChange={e => setExpAmount(e.target.value)} />
              <select className="input" value={expCategory} onChange={e => setExpCategory(e.target.value)}>
                <option>Ingredients</option>
                <option>Electricity</option>
                <option>Rent</option>
                <option>Supplies</option>
                <option>Gas/Fuel</option>
                <option>Other</option>
              </select>
              <button className="btn btn-primary" type="submit">Add expense</button>
            </form>
            <input className="input" placeholder="Note (optional)" value={expNote} onChange={e => setExpNote(e.target.value)} style={{ marginBottom: '14px', width: '100%' }} />
            <div className="list">
              {expenses.map(ex => (
                <div className="list-row" key={ex.id}>
                  <span>{new Date(ex.created_at).toLocaleDateString()} — <b>{ex.category}</b>: ${Number(ex.amount).toFixed(2)} {ex.note ? `(${ex.note})` : ''} · logged by {ex.employees?.name}</span>
                  <button className="btn btn-danger-outline" onClick={() => deleteExpense(ex.id)}>Delete</button>
                </div>
              ))}
              {expenses.length === 0 && <p>No expenses logged yet.</p>}
            </div>
          </section>
        )}

        {isOwner && (
          <section className="card">
            <h2>Customers</h2>
            <form onSubmit={addCustomer} className="form-row">
              <input className="input" placeholder="Customer name" value={name} onChange={e => setName(e.target.value)} />
              <input className="input" placeholder="Email (optional)" value={email} onChange={e => setEmail(e.target.value)} />
              <button className="btn btn-primary" type="submit">Add customer</button>
            </form>
            <div className="list">
              {customers.map(c => (
                <div className="list-row" key={c.id}>
                  <span>{c.name} {c.email ? `— ${c.email}` : ''}</span>
                  <button className="btn btn-danger-outline" onClick={() => deleteCustomer(c.id)}>Delete</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {isOwner && (
          <section className="card">
            <h2>Menu & Inventory</h2>
            <form onSubmit={addMenuItem} className="form-grid">
              <input className="input" placeholder="Item name" value={mName} onChange={e => setMName(e.target.value)} />
              <input className="input" type="number" step="0.01" placeholder="Price" value={mPrice} onChange={e => setMPrice(e.target.value)} />
              <input className="input" type="number" placeholder="Starting stock" value={mStock} onChange={e => setMStock(e.target.value)} />
              <input className="input" placeholder="Category" value={mCategory} onChange={e => setMCategory(e.target.value)} />
              <button className="btn btn-primary" type="submit">Add item</button>
            </form>
            <div className="list">
              {menuItems.map(m => (
                <div className="menu-row" key={m.id}>
                  <div className="menu-row-top">
                    <span><b>{m.name}</b> — ${m.price} {m.category ? `(${m.category})` : ''}</span>
                    <span className={m.stock_qty <= 5 ? 'stock-low' : 'stock-ok'}>
                      {m.stock_qty} in stock{m.stock_qty <= 5 ? ' — LOW' : ''}
                    </span>
                    <button className="btn btn-danger-outline" onClick={() => deleteMenuItem(m.id)}>Delete</button>
                  </div>
                  <div className="restock-row">
                    <input className="input input-sm" type="number" placeholder="Add stock"
                      value={restockAmounts[m.id] || ''}
                      onChange={e => setRestockAmounts(r => ({ ...r, [m.id]: e.target.value }))} />
                    <button className="btn btn-secondary" onClick={() => restock(m.id)}>Restock</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <h2>Team Attendance</h2>
          <div className="clock-actions">
            <button className="btn btn-primary" onClick={clockIn}>Clock In</button>
            <button className="btn btn-secondary" onClick={clockOut}>Clock Out</button>
          </div>

          {isOwner && (
            <div className="rate-panel">
              <h3>Employee Daily Rate</h3>
              {employees.map(emp => (
                <div className="rate-row" key={emp.id}>
                  <span className="rate-name">{emp.name}</span>
                  <span className="rate-current">Current: ${Number(emp.daily_rate || 0).toFixed(2)}/day</span>
                  <input className="input input-sm" type="number" placeholder="New rate"
                    value={rateInputs[emp.id] || ''}
                    onChange={e => setRateInputs(r => ({ ...r, [emp.id]: e.target.value }))} />
                  <button className="btn btn-secondary" onClick={() => updateRate(emp.id)}>Save</button>
                </div>
              ))}
            </div>
          )}

          <div className="list">
            {(isOwner ? attendance : myAttendance).map(a => (
              <div className="list-row" key={a.id}>
                <span><b>{a.employees?.name}</b> — In: {new Date(a.clock_in).toLocaleString()}
                  {a.clock_out ? ` · Out: ${new Date(a.clock_out).toLocaleString()}` : ' · still working'}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Sales History</h2>
          <div className="list">
            {(isOwner ? sales : mySales).map(s => (
              <div className="list-row" key={s.id}>
                <span>{new Date(s.created_at).toLocaleString()} — {s.quantity}x {s.item_name} (${s.price} each) = ${s.total} · {s.payment_method || 'Cash'} · sold by {s.employees?.name}</span>
                {isOwner && <button className="btn btn-danger-outline" onClick={() => deleteSale(s.id)}>Delete</button>}
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}

export default App