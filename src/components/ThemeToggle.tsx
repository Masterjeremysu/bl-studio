import React from 'react';
import { Theme } from '../types';

interface Props {
  theme: Theme;
  onChange: (t: Theme) => void;
}

const opts: { value: Theme; icon: string; label: string }[] = [
  { value: 'light', icon: '☀', label: 'Jour' },
  { value: 'auto',  icon: '⟳', label: 'Auto' },
  { value: 'dark',  icon: '☾', label: 'Nuit' },
];

export default function ThemeToggle({ theme, onChange }: Props) {
  return (
    <div className="theme-toggle">
      {opts.map(o => (
        <button
          key={o.value}
          className={`theme-opt ${theme === o.value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
          title={o.label}
        >
          <span>{o.icon}</span>
          <span style={{ display: window.innerWidth > 900 ? 'inline' : 'none' }}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
