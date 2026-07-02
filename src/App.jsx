import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [customers, setCustomers] = useState([])
  const [employees, setEmployees] = useState([])
  const [services, setServices] = useState([])
  const [appointments, setAppointments] = useState([])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const [customerId, setCustomerId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [startTime, setStartTime] = useState('')

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
    if (error) {
      alert('Error: ' + error.message)
      return
    }
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
    </div>
  )
}

export default App