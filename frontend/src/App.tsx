import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

// Pages are lazy-loaded so each route ships as its own chunk (smaller initial bundle).
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const ConfirmEmailPage = lazy(() => import('./pages/auth/ConfirmEmailPage'));

const LandingPage = lazy(() => import('./pages/LandingPage'));

const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const EventListPage = lazy(() => import('./pages/events/EventListPage'));
const EventDetailPage = lazy(() => import('./pages/events/EventDetailPage'));
const CreateEventPage = lazy(() => import('./pages/events/CreateEventPage'));
const EditEventPage = lazy(() => import('./pages/events/EditEventPage'));
const MyEventsPage = lazy(() => import('./pages/events/MyEventsPage'));

const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const EditProfilePage = lazy(() => import('./pages/profile/EditProfilePage'));
const PublicProfilePage = lazy(() => import('./pages/profile/PublicProfilePage'));

const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const NotificationPreferencesPage = lazy(() => import('./pages/notifications/NotificationPreferencesPage'));

const CommunityPage = lazy(() => import('./pages/CommunityPage'));

const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const ManageUsersPage = lazy(() => import('./pages/admin/ManageUsersPage'));
const ManageSportsPage = lazy(() => import('./pages/admin/ManageSportsPage'));
const ManageEventsPage = lazy(() => import('./pages/admin/ManageEventsPage'));
const ManageReportsPage = lazy(() => import('./pages/admin/ManageReportsPage'));
const AdminCreateEventPage = lazy(() => import('./pages/admin/AdminCreateEventPage'));

function PageFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress />
    </Box>
  );
}

function HomeRedirect() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <LandingPage />;
  return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      {/* Landing page for unauthenticated, dashboard for authenticated */}
      <Route path="/" element={<HomeRedirect />} />

      {/* Public auth routes — redirect to dashboard if already logged in */}
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
      <Route path="/reset-password" element={<GuestOnly><ResetPasswordPage /></GuestOnly>} />
      <Route path="/confirm-email" element={<ConfirmEmailPage />} />

      {/* Protected routes inside Layout */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Events */}
        <Route path="/events" element={<EventListPage />} />
        <Route path="/events/create" element={<CreateEventPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/events/:id/edit" element={<EditEventPage />} />
        <Route path="/my-events" element={<MyEventsPage />} />

        {/* Profile */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<EditProfilePage />} />
        <Route path="/users/:id" element={<PublicProfilePage />} />

        {/* Community */}
        <Route path="/community" element={<CommunityPage />} />

        {/* Notifications */}
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/notifications/preferences" element={<NotificationPreferencesPage />} />

        {/* Admin routes (also protected, adminOnly checked in components) */}
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboardPage /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute adminOnly><ManageUsersPage /></ProtectedRoute>} />
        <Route path="/admin/sports" element={<ProtectedRoute adminOnly><ManageSportsPage /></ProtectedRoute>} />
        <Route path="/admin/events" element={<ProtectedRoute adminOnly><ManageEventsPage /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute adminOnly><ManageReportsPage /></ProtectedRoute>} />
        <Route path="/admin/events/create" element={<ProtectedRoute adminOnly><AdminCreateEventPage /></ProtectedRoute>} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
