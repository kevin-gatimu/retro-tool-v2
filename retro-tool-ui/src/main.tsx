import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
import { RealtimeProviders } from './lib/realtime-providers'
import './styles.css'

const router = getRouter()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <RealtimeProviders>
        <RouterProvider router={router} />
      </RealtimeProviders>
    </StrictMode>,
  )
}
