import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { readRoute } from './route.ts'
import { useGame } from './store.ts'

// Read once: a change of fragment reloads the page
const route = readRoute(location.hash)
// Before anything renders, so the title card greets the recipient from its first frame
if (route.page === 'gift') useGame.getState().openGift(route.gift)

// App wraps all but the leva panel in StrictMode itself
createRoot(document.getElementById('root')!).render(<App route={route} />)
