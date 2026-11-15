import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/components/AdminLayout';
import { RequireAdmin, RequireAuth, RequireStaff } from '@/components/Guards';
import { PublicLayout } from '@/components/PublicLayout';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { EventPage } from '@/pages/EventPage';
import { EventsPage } from '@/pages/EventsPage';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OrderPage } from '@/pages/OrderPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { BookingsPage } from '@/pages/admin/BookingsPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { EventAdminPage } from '@/pages/admin/EventAdminPage';
import { EventsAdminPage } from '@/pages/admin/EventsAdminPage';
import { NewEventPage } from '@/pages/admin/NewEventPage';
import { OrdersPage } from '@/pages/admin/OrdersPage';
import { PerformersPage } from '@/pages/admin/PerformersPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { VenuesPage } from '@/pages/admin/VenuesPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<HomePage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="events/:id" element={<EventPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route
                path="orders/:id"
                element={
                  <RequireAuth>
                    <OrderPage />
                  </RequireAuth>
                }
              />
              <Route
                path="profile"
                element={
                  <RequireAuth>
                    <ProfilePage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route
              path="admin"
              element={
                <RequireStaff>
                  <AdminLayout />
                </RequireStaff>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="events" element={<EventsAdminPage />} />
              <Route path="events/new" element={<NewEventPage />} />
              <Route path="events/:id" element={<EventAdminPage />} />
              <Route path="performers" element={<PerformersPage />} />
              <Route path="venues" element={<VenuesPage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route
                path="users"
                element={
                  <RequireAdmin>
                    <UsersPage />
                  </RequireAdmin>
                }
              />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
