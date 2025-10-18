import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  min?: string;
  max?: string;
}

const DateInput = ({ value, onChange, className, placeholder = "yyyy-mm-dd", min, max }: DateInputProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const formatDateInput = (input: string) => {
    // Remove all non-numeric characters
    const numbers = input.replace(/\D/g, '');
    
    // Format as yyyy-mm-dd
    let formatted = '';
    if (numbers.length > 0) {
      formatted = numbers.substring(0, 4);
      if (numbers.length > 4) {
        formatted += '-' + numbers.substring(4, 6);
      }
      if (numbers.length > 6) {
        formatted += '-' + numbers.substring(6, 8);
      }
    }
    
    return formatted;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = formatDateInput(e.target.value);
    setDisplayValue(newValue);
    
    // Only call onChange if we have a complete date
    if (newValue.length === 10) {
      onChange(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent deleting the dashes
    if (e.key === 'Backspace') {
      const cursorPos = inputRef.current?.selectionStart || 0;
      if (cursorPos === 5 || cursorPos === 8) {
        e.preventDefault();
      }
    }
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder={placeholder}
      maxLength={10}
    />
  );
};

export default DateInput;
