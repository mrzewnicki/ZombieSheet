import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import AppShell from '@/components/layout/AppShell'
import GameShell from '@/components/layout/GameShell'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import SignIn from '@/pages/SignIn'
import Dashboard from '@/pages/Dashboard'
import CreateGame from '@/pages/CreateGame'
import GameLobby from '@/pages/GameLobby'
import GameTraits from '@/pages/GameTraits'
import JoinGame from '@/pages/JoinGame'
import CreateHero from '@/pages/hero/CreateHero'
import HeroSheet from '@/pages/hero/HeroSheet'
import PersonalTab from '@/pages/hero/PersonalTab'
import MechanicsTab from '@/pages/hero/MechanicsTab'
import InventoryTab from '@/pages/hero/InventoryTab'
import CombatTab from '@/pages/hero/CombatTab'
import MutationsTab from '@/pages/hero/MutationsTab'
import HistoryTab from '@/pages/hero/HistoryTab'
import ImagesTab from '@/pages/hero/ImagesTab'
import SettingsTab from '@/pages/hero/SettingsTab'
import About from '@/pages/About'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.slice(0, -1)} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<SignIn />} />
          <Route path="/game/:gameId/invite/:token" element={<JoinGame />} />

          {/* App shell — public About + protected routes */}
          <Route element={<AppShell />}>
            <Route path="/about" element={<About />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/game/new" element={<CreateGame />} />

              {/* Game-scoped routes — GameShell provides chat sidebar when feature is enabled */}
              <Route path="/game/:gameId" element={<GameShell />}>
                <Route index element={<GameLobby />} />
                <Route path="traits" element={<GameTraits />} />
                <Route path="hero/new" element={<CreateHero />} />
                <Route path="hero/:heroId" element={<HeroSheet />}>
                  <Route index element={<Navigate to="personal" replace />} />
                  <Route path="personal"  element={<PersonalTab />} />
                  <Route path="mechanics" element={<MechanicsTab />} />
                  <Route path="inventory" element={<InventoryTab />} />
                  <Route path="mutations" element={<MutationsTab />} />
                  <Route path="combat"    element={<CombatTab />} />
                  <Route path="images"    element={<ImagesTab />} />
                  <Route path="history"   element={<HistoryTab />} />
                  <Route path="settings"  element={<SettingsTab />} />
                </Route>
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
