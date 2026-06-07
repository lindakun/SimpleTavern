/**
 * 懒加载图片组件
 *
 * 功能:
 * - 图片懒加载（Intersection Observer）
 * - 加载前 shimmer 占位 → 加载后渐显
 * - 加载失败 fallback
 * - CLS 优化（aspect-ratio 占位）
 */

import { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  fallbackSrc?: string;
  /** 显式宽高比，用于 CLS 优化，如 "4/3" "1/1" */
  aspectRatio?: string;
  /** 占位背景色（角色 avatarColor） */
  placeholderColor?: string;
}

const DEFAULT_FALLBACK = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%231a1a2e" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23666" font-size="14"%3E?%3C/text%3E%3C/svg%3E';

export default function LazyImage({
  src,
  alt,
  className = '',
  referrerPolicy = 'no-referrer',
  fallbackSrc = DEFAULT_FALLBACK,
  aspectRatio,
  placeholderColor,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer 实现懒加载
  useEffect(() => {
    const element = imgRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px',
        threshold: 0.01,
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleLoad = () => setIsLoaded(true);
  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  return (
    <div
      ref={imgRef}
      className="relative overflow-hidden"
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* 加载前占位：shimmer 骨架 或 纯色背景 */}
      {!isLoaded && isInView && (
        <div
          className="absolute inset-0 skeleton-shimmer"
          style={placeholderColor ? { backgroundColor: placeholderColor } : undefined}
        />
      )}

      {/* 实际图片 */}
      {isInView && (
        <img
          src={hasError ? fallbackSrc : src}
          alt={alt}
          referrerPolicy={referrerPolicy}
          onLoad={handleLoad}
          onError={handleError}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
          loading="lazy"
        />
      )}

      {/* 加载失败提示 */}
      {hasError && isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-container/80">
          <span className="text-xs text-on-surface-variant">加载失败</span>
        </div>
      )}
    </div>
  );
}

// 头像专用懒加载组件（圆形）
interface LazyAvatarProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  placeholderColor?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export function LazyAvatar({ src, alt, size = 'md', className = '', placeholderColor }: LazyAvatarProps) {
  return (
    <LazyImage
      src={src}
      alt={alt}
      className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      placeholderColor={placeholderColor}
    />
  );
}
