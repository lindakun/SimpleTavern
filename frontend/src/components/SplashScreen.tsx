import { useEffect, useState, useRef } from 'react';

interface SplashScreenProps {
  /** 最小显示时长（毫秒），确保品牌动画完整展示 */
  minDuration?: number;
  /** 是否就绪（如数据加载完成），就绪后自动淡出 */
  ready?: boolean;
  /** 淡出完成后的回调 */
  onComplete?: () => void;
}

export default function SplashScreen({
  minDuration = 1200,
  ready = false,
  onComplete,
}: SplashScreenProps) {
  const [phase, setPhase] = useState<'entering' | 'active' | 'exiting' | 'done'>('entering');
  // 用 ref 保存 onComplete 避免 useEffect 因引用变化重新执行
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // 入场动画: 短暂延迟后进入 active
  useEffect(() => {
    const t = setTimeout(() => setPhase('active'), 100);
    return () => clearTimeout(t);
  }, []);

  // 最小显示时长计时器
  const [canExit, setCanExit] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCanExit(true), minDuration);
    return () => clearTimeout(t);
  }, [minDuration]);

  // 当 ready + canExit 同时满足时，触发退出
  useEffect(() => {
    if (ready && canExit && phase === 'active') {
      setPhase('exiting');
    }
  }, [ready, canExit, phase]);

  // 退出动画完成后回调（独立 effect，兼容 React StrictMode 双调用）
  useEffect(() => {
    if (phase === 'exiting') {
      const t = setTimeout(() => {
        setPhase('done');
        onCompleteRef.current?.();
      }, 400); // 匹配 CSS 淡出动画时长
      return () => clearTimeout(t);
    }
    return;
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#090A0F] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-400 ${
        phase === 'exiting' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* 背景光晕 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[400px] max-h-[400px] rounded-full bg-accent-pink/8 blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[30vw] h-[30vw] max-w-[200px] max-h-[200px] rounded-full bg-accent-purple/6 blur-[100px] pointer-events-none"
        style={{ animationDelay: '300ms' }}
      />

      {/* Logo 容器 */}
      <div
        className={`relative transition-all duration-600 ease-out ${
          phase === 'entering'
            ? 'opacity-0 scale-90 translate-y-4'
            : 'opacity-100 scale-100 translate-y-0'
        }`}
      >
        {/* 外层霓虹光晕 */}
        <div className="absolute inset-0 rounded-full bg-accent-pink/20 blur-2xl animate-pulse scale-150" />

        {/* Logo 图片 */}
        <div className="relative w-20 h-20 rounded-full border-2 border-accent-pink/50 overflow-hidden shadow-[0_0_40px_rgba(232,121,199,0.3)]">
          <img
            src="/yuzuai_logo.png"
            alt="Yuzu AI"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            width={80}
            height={80}
          />
        </div>

        {/* 扫描线效果 */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent-pink/60 to-transparent"
          style={{
            animation: 'splash-scan 2s ease-in-out infinite',
            filter: 'blur(1px)',
          }}
        />
      </div>

      {/* 品牌名称 */}
      <h1
        className={`mt-6 font-headline-lg text-3xl font-extrabold bg-gradient-to-r from-accent-pink via-[#ffade2] to-accent-purple bg-clip-text text-transparent transition-all duration-600 ease-out delay-150 ${
          phase === 'entering' ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
        }`}
      >
        Yuzu AI
      </h1>

      {/* 品牌标语 */}
      <p
        className={`mt-3 text-xs text-on-surface-variant/60 font-mono tracking-widest transition-all duration-600 ease-out delay-300 ${
          phase === 'entering' ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
        }`}
      >
        连接神经矩阵中<span className="inline-block animate-pulse">...</span>
      </p>

      {/* 底部状态线 */}
      <div
        className={`absolute bottom-12 flex items-center gap-2 transition-all duration-600 ease-out delay-500 ${
          phase === 'entering' ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-accent-pink animate-pulse" />
        <span className="text-[10px] text-on-surface-variant/40 font-mono tracking-widest">
          NEURAL_CORE_STREAM_ACTIVE
        </span>
      </div>
    </div>
  );
}
