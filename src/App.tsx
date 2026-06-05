import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './i18n'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Improvements from './pages/Improvements'
import ImprovementForm from './pages/ImprovementForm'
import ImprovementDetail from './pages/ImprovementDetail'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'
import Users from './pages/Users'
import Awards from './pages/Awards'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/improvements" element={<Improvements />} />
          <Route path="/improvements/new" element={<ImprovementForm />} />
          <Route path="/improvements/:id" element={<ImprovementDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/awards" element={<Awards />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/users" element={<Users />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
