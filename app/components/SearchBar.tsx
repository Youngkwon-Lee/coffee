'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface SearchResult {
  id: string;
  title: string;
  type: 'bean' | 'cafe' | 'brand';
  description?: string;
  image?: string;
  url: string;
}

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

export default function SearchBar({ 
  placeholder = "원두, 카페, 브랜드를 검색해보세요...", 
  onSearch,
  className = ""
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 검색 결과 모의 데이터
  const mockResults: SearchResult[] = [
    {
      id: '1',
      title: '에티오피아 예가체프',
      type: 'bean',
      description: '꽃향과 과일향이 조화로운 싱글 오리진',
      url: '/beans/1'
    },
    {
      id: '2',
      title: '블루보틀 커피',
      type: 'brand',
      description: '프리미엄 스페셜티 커피 브랜드',
      url: '/brands/blue-bottle'
    },
    {
      id: '3',
      title: '스타벅스 강남점',
      type: 'cafe',
      description: '서울 강남구 테헤란로',
      url: '/cafes/starbucks-gangnam'
    },
    {
      id: '4',
      title: '콜롬비아 수프리모',
      type: 'bean',
      description: '균형잡힌 맛과 부드러운 바디감',
      url: '/beans/4'
    },
    {
      id: '5',
      title: '커피빈 앤 티리프',
      type: 'brand',
      description: '글로벌 커피 체인',
      url: '/brands/coffee-bean'
    }
  ];

  // 검색 실행
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    
    // 실제로는 API 호출
    // const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
    // const data = await response.json();
    
    // 모의 검색 (실제 구현에서는 위의 API 호출 사용)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const filtered = mockResults.filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setResults(filtered);
    setIsLoading(false);
  };

  // 디바운스된 검색
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          window.location.href = results[selectedIndex].url;
        } else if (query.trim()) {
          onSearch?.(query);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'bean': return '☕';
      case 'cafe': return '🏪';
      case 'brand': return '🏷️';
      default: return '🔍';
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'bean': return '원두';
      case 'cafe': return '카페';
      case 'brand': return '브랜드';
      default: return '';
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-4 py-3 pl-12 pr-4 bg-white border-2 border-gray-200 rounded-full focus:border-amber-500 focus:outline-none transition-all"
        />
        
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {/* 검색 결과 드롭다운 */}
      <AnimatePresence>
        {isOpen && (query.trim() || results.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 max-h-96 overflow-y-auto"
          >
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="text-2xl mb-2">🔍</div>
                검색 중...
              </div>
            ) : results.length > 0 ? (
              <div className="py-2">
                {results.map((result, index) => (
                  <Link
                    key={result.id}
                    href={result.url}
                    className={`block px-4 py-3 hover:bg-amber-50 transition-colors ${
                      index === selectedIndex ? 'bg-amber-50' : ''
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{getTypeIcon(result.type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{result.title}</span>
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                            {getTypeLabel(result.type)}
                          </span>
                        </div>
                        {result.description && (
                          <div className="text-sm text-gray-600 mt-1">
                            {result.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : query.trim() ? (
              <div className="p-4 text-center text-gray-500">
                <div className="text-2xl mb-2">😔</div>
                <div className="font-medium">검색 결과가 없습니다</div>
                <div className="text-sm mt-1">다른 키워드로 검색해보세요</div>
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <div className="text-2xl mb-2">💡</div>
                <div className="font-medium">인기 검색어</div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {['에티오피아', '콜롬비아', '스타벅스', '블루보틀'].map((keyword) => (
                    <button
                      key={keyword}
                      onClick={() => {
                        setQuery(keyword);
                        setIsOpen(true);
                      }}
                      className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm hover:bg-amber-200 transition-colors"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 