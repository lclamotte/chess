import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Home from './pages/Home';
import Live from './pages/Live';
import Analysis from './pages/Analysis';
import Stats from './pages/Stats';
import AuthCallback from './pages/AuthCallback';
import Recents from './pages/Recents';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/live" element={<Live />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/recents" element={<Recents />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
