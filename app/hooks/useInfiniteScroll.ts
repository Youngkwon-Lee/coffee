"use client";
import { useState, useEffect, useCallback } from 'react';

interface UseInfiniteScrollProps<T> {
  items: T[];
  initialItemsPerPage?: number;
  threshold?: number;
}

export function useInfiniteScroll<T>({ 
  items, 
  initialItemsPerPage = 12,
  threshold = 100 
}: UseInfiniteScrollProps<T>) {
  const [displayedItems, setDisplayedItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // 아이템이 변경되면 초기화
  useEffect(() => {
    const initialItems = items.slice(0, initialItemsPerPage);
    setDisplayedItems(initialItems);
    setHasMore(items.length > initialItemsPerPage);
  }, [items, initialItemsPerPage]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    
    // 시뮬레이션된 로딩 딜레이 (실제 API에서는 제거)
    setTimeout(() => {
      const currentLength = displayedItems.length;
      const nextItems = items.slice(currentLength, currentLength + initialItemsPerPage);
      
      setDisplayedItems(prev => [...prev, ...nextItems]);
      setHasMore(currentLength + nextItems.length < items.length);
      setIsLoading(false);
    }, 300);
  }, [items, displayedItems.length, initialItemsPerPage, isLoading, hasMore]);

  // 스크롤 감지
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop 
        >= document.documentElement.offsetHeight - threshold
      ) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore, threshold]);

  const resetItems = useCallback(() => {
    const initialItems = items.slice(0, initialItemsPerPage);
    setDisplayedItems(initialItems);
    setHasMore(items.length > initialItemsPerPage);
    setIsLoading(false);
  }, [items, initialItemsPerPage]);

  return {
    displayedItems,
    hasMore,
    isLoading,
    loadMore,
    resetItems
  };
}