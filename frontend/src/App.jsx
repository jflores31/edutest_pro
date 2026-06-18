import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { getStudentToken } from './services/api'
import { Center, Spinner } from './components/ui'
import { AppShell } from './layout/AppShell'

import LoginPage from './app/teacher/LoginPage'
import DashboardPage from './app/teacher/DashboardPage'
import ExamsPage from './app/teacher/ExamsPage'
import ExamEditPage from './app/teacher/ExamEditPage'
import BankPage from './app/teacher/BankPage'
import StudentsPage from './app/teacher/StudentsPage'
import StudentDetailPage from './app/teacher/StudentDetailPage'
import ImportPage from './app/teacher/ImportPage'
import MonitoringPage from './app/teacher/MonitoringPage'
import ComparePage from './app/teacher/ComparePage'
import AttemptDetailPage from './app/teacher/AttemptDetailPage'
import SettingsPage from './app/teacher/SettingsPage'

import StudentLoginPage from './app/student/StudentLoginPage'
import ExamRunPage from './app/student/ExamRunPage'
import StudentResultsPage from './app/student/StudentResultsPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Center className="min-h-screen"><Spinner size={28} /></Center>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function StudentRouteGuard({ children }) {
  const { slug } = useParams()
  if (!getStudentToken()) return <Navigate to={`/exam/${slug}`} replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/teacher/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Student exam flow (public entry) */}
      <Route path="/exam/:slug" element={<StudentLoginPage />} />
      <Route path="/exam/:slug/run" element={<StudentRouteGuard><ExamRunPage /></StudentRouteGuard>} />
      <Route path="/exam/:slug/results" element={<StudentResultsPage />} />

      {/* Teacher / Admin */}
      <Route path="/teacher" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="exams/new" element={<ExamEditPage />} />
        <Route path="exams/:id/edit" element={<ExamEditPage />} />
        <Route path="bank" element={<BankPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="attempts/:id" element={<AttemptDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/teacher/dashboard" replace />} />
    </Routes>
  )
}
