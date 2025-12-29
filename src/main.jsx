import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Note: StrictMode temporarily disabled to work around react-chessboard position update bug
// See: https://github.com/Clariity/react-chessboard/issues/119
createRoot(document.getElementById('root')).render(
  <App />,
)
