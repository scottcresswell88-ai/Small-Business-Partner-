import { useEffect, useState, type ComponentType } from 'react'
import { TaxCalculator } from './features/tax/TaxCalculator'
import { Receipts } from './features/receipts/Receipts'

// Each feature is a self-contained screen. Add new ones here.
const FEATURES: { id: string; label: string; icon: string; component: ComponentType }[] = [
  { id: 'tax', label: 'Tax & GST', icon: '🧮', component: TaxCalculator },
  { id: 'receipts', label: 'Receipts', icon: '🧾', component: Receipts },
]

function currentFeature() {
  const id = location.hash.slice(1)
  return FEATURES.find((f) => f.id === id) ?? FEATURES[0]
}

export default function App() {
  const [feature, setFeature] = useState(currentFeature)
  useEffect(() => {
    const onHash = () => setFeature(currentFeature())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const Feature = feature.component

  return (
    <div className="app">
      <nav className="nav no-print">
        <div className="brand">
          <span className="logo">SB</span>
          <span>Small Business Partner</span>
        </div>
        <div className="tabs">
          {FEATURES.map((f) => (
            <a key={f.id} href={`#${f.id}`} className={f.id === feature.id ? 'active' : ''}>
              <span aria-hidden>{f.icon}</span> {f.label}
            </a>
          ))}
        </div>
      </nav>
      <main>
        <Feature />
      </main>
    </div>
  )
}
