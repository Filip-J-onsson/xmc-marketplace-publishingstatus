import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import sitecoreTheme, { toastOptions } from '@sitecore/blok-theme'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider theme={sitecoreTheme} toastOptions={toastOptions}>
      <App />
    </ChakraProvider>
  </StrictMode>,
)
