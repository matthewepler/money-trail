import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireSession } from './components/RequireSession.js';
import { SessionGate } from './components/SessionGate.js';
import { SessionProvider } from './components/SessionProvider.js';
import { Shell } from './components/Shell.js';
import { LoginScreen } from './routes/Login/LoginScreen.js';
import { SummaryScreen } from './routes/Summary/SummaryScreen.js';
import { TransactionsScreen } from './routes/Transactions/TransactionsScreen.js';

export function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route element={<SessionGate />}>
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<RequireSession />}>
            <Route element={<Shell />}>
              <Route index element={<TransactionsScreen />} />
              <Route path="summary" element={<SummaryScreen />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  );
}
