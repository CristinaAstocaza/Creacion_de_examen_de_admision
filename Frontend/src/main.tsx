import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Iconos empaquetados localmente (el sistema funciona sin internet)
import 'material-icons/iconfont/outlined.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
