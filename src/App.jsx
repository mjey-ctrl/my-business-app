import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    supabase.from('customers').select('*').then(({ data }) => {
      setCustomers(data || [])
    })
  }, [])

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>My Customers</h1>
      {customers.map(c => (
        <p key={c.id}>{c.name}</p>
      ))}
    </div>
  )
}

export default App