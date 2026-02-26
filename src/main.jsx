import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { startWebVitalsObserver } from './services/webVitalsService'
import './styles/global.css'

if (import.meta.env.DEV) {
  startWebVitalsObserver()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
