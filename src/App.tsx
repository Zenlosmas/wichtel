import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Music } from './components/Music';
import { StoreProvider } from './components/StoreProvider';
import { CreateRoundPage } from './pages/CreateRoundPage';
import { GuestRoundPage } from './pages/GuestRoundPage';
import { HostRoundPage } from './pages/HostRoundPage';

export default function App() {
  // HashRouter, weil GitHub Pages jeden Pfad ohne eigene Datei mit HTTP 404
  // beantwortet. Mit "#/w/abc" antwortet jeder Link mit 200. Kein basename:
  // der Pfad steckt bei Hash-Routing nicht in der Route, sondern davor.
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<CreateRoundPage />} />
          <Route path="/w/:roundId" element={<GuestRoundPage />} />
          <Route path="/h/:hostToken" element={<HostRoundPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Music />
      </HashRouter>
    </StoreProvider>
  );
}
