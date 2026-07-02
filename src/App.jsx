import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [customers, setCustomers] = useState([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    setCustomers(data || [])
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  async function addCustomer(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const { error } = await supabase
      .from('customers')
      .insert([{ name, email }])
    setLoading(false)
    if (error) {
      alert('Error: ' + error.message)
      return
    }
    setName('')
    setEmail('')
    loadCustomers()
  }

  async function deleteCustomer(id) {
    await supabase.from('customers').delete().eq('id', id)
    loadCustomers()
  }

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 500 }}>
      <h1>My Customers</h1>

      <form onSubmit={addCustomer} style={{ marginBottom: 24 }}>
        <input
          placeholder="Customer name"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }}
        />
        <input
          placeholder="Email (optional)"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ display: 'block', marginBottom: 8, padding: 8, width: '100%' }}
        />
        <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
          {loading ? 'Adding...' : 'Add customer'}
        </button>
      </form>

      {customers.map(c => (
        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
          <span>{c.name} {c.email ? `— ${c.email}` : ''}</span>
          <button onClick={() => deleteCustomer(c.id)} style={{ color: 'red' }}>Delete</button>
        </div>
      ))}
    </div>
  )
}

export default App