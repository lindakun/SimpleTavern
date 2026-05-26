import React from 'react';
import { ScreenId } from '../types';
import { Mail } from 'lucide-react';

interface WelcomeScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export default function WelcomeScreen({ onNavigate }: WelcomeScreenProps) {
  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-background-deep p-6">
      {/* Glow Rings */}
      <div className="absolute -top-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full bg-accent-pink opacity-15 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-1/4 -right-1/4 w-[60vw] h-[60vw] rounded-full bg-accent-purple opacity-15 blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center h-16 relative z-10">
        <div className="flex items-center gap-2.5">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNJkIhL5VgrhIzVuQ-pQ9KjmstVrmxacrtGuB0W8LG1Wuj4MsAGn2nzXGu37GIac8AMsRYcOSrQ_BDfkoOxhF0_SX5zJ9vH8F2UKfZuX97jvw5ZC877pAQelU8AKYQSJKeSw49A3iQEM_3kaz6lGI4QuKTsB2J7p5GIVykxFsz_YHCd4FJ8Vos12aPC8BXhAOK86roItVXfexuUZM7tBC73wfLoRPLcCRbsfxlOWSwDiq5jkoo4VyvLzbLti0o-zgXjsJkOZV8JQ"
            alt="Yuzu AI Logo"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full border border-accent-pink/40 object-cover shadow-[0_0_10px_rgba(232,121,199,0.3)] animate-pulse"
          />
          <span className="font-headline-lg-mobile text-2xl font-extrabold bg-gradient-to-r from-accent-pink to-accent-purple bg-clip-text text-transparent">
            Yuzu AI
          </span>
        </div>
      </header>

      {/* Hero Visual Area */}
      <div className="flex-1 flex flex-col justify-center items-center max-w-md mx-auto w-full relative z-10 gap-8 my-4">
        <div className="relative w-full aspect-[4/5] rounded-[32px] overflow-hidden shadow-[0_0_80px_rgba(232,121,199,0.15)] group transition-all duration-500">
          <img
            alt="Yuzu AI Avatar Header"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transform scale-105 group-hover:scale-100 transition-transform duration-700"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBfjryuD8BX6GcV9fuijJ1-OdSEI2mNo_ow_WJczWyOqCvA5vmYEWFa76u64k1aBNu2ZH4ZpSu7M3KgCHwhiDVkXskWCKHDi0xwEqbqrsH76DLUpJuRd0dLc3JVcwocl5A3-dwvHpx0wVOh43HrF5Dw1x1QopgavBkOFyHp0SKXLi81J3-KVo5GDqAhTQ-cuoM3SWoo4hyA5wQr_ziEoCVK1ifkWTrAAc5dtTxLot5k1b_TS3sdlMeF_19PkDceAsMfrTXsgR0a_w"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background-deep via-transparent to-transparent opacity-60" />
          
          {/* Subtle Cyber Status Tag over avatar */}
          <div className="absolute top-4 right-4 px-3 py-1 bg-surface-elevated/80 border border-accent-pink/30 rounded-full flex items-center gap-2 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-accent-pink animate-pulse" />
            <span className="text-[10px] uppercase font-bold text-accent-pink tracking-widest font-mono">NEON_V2.0</span>
          </div>
        </div>

        {/* Brand slogan */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-3 tracking-tight text-white leading-tight font-headline-lg">
            Explore the <span className="text-accent-pink animate-pulse">Neon</span> Frontier
          </h1>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto">
            Interact with high-fidelity AI personalities in an immersive cyberpunk landscape.
          </p>
        </div>

        {/* Active connection controls */}
        <div className="w-full space-y-4">
          {/* Google Sign In - Triggers Discover view (push transition mapped) */}
          <button
            id="btn_google_signin"
            onClick={() => onNavigate(ScreenId.DISCOVER)}
            className="w-full h-14 flex items-center justify-center gap-3 bg-gradient-to-r from-accent-pink to-accent-purple text-white rounded-xl font-semibold shadow-[0_4px_25px_rgba(232,121,199,0.35)] active:scale-95 hover:brightness-110 transition-all duration-200 cursor-pointer"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="currentColor"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="currentColor"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="currentColor"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                fill="currentColor"
              />
            </svg>
            <span className="text-sm font-semibold tracking-wide">Sign in with Google</span>
          </button>

          {/* Email Access - Triggers Email Connection view */}
          <button
            id="btn_email_login"
            onClick={() => onNavigate(ScreenId.EMAIL_LOGIN)}
            className="w-full h-14 flex items-center justify-center gap-3 bg-surface-container border border-accent-pink/20 hover:border-accent-pink/50 text-white rounded-xl active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <Mail className="w-5 h-5 text-accent-pink" />
            <span className="text-sm font-semibold tracking-wide">Login with Email</span>
          </button>

          {/* Account Registry redirect - Triggers register account view */}
          <div className="pt-3 text-center">
            <button
              id="btn_to_register"
              onClick={() => onNavigate(ScreenId.REGISTER)}
              className="text-sm text-on-surface-variant hover:text-accent-pink transition-colors cursor-pointer group"
            >
              New here?{' '}
              <span className="text-accent-pink font-bold border-b border-transparent group-hover:border-accent-pink/50 pb-0.5 ml-1">
                Create an Account
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-4 text-center z-10 relative">
        <p className="text-xs text-on-surface-variant/60 max-w-xs mx-auto leading-relaxed">
          By continuing, you agree to our{' '}
          <a className="underline text-on-surface-variant/80 hover:text-accent-pink transition-colors" href="#terms">
            Terms
          </a>{' '}
          and{' '}
          <a className="underline text-on-surface-variant/80 hover:text-accent-pink transition-colors" href="#privacy">
            Privacy Policy
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
