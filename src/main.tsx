import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// App wraps all but the leva panel in StrictMode itself
createRoot(document.getElementById('root')!).render(<App />)
