import { Suspense, lazy } from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import LoadingState from '@/components/common/LoadingState'
import AuthLayout from '@/layouts/AuthLayout'
import MainLayout from '@/layouts/MainLayout'
import ProtectedRoute from './ProtectedRoute'
import PublicOnlyRoute from './PublicOnlyRoute'

// Code-split per route (NFR: TTI < 3s on 4G).
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const TeamPage = lazy(() => import('@/pages/TeamPage'))
const SessionsPage = lazy(() => import('@/pages/SessionsPage'))
const FoodPage = lazy(() => import('@/pages/FoodPage'))
const MealLibraryPage = lazy(() => import('@/pages/MealLibraryPage'))
const MealPlanPage = lazy(() => import('@/pages/MealPlanPage'))
const RecordPage = lazy(() => import('@/pages/RecordPage'))
const PlanPage = lazy(() => import('@/pages/PlanPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

const router = createBrowserRouter([
  {
    element: (
      <PublicOnlyRoute>
        <AuthLayout />
      </PublicOnlyRoute>
    ),
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/team', element: <TeamPage /> },
      { path: '/sessions', element: <SessionsPage /> },
      { path: '/food', element: <FoodPage /> },
      { path: '/food/library', element: <MealLibraryPage /> },
      { path: '/food/plan', element: <MealPlanPage /> },
      { path: '/record', element: <RecordPage /> },
      { path: '/plan', element: <PlanPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<LoadingState fullScreen />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
])

export default function AppRoutes() {
  return <RouterProvider router={router} />
}
