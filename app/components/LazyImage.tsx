"use client";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  fill?: boolean;
  sizes?: string;
}

export default function LazyImage({ 
  src, 
  alt, 
  width = 200, 
  height = 200, 
  className = "",
  priority = false,
  fill = false,
  sizes
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer로 뷰포트 진입 감지
  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "50px", // 50px 전에 미리 로딩
        threshold: 0.1
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setError(true);
    setIsLoaded(true);
  };

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {/* 로딩 스켈레톤 */}
      {!isLoaded && (
        <div className={`animate-pulse bg-coffee-medium rounded-xl ${fill ? 'absolute inset-0' : `w-full h-${height}`}`}>
          <div className="flex items-center justify-center h-full">
            <div className="text-coffee-light opacity-50 text-2xl">☕</div>
          </div>
        </div>
      )}

      {/* 실제 이미지 */}
      {isInView && (
        <Image
          src={error ? "/images/coffee-placeholder.svg" : src}
          alt={alt}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          fill={fill}
          sizes={sizes}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${fill ? 'object-cover' : 'w-full h-48 object-cover rounded-xl'}`}
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? "eager" : "lazy"}
          priority={priority}
        />
      )}

      {/* 에러 시 기본 이미지 */}
      {error && isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-coffee-medium rounded-xl">
          <div className="text-center text-coffee-light opacity-70">
            <div className="text-3xl mb-2">📷</div>
            <div className="text-sm">이미지 로딩 실패</div>
          </div>
        </div>
      )}
    </div>
  );
}