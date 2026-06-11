import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenId } from '../types';
import { registerServiceWorker } from '../sw-register';
import { registerUnauthorizedCallback } from '../api/client';
import { initAnalytics, trackPageView } from '../utils/analytics';
import { useCurrentUser } from './useAuth';
import { useChatStore } from '../stores/chatStore';
import { SCREEN_PATHS, pathToScreen } from '../routes';

export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const currentScreen = pathToScreen(location.pathname);

  // ── Side effects ──
  useEffect(() => { registerServiceWorker(); }, []);
  useEffect(() => { initAnalytics(); }, []);

  // ── User state ──
  const { data: currentUser, isFetched } = useCurrentUser();
  const user = currentUser
    ? { username: currentUser.handle, email: `${currentUser.handle}@yuzu.ai` }
    : null;
  const prevUserRef = useRef(user);

  // ── 401 global callback ──
  useEffect(() => {
    registerUnauthorizedCallback(() => {
      queryClient.clear();
      useChatStore.getState().clearChatThreads();
      useChatStore.getState().resetLoaded();
      navigate('/', { replace: true });
    });
  }, [queryClient, navigate]);

  // ── Auth guard ──
  useEffect(() => {
    const publicScreens: ScreenId[] = [
      ScreenId.WELCOME, ScreenId.LOGIN, ScreenId.REGISTER,
      ScreenId.FORGOT_PASSWORD, ScreenId.RESET_PASSWORD,
    ];
    const wasLoggedIn = prevUserRef.current !== null;
    prevUserRef.current = user;

    if (wasLoggedIn && !user && currentScreen && !publicScreens.includes(currentScreen)) {
      navigate('/', { replace: true });
    }
  }, [user, currentScreen, navigate]);

  // ── Initial route ──
  const didInitRoute = useRef(false);
  useEffect(() => {
    if (!isFetched || didInitRoute.current) return;
    didInitRoute.current = true;
    if (currentUser) {
      navigate('/discover', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [isFetched, currentUser, navigate]);

  // ── Splash Screen ──
  const [splashComplete, setSplashComplete] = useState(false);
  const handleSplashComplete = useCallback(() => setSplashComplete(true), []);

  // ── Navigation helpers ──
  const handleNavigate = useCallback((screen: ScreenId) => {
    const path = SCREEN_PATHS[screen];
    trackPageView(screen);
    navigate(path);
  }, [navigate]);

  const handleGoBack = useCallback((_fallback: ScreenId) => {
    navigate(-1);
  }, [navigate]);

  return {
    currentScreen,
    isFetched,
    user,
    splashComplete,
    handleSplashComplete,
    handleNavigate,
    handleGoBack,
  };
}
