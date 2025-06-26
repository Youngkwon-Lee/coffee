"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}

export default function FilterDropdown({
  label,
  options,
  selectedValue,
  onSelect,
  placeholder = "선택하세요"
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedOption = options.find(option => option.value === selectedValue);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-coffee-light mb-2">
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-coffee-medium border border-coffee-gold border-opacity-30 rounded-lg text-coffee-light hover:border-opacity-60 focus:outline-none focus:border-coffee-gold transition-colors"
      >
        <span className={selectedOption ? 'text-coffee-light' : 'text-coffee-light opacity-70'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDownIcon 
          className={`w-4 h-4 text-coffee-light transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-coffee-medium border border-coffee-gold border-opacity-30 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option, index) => (
            <button
              key={`${option.value}-${index}`} // 인덱스 추가로 고유성 보장
              onClick={() => {
                onSelect(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-3 hover:bg-coffee-gold hover:bg-opacity-20 transition-colors ${
                selectedValue === option.value 
                  ? 'bg-coffee-gold bg-opacity-20 text-coffee-gold' 
                  : 'text-coffee-light'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-sm text-coffee-light opacity-60">
                    ({option.count})
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}