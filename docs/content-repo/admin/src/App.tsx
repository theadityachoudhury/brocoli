import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PostEditor from './pages/PostEditor';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 px-6 py-4">
          <Link to="/" className="text-lg font-semibold text-zinc-100 hover:text-blue-400 transition-colors">
            blog admin
          </Link>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<PostEditor />} />
            <Route path="/edit/:slug" element={<PostEditor />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
