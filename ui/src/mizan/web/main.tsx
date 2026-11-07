import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import '../../theme' // side-effect: resolve persisted mode + palette pair on <html>
import { MizanWebApp } from './MizanWebApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MizanWebApp />
  </StrictMode>,
)
