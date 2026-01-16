import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { PMFProvider } from './context/PMFContext'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PMFProvider>
        <App />
      </PMFProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
