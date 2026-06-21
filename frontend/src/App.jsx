import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './layout';
import { ToastProvider } from './features/toast/ToastProvider';
import { StudentRouteGuard, ResultsGuard } from './components/StudentRouteGuard';

// Teacher pages
import LoginPage from './app/teacher/LoginPage';
import DashboardPage from './app/teacher/DashboardPage';
import ExamsListPage from './app/teacher/ExamsListPage';
import ExamEditorPage from './app/teacher/ExamEditorPage';
import QuestionBankPage from './app/teacher/QuestionBankPage';
import StudentsListPage from './app/teacher/StudentsListPage';
import StudentProfilePage from './app/teacher/StudentProfilePage';
import ImportPage from './app/teacher/ImportPage';
import MonitoringPage from './app/teacher/MonitoringPage';
import ComparePage from './app/teacher/ComparePage';
import SettingsPage from './app/teacher/SettingsPage';
import AttemptDetailPage from './app/teacher/AttemptDetailPage';

// Student pages
import StudentLoginPage from './app/student/StudentLoginPage';
import ExamRunPage from './app/student/ExamRunPage';
import StudentResultsPage from './app/student/StudentResultsPage';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
          <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Student routes — StudentRouteGuard validates attempt_token */}
          <Route path="/exam/:slug" element={<StudentLoginPage />} />
          <Route path="/exam/:slug/run" element={
            <StudentRouteGuard><ExamRunPage /></StudentRouteGuard>
          } />
          <Route path="/exam/:slug/results" element={
            <ResultsGuard><StudentResultsPage /></ResultsGuard>
          } />

          {/* Teacher routes — AppShell checks role */}
          <Route element={<AppShell />}>
            <Route path="/teacher/dashboard" element={<DashboardPage />} />
            <Route path="/teacher/exams" element={<ExamsListPage />} />
            <Route path="/teacher/exams/new" element={<ExamEditorPage />} />
            <Route path="/teacher/exams/:id/edit" element={<ExamEditorPage />} />
            <Route path="/teacher/bank" element={<QuestionBankPage />} />
            <Route path="/teacher/students" element={<StudentsListPage />} />
            <Route path="/teacher/students/:id" element={<StudentProfilePage />} />
            <Route path="/teacher/import" element={<ImportPage />} />
            <Route path="/teacher/monitoring" element={<MonitoringPage />} />
            <Route path="/teacher/compare" element={<ComparePage />} />
            <Route path="/teacher/attempts/:id" element={<AttemptDetailPage />} />
            <Route path="/teacher/settings" element={<SettingsPage />} />
          </Route>

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/teacher/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/teacher/dashboard" replace />} />
        </Routes>
        </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}