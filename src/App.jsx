import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

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

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const [mName, setMName] = useState('')
  const [mPrice, setMPrice] = useState('')
  const [mStock, setMStock] = useState('')
  const [mCategory, setMCategory] = useState('')
  const [restockAmounts, setRestockAmounts] = useState({})

  const [cart, setCart] = useState([]) // [{ id, name, price, stock_qty, qty }]
  const [checkingOut, setCheckingOut] = useState(false)

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
        employee_id: session.id, item_name: c.name, quantity: c.qty, price: c.price, total
      }])
      if (error) { alert('Error saving ' + c.name + ': ' + error.message); continue }
      if (c.stock_qty !== null) {
        await supabase.from('menu_items').update({ stock_qty: c.stock_qty - c.qty }).eq('id', c.id)
      }
    }
    setCart([])
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
                <span>{new Date(s.created_at).toLocaleString()} — {s.quantity}x {s.item_name} (${s.price} each) = ${s.total} · sold by {s.employees?.name}</span>
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