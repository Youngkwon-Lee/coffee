"use client";

import { useId } from "react";

interface FilterOption { value: string; label: string; count?: number; }
interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}

/** Native selection keeps keyboard and mobile screen-reader behavior intact. */
export default function FilterDropdown({ label, options, selectedValue, onSelect, placeholder = "선택하세요" }: FilterDropdownProps) {
  const id = useId();
  return <div>
    <label htmlFor={id} className="block text-sm font-medium text-coffee-latte mb-2">{label}</label>
    <select id={id} value={selectedValue} onChange={event => onSelect(event.target.value)}
      className="w-full min-h-12 rounded-xl px-3 py-3 bg-coffee-medium text-coffee-light border border-[var(--kc-line-strong)]">
      {!options.some(option => option.value === selectedValue) && <option value="" disabled>{placeholder}</option>}
      {options.map((option, index) => <option key={`${option.value}-${index}`} value={option.value}>
        {option.label}{option.count === undefined ? "" : ` (${option.count})`}
      </option>)}
    </select>
  </div>;
}
