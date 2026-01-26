import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Inspection from './pages/Inspection';
import Repair from './pages/Repair';
import DetailRepair from './pages/DetailRepair';
import RepairSummary from './pages/RepairSummary';
import Tire from './pages/Tire';
import Photo from './pages/Photo';
import Layout from './components/Layout';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/inspection"
            element={
              <ProtectedRoute>
                <Layout>
                  <Inspection />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/repair"
            element={
              <ProtectedRoute>
                <Layout>
                  <Repair />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/repair/:code"
            element={
              <ProtectedRoute>
                <Layout>
                  <DetailRepair />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/repair-summary"
            element={
              <ProtectedRoute>
                <Layout>
                  <RepairSummary />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tire"
            element={
              <ProtectedRoute>
                <Layout>
                  <Tire />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/photo"
            element={
              <ProtectedRoute>
                <Layout>
                  <Photo />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/repair" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
