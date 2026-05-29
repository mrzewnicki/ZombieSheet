import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import SignIn from '@/pages/SignIn'
import Dashboard from '@/pages/Dashboard'
import CreateGame from '@/pages/CreateGame'
import GameLobby from '@/pages/GameLobby'
import JoinGame from '@/pages/JoinGame'
import CreateHero from '@/pages/hero/CreateHero'
import HeroSheet from '@/pages/hero/HeroSheet'
import PersonalTab from '@/pages/hero/PersonalTab'
import MechanicsTab from '@/pages/hero/MechanicsTab'
import InventoryTab from '@/pages/hero/InventoryTab'
import HistoryTab from '@/pages/hero/HistoryTab'
import ImagesTab from '@/pages/hero/ImagesTab'
import SettingsTab from '@/pages/hero/SettingsTab'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<SignIn />} />
          <Route path="/game/:gameId/invite/:token" element={<JoinGame />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/game/new" element={<CreateGame />} />
            <Route path="/game/:gameId" element={<GameLobby />} />
            <Route path="/game/:gameId/hero/new" element={<CreateHero />} />
            <Route path="/game/:gameId/hero/:heroId" element={<HeroSheet />}>
              <Route index element={<Navigate to="personal" replace />} />
              <Route path="personal"  element={<PersonalTab />} />
              <Route path="mechanics" element={<MechanicsTab />} />
              <Route path="inventory" element={<InventoryTab />} />
              <Route path="images"    element={<ImagesTab />} />
              <Route path="history"   element={<HistoryTab />} />
              <Route path="settings" element={<SettingsTab />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
