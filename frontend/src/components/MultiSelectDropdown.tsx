import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Checkbox } from './ui/checkbox';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  colors: {
    BG: string;
    SURFACE: string;
    ACCENT: string;
    GOLD: string;
    SECONDARY: string;
    TEXT: string;
    SUBTEXT: string;
  };
}

export function MultiSelectDropdown({ 
  options, 
  selectedValues, 
  onChange, 
  placeholder = 'Select dates',
  colors 
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const option = options.find(o => o.value === selectedValues[0]);
      return option?.label || '';
    }
    return `${selectedValues.length} dates selected`;
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border h-11 text-base px-3 rounded-md flex items-center justify-between transition-colors"
        style={{
          backgroundColor: colors.BG,
          borderColor: colors.SECONDARY,
          color: colors.TEXT
        }}
      >
        <span className="truncate">{getDisplayText()}</span>
        <ChevronDown 
          className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: colors.SUBTEXT }}
        />
      </button>

      {isOpen && (
        <div 
          className="absolute z-50 w-full mt-1 border rounded-md shadow-lg max-h-60 overflow-y-auto"
          style={{
            backgroundColor: colors.SURFACE,
            borderColor: colors.SECONDARY
          }}
        >
          {options.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            return (
              <div
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors active:opacity-70"
                style={{
                  backgroundColor: isSelected ? `${colors.ACCENT}20` : 'transparent',
                  color: colors.TEXT
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = `${colors.SECONDARY}40`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div 
                  className="w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{
                    borderColor: isSelected ? colors.ACCENT : colors.SECONDARY,
                    backgroundColor: isSelected ? colors.ACCENT : 'transparent'
                  }}
                >
                  {isSelected && (
                    <Check className="w-3.5 h-3.5" style={{ color: colors.BG }} />
                  )}
                </div>
                <span className="flex-1 text-base">{option.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
