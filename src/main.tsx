import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/inter/wght-italic.css'
import '@fontsource-variable/caveat/wght.css'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/700.css'
import '@fontsource/courier-prime/400-italic.css'
import '@fontsource/courier-prime/700-italic.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/ui.css'
import './styles/screens.css'
import './styles/format.css'
import './styles/objects.css'
import './styles/sidebar.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
