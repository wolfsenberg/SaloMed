'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, CheckCircle2 } from 'lucide-react';
import { getProviders, Provider, ProviderType } from '@/lib/whitelist';

interface Props {
  providerType: ProviderType;
  value: string;
  onChange: (name: string, stellarAddress: string) => void;
}

export default function ProviderCombobox({ providerType, value, onChange }: Props) {
  const [query, setQuery]       = useState(value);
  const [open, setOpen]         = useState(false);
  const [selected, setSelected] = useState<Provider | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef   = useRef<HTMLDivElement>(null);

  const providers = getProviders(providerType);
  const filtered  = query.trim().length === 0
    ? providers
    : providers.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.location.toLowerCase().includes(query.toLowerCase()),
      );

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Reset when provider type changes
  useEffect(() => {
    setQuery('');
    setSelected(null);
    onChange('', '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerType]);

  function select(p: Provider) {
    setSelected(p);
    setQuery(p.name);
    setOpen(false);
    onChange(p.name, p.stellarAddress);
  }

  function handleInput(v: string) {
    setQuery(v);
    setSelected(null);
    onChange(v, ''); // clear address when typing freely
    setOpen(true);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={`Search ${providerType === 'hospital' ? 'hospital' : 'pharmacy'}…`}
          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl pl-9 pr-10 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
        />
        {selected && (
          <CheckCircle2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
        )}
      </div>

      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{ transformOrigin: 'top' }}
            className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto"
          >
            {filtered.map(p => (
              <li key={p.stellarAddress}>
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); select(p); }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 ${
                    selected?.stellarAddress === p.stellarAddress ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {p.location}
                    </p>
                  </div>
                  {selected?.stellarAddress === p.stellarAddress && (
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {selected && (
        <p className="mt-1 text-xs text-emerald-600 font-medium flex items-center gap-1">
          <CheckCircle2 size={11} /> Whitelisted partner — address auto-filled
        </p>
      )}
      {query.trim().length > 0 && !selected && filtered.length === 0 && (
        <p className="mt-1 text-xs text-slate-400">No matching {providerType} found in whitelist.</p>
      )}
    </div>
  );
}
