/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AutoReloadManager } from './components/AutoReloadManager';
import { useAutoUpdateWatcher } from './hooks/useAutoUpdateWatcher';
import WebNotificationPromptModal from './components/modals/WebNotificationPromptModal';
import { useCustomerRealtimeNotificationListener } from './components/chat/CustomerChatBox';

const ExistingCatalogView = lazy(() => import("./components/products/ExistingCatalogView"));
const CustomerPortal = lazy(() => import('./components/customer/CustomerPortal').then(m => ({ default: m.CustomerPortal })));
const AdminPortal = lazy(() => import('./components/admin/AdminPortal').then(m => ({ default: m.AdminPortal })));
const VerifyEmailPage = lazy(() => import('./components/auth/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const ResetPasswordPage = lazy(() => import('./components/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));

function MainAppRouter() {
  const { currentUser, authLoading } = useApp();
  const [isVerifyRoute, setIsVerifyRoute] = useState(false);
  const [isResetPasswordRoute, setIsResetPasswordRoute] = useState(false);
  const [isLoginRoute, setIsLoginRoute] = useState(false);

  useEffect(() => {
    const checkRoute = () => {
      const pathname = window.location.pathname;
      const search = window.location.search;
      
      if (pathname === '/login' || pathname === '/login/') {
        setIsLoginRoute(true);
      } else {
        setIsLoginRoute(false);
      }

      // Check for Reset Password Route
      if (
        pathname.includes('/auth/reset-password') ||
        pathname.includes('/reset-password') ||
        (search.includes('mode=resetPassword') && (search.includes('oobCode=') || search.includes('code=')))
      ) {
        setIsResetPasswordRoute(true);
        setIsVerifyRoute(false);
        setIsLoginRoute(false);
        return;
      }
      setIsResetPasswordRoute(false);

      // Check for Verify Email Route
      if (
        pathname.includes('/auth/verify-email') || 
        pathname.includes('/verify-email') || 
        (search.includes('oobCode=') && (search.includes('mode=verifyEmail') || search.includes('email=')))
      ) {
        setIsVerifyRoute(true);
      } else {
        setIsVerifyRoute(false);
      }
    };

    checkRoute();
    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  if (isLoginRoute) {
    return <LoginPage />;
  }

  if (isResetPasswordRoute) {
    return (
      <ResetPasswordPage 
        onBackToHome={() => {
          window.history.pushState({}, '', '/');
          setIsResetPasswordRoute(false);
        }}
      />
    );
  }

  if (isVerifyRoute) {
    return (
      <VerifyEmailPage 
        onBackToHome={() => {
          window.history.pushState({}, '', '/');
          setIsVerifyRoute(false);
        }} 
      />
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-[#0B0F19] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs text-slate-400 font-semibold animate-pulse">Memuat Sesi Pengguna...</p>
      </div>
    );
  }

  if (currentUser && currentUser.isBanned) {
    return (
      <div className="min-h-screen w-full bg-[#0B0F19] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/90 border border-blue-500/30 p-6 rounded-2xl text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">🚫</span>
          </div>
          <h2 className="text-xl font-black text-blue-400">AKUN ANDA DIBLOKIR</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Akses ke Entong Store telah dibatasi karena pelanggaran terhadap kebijakan layanan atau tindakan spam order secara berulang.
          </p>
          <p className="text-xs text-slate-400">
            Jika ini adalah sebuah kesalahan, hubungi Admin.
          </p>
          <a
            href="https://www.sientong.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-5 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 rounded-xl text-sm font-bold mt-4"
          >
            Hubungi Admin
          </a>
        </div>
      </div>
    );
  }

  const userRoleUpper = (currentUser?.role || '').toString().toUpperCase();
  // Hanya ADMIN, OWNER, dan WORKER yang boleh masuk AdminPortal
  // STAFF, OPERATOR, dan customer biasa diarahkan ke CustomerPortal
  const isStaffUser = Boolean(
    currentUser && (
      ['ADMIN', 'OWNER', 'WORKER'].includes(userRoleUpper)
    )
  );

  return (
    <div className="min-h-screen w-full max-w-full bg-[#0B0F19] text-slate-100 font-sans relative">
      {isStaffUser ? (
        <AdminPortal />
      ) : (
        <CustomerPortal />
      )}
    </div>
  );
}

function CustomerNotificationBridge() {
  useCustomerRealtimeNotificationListener();
  return null;
}

export default function App() {
  useAutoUpdateWatcher();

  return (
    <ErrorBoundary>
      <AutoReloadManager />
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
              Memuat Entong Store...
            </span>
          </div>
        }
      >
        <AppProvider>
          <CustomerNotificationBridge />
          <WebNotificationPromptModal />
          <BrowserRouter>
            <Routes>
              <Route path="/gpdragdrivesim" element={<ExistingCatalogView categoryType="GP_DRAGDRIVE" />} />
              <Route path="/gpcdid" element={<ExistingCatalogView categoryType="GP_CDID" />} />
              <Route path="/jokidds" element={<ExistingCatalogView categoryType="JOKI_DRAGDRIVE" />} />
              <Route path="/jokicdid" element={<ExistingCatalogView categoryType="JOKI_CDID" />} />
              <Route path="/gpdragdrivesimulator" element={<Navigate replace to="/gpdragdrivesim" />} />
              <Route path="/cardrivingindonesia" element={<Navigate replace to="/gpcdid" />} />
              <Route path="/catalog" element={<Navigate replace to="/gpdragdrivesim" />} />
              <Route path="*" element={<MainAppRouter />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

