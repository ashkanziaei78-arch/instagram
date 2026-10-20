import { createRoot } from 'react-dom/client'
import App from './App'
import { LicenseGate } from './components/LicenseGate'
import './styles.css'

const el = document.getElementById('root')
if (!el) throw new Error('عنصر root پیدا نشد')
createRoot(el).render(<LicenseGate>{(license) => <App license={license} />}</LicenseGate>)
