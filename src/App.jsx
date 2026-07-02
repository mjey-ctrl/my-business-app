import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [customers, setCustomers] = useState([])
  const [employees, setEmployees] = useState([])
  const [services, setServices] = useState([])
  const [appointments, setAppointments] = useState([])
  const [attendance, setAttendance] = useState([])
  const [sales, setSales] = useState([])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const [customerId, setCustomerId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [startTime, setStartTime] = useState('')

  const [clockEmployeeId, setClockEmployeeId] = useState('')

  const [saleEmployeeId, setSaleEmployeeId] = useState('')
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [price, setPrice] = useState('')

  async function loadAll() {
    const { data: c } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
    setCustomers(c || [])
    const { data: e } = await supabase.from('employees').select('*')
    setEmployees(e || [])
    const { data: s } = await supabase.from('services').select('*')
    setServices(s || [])
    const { data: a } = await supabase
      .from('appointments')
      .select('*, customers(name), employees(name), services(name)')
      .order('start_time', { ascending: true })
    setAppointments(a || [])
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
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function addCustomer(e) {
    e.preventDefault()
    if (!name.trim()) return
    await supabase.from('customers').insert([{ name, email }])
    setName('')
    setEmail('')
    loadAll()
  }

  async function deleteCustomer(id) {
    await supabase.from('customers').delete().eq('id', id)
    loadAll()
  }

  async function addAppointment(e) {
    e.preventDefault()
    if (!customerId || !employeeId || !serviceId || !startTime) {
      alert('Please fill in every field')
      return
    }
    const { error } = await supabase.from('appointments').insert([{
      customer_id: customerId,
      employee_id: employeeId,
      service_id: serviceId,
      start_time: startTime,
      status: 'Scheduled'
    }])
    if (error) { alert('Error: ' + error.message); return }
    setCustomerId('')
    setEmployeeId('')
    setServiceId('')
    setStartTime('')
    loadAll()
  }

  async function deleteAppointment(id) {
    await supabase.from('appointments').delete().eq('id', id)
    loadAll()
  }

  async function clockIn() {
    if (!clockEmployeeId) { alert('Pick an employee first'); return }
    const { error } = await supabase.from('attendance').insert([{
      employee_id: clockEmployeeId,
      clock_in: new Date().toISOString()
    }])
    if (error) { alert('Error: ' + error.message); return }
    loadAll()
  }

  async function clockOut() {
    if (!clockEmployeeId) { alert('Pick an employee first'); return }
    const { data: openShift } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', clockEmployeeId)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .single()
    if (!openShift) { alert('This employee is not currently clocked in'); return }
    const { error } = await supabase
      .from('attendance')
      .update({ clock_out: new Date().toISOString() })
      .eq('id', openShift.id)
    if (error) { alert('Error: ' + error.message); return }
    loadAll()
  }

  async function addSale(e) {
    e.preventDefault()
    if (!saleEmployeeId || !itemName.trim() || !price) {
      alert('Please fill in every field')
      return
    }
    const qty = Number(quantity) || 1
    const unitPrice = Number(price)
    const total = qty * unitPrice
    const { error } = await supabase.from('sales_log').insert([{
      employee_id: saleEmployeeId,
      item_name: itemName,
      quantity: qty,
      price: unitPrice,
      total: total
    }])
    if (error) { alert('Error: ' + error.message); return }
    setItemName('')
    setQuantity(1)
    setPrice('')
    loadAll()
  }

  async function deleteSale(id) {
    await supabase.from('sales_log').delete().eq('id', id)
    loadAll()
  }

  const todayTotal = sales
    .filter(s => new Date(s.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + Number(s.total), 0)

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 600 }}>
      <h1>My Customers</h1>
      <form onSubmit={addCustomer} style={{ marginBottom: 24 }}>
        <input placeholder="Customer name" value={name} onChange={e => setName(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }} />
        <input placeholder="Email (optional)" value={email} onChange={e => setEmail(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }} />
        <button type="submit" style={{ padding: '8px 16px' }}>Add customer</button>
      </form>
      {customers.map(c => (
        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
          <span>{c.name} {c.email ? `— ${c.email}` : ''}</span>
          <button onClick={() => deleteCustomer(c.id)} style={{ color: 'red' }}>Delete</button>
        </div>
      ))}

      <h1 style={{ marginTop: 48 }}>Appointments</h1>
      <form onSubmit={addAppointment} style={{ marginBottom: 24 }}>
        <select value={customerId} onChange={e => setCustomerId(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }}>
          <option value="">Select customer</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }}>
          <option value="">Select employee</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={serviceId} onChange={e => setServiceId(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }}>
          <option value="">Select service</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name} — ${s.price}</option>)}
        </select>
        <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }} />
        <button type="submit" style={{ padding: '8px 16px' }}>Add appointment</button>
      </form>
      {appointments.map(a => (
        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
          <span>
            {new Date(a.start_time).toLocaleString()} — {a.customers?.name} with {a.employees?.name} ({a.services?.name})
          </span>
          <button onClick={() => deleteAppointment(a.id)} style={{ color: 'red' }}>Delete</button>
        </div>
      ))}

      <h1 style={{ marginTop: 48 }}>Team Attendance</h1>
      <div style={{ marginBottom: 24 }}>
        <select value={clockEmployeeId} onChange={e => setClockEmployeeId(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }}>
          <option value="">Select team member</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <button onClick={clockIn} style={{ padding: '8px 16px', marginRight: 8 }}>Clock In</button>
        <button onClick={clockOut} style={{ padding: '8px 16px' }}>Clock Out</button>
      </div>
      {attendance.map(a => (
        <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
          <b>{a.employees?.name}</b> — In: {new Date(a.clock_in).toLocaleString()}
          {a.clock_out ? ` · Out: ${new Date(a.clock_out).toLocaleString()}` : ' · still working'}
        </div>
      ))}

      <h1 style={{ marginTop: 48 }}>Sales</h1>
      <p style={{ fontWeight: 'bold', fontSize: 18 }}>Today's total: ${todayTotal.toFixed(2)}</p>
      <form onSubmit={addSale} style={{ marginBottom: 24 }}>
        <select value={saleEmployeeId} onChange={e => setSaleEmployeeId(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }}>
          <option value="">Sold by</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <input placeholder="Item name (e.g. Cheeseburger)" value={itemName} onChange={e => setItemName(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }} />
        <input type="number" min="1" placeholder="Quantity" value={quantity} onChange={e => setQuantity(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }} />
        <input type="number" step="0.01" placeholder="Price per item" value={price} onChange={e => setPrice(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }} />
        <button type="submit" style={{ padding: '8px 16px' }}>Log sale</button>
      </form>
      {sales.map(s => (
        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
          <span>
            {new Date(s.created_at).toLocaleString()} — {s.quantity}x {s.item_name} (${s.price} each) = ${s.total} · sold by {s.employees?.name}
          </span>
          <button onClick={() => deleteSale(s.id)} style={{ color: 'red' }}>Delete</button>
        </div>
      ))}
    </div>
  )
}

export default App  