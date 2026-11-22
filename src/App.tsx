import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './components/StoreProvider';
import { CreateRoundPage } from './pages/CreateRoundPage';
import { GuestRoundPage } from './pages/GuestRoundPage';
import { HostRoundPage } from './pages/HostRoundPage';

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CreateRoundPage />} />
          <Route path="/w/:roundId" element={<GuestRoundPage />} />
          <Route path="/h/:hostToken" element={<HostRoundPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
