import React, { useEffect, useRef, useState } from 'react';
import '../../App.css';

interface Option { value: string; label: string; }

interface Props {
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function CustomSelect({ options, value = '', onChange, placeholder = '', disabled = false, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.value === value) || null;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (e.target && !(ref.current as any).contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleToggle = () => { if (!disabled) setOpen((s) => !s); };
  const handleSelect = (val: string) => { onChange(val); setOpen(false); };

  return (
    <div className={`custom-select ${className}`} ref={ref}>
      <button type="button" className={`custom-select-button ${disabled ? 'disabled' : ''}`} onClick={handleToggle} aria-haspopup="listbox" aria-expanded={open}>
        <span className="custom-select-label">{selected ? selected.label : placeholder}</span>
        <span className="custom-select-chevron">▾</span>
      </button>

      {open && (
        <ul className="custom-select-panel" role="listbox">
          {options.map((opt) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value} className={`custom-select-option ${opt.value === value ? 'selected' : ''}`} onClick={() => handleSelect(opt.value)}>
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
