'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, QrCode, Globe, HandCoins, Receipt, LogOut, Smartphone, Monitor, Info, Copy, Check } from 'lucide-react';
import { Inter } from 'next/font/google';
import Image from 'next/image';
import SplashScreen from '@/components/SplashScreen';
import VaultCard from '@/components/VaultCard';
import PaymentTab from '@/components/PaymentTab';
import LoanTab from '@/components/LoanTab';
import RemittanceForm from '@/components/RemittanceForm';
import TransactionsTab from '@/components/TransactionsTab';
import OnboardingSlides from '@/components/OnboardingSlides';
import { connectWallet } from '@/lib/freighter';
import { getVault, HealthVault, EMPTY_VAULT } from '@/lib/contract';
import { API_URL } from '@/lib/config';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'] });

type Tab = 'vault' | 'payment' | 'loan' | 'remittance' | 'history';

const TAB_ORDER: Tab[] = ['vault', 'payment', 'loan', 'remittance', 'history'];
const TAB_META: Record<Tab, { Icon: React.ElementType; label: string; path: string }> = {
  vault: { Icon: Wallet, label: 'Vault', path: '/vault' },
  payment: { Icon: QrCode, label: 'Payment', path: '/payment' },
  loan: { Icon: HandCoins, label: 'Loan', path: '/loan' },
  remittance: { Icon: Globe, label: 'Padala', path: '/remittance' },
  history: { Icon: Receipt, label: 'History', path: '/history' },
};

function pathToTab(path: string): Tab {
  const found = TAB_ORDER.find(t => TAB_META[t].path === path);
  return found ?? 'vault';
}

const slide = {
  enter: (d: number) => ({ x: d * 30, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: -d * 30, opacity: 0 }),
};

export default function AppLayout({ children: _ }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [phpRate, setPhpRate] = useState(56);
  const [address, setAddress] = useState<string | null>(null);
  const [vault, setVault] = useState<HealthVault>(EMPTY_VAULT);
  const [connecting, setConnecting] = useState(false);
  const [loadingVault, setLoadingVault] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('vault');
  const [dir, setDir] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [forceMobile, setForceMobile] = useState(false);
  const [copied, setCopied] = useState(false);
  const prevTab = useRef<Tab>('vault');

  // Sync initial tab from URL on mount, then lock down popstate so that
  // html5-qrcode (or any other lib) pushing/popping history doesn't navigate away.
  useEffect(() => {
    const t = pathToTab(window.location.pathname);
    setTab(t);
    prevTab.current = t;

    const onPop = () => {
      // Re-push the current tab path so the URL stays in sync and a browser
      // back triggered by html5-qrcode's camera API doesn't navigate away.
      window.history.pushState(null, '', TAB_META[prevTab.current].path);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshVault = useCallback(async (addr?: string) => {
    const a = addr ?? address;
    if (!a) return;
    setLoadingVault(true);
    try { setVault(await getVault(a)); }
    finally { setLoadingVault(false); }
  }, [address]);

  // ── Auto-sync vault balance ───────────────────────────────────────────────
  // 1. Poll Horizon directly every 20 seconds so the balance stays fresh
  //    even if onSuccess doesn't fire (e.g. backend takes too long).
  // 2. Also listen for the salomed_tx_update custom event dispatched by
  //    GCashModal/other transaction components for an instant refresh.
  useEffect(() => {
    if (!address) return;

    // Immediate refresh whenever a transaction is recorded
    const onTxUpdate = (e: Event) => {
      const addr = (e as CustomEvent).detail?.address;
      // Refresh if the event is for our address or address is unspecified
      if (!addr || addr === address.toUpperCase()) {
        refreshVault(address);
      }
    };
    window.addEventListener('salomed_tx_update', onTxUpdate);

    // Also refresh on storage events (cross-tab)
    const onStorage = () => refreshVault(address);
    window.addEventListener('storage', onStorage);

    // Poll every 20 seconds — directly queries Horizon so no backend needed
    const POLL_INTERVAL_MS = 20_000;
    const pollId = setInterval(() => refreshVault(address), POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener('salomed_tx_update', onTxUpdate);
      window.removeEventListener('storage', onStorage);
      clearInterval(pollId);
    };
  }, [address, refreshVault]);

  useEffect(() => {
    fetch(`${API_URL}/api/gcash-rate`)
      .then(r => r.json())
      .then((d: { php_per_usdc: number }) => setPhpRate(d.php_per_usdc))
      .catch(() => { });
  }, []);

  // Persistent Connection: Restoration on page load
  useEffect(() => {
    // 1. Prioritize manual disconnect flag
    const manualDisconnect = localStorage.getItem('salomed_manual_disconnect') === 'true';
    if (manualDisconnect) return;

    // 2. Try to restore from localStorage immediately for zero-flicker UI
    const savedAddr = localStorage.getItem('salomed_address');
    if (savedAddr) {
      setAddress(savedAddr);
      refreshVault(savedAddr);
    }

    // 3. Verify/Sync with Freighter in the background
    const { getAddress } = require('@/lib/freighter');
    getAddress().then((activeAddr: string | null) => {
      if (activeAddr) {
        // If Freighter is connected, ensure it's in sync
        setAddress(activeAddr);
        localStorage.setItem('salomed_address', activeAddr);
        localStorage.removeItem('salomed_manual_disconnect');
        refreshVault(activeAddr);
      } else if (!savedAddr) {
        // Only clear if we didn't have a saved one, to prevent flickering
        // on slow extension loads.
        setAddress(null);
      }
    });
  }, [refreshVault]);

  function switchTab(next: Tab) {
    if (next === tab) return;
    const pi = TAB_ORDER.indexOf(prevTab.current);
    const ni = TAB_ORDER.indexOf(next);
    setDir(ni > pi ? 1 : -1);
    setTab(next);
    prevTab.current = next;
    // Update URL without triggering a Next.js navigation — instant, no remount
    window.history.pushState(null, '', TAB_META[next].path);
  }

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      const addr = await connectWallet();
      if (addr) {
        localStorage.setItem('salomed_address', addr);
        localStorage.removeItem('salomed_manual_disconnect');
        setAddress(addr);
        setShowOnboarding(true);
        await refreshVault(addr);
      }
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Could not connect to Freighter.');
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    localStorage.setItem('salomed_manual_disconnect', 'true');
    localStorage.removeItem('salomed_address');
    setAddress(null);
    setVault(EMPTY_VAULT);
    switchTab('vault');
  }

  return (
    <html lang="en">
      <head>
        <title>SaloMed: Your Health Alkansya</title>
        <link rel="icon" href="/SaloMed_logo.png" />
      </head>
      <body className={`${inter.className} antialiased font-sans`}>
        {!ready && <SplashScreen onDone={() => setReady(true)} />}

        <AnimatePresence>
          {showOnboarding && (
            <OnboardingSlides
              onComplete={() => {
                setShowOnboarding(false);
                localStorage.setItem('salomed_onboarded', 'true');
              }}
            />
          )}
        </AnimatePresence>

        <div className={`h-dvh flex w-full overflow-hidden ${forceMobile ? 'flex-col bg-slate-50 max-w-lg mx-auto shadow-2xl relative' : 'flex-col md:flex-row bg-slate-50'}`}>

          {/* Desktop Sidebar (hidden on mobile) */}
          <aside className={`${forceMobile ? 'hidden' : 'hidden md:flex'} flex-col w-72 bg-white border-r border-slate-200 shrink-0 h-full sticky top-0`}>
            <div className="px-6 py-6 border-b border-slate-100 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 relative">
                    <Image src="/SaloMed_logo.png" alt="SaloMed" fill className="object-contain" priority />
                  </div>
                  <span className="font-bold text-xl text-slate-900 tracking-tight">SaloMed</span>
                </div>
                <button onClick={() => setShowOnboarding(true)} className="text-slate-400 hover:text-blue-600 transition-colors" title="About SaloMed">
                  <Info size={18} />
                </button>
              </div>

              {/* Desktop Wallet Connect/Disconnect UI */}
              <div>
                {address ? (
                  <div className="flex flex-col gap-3">
                    <div className="group flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-sm font-mono text-blue-700 font-medium tracking-tight">
                          {address.slice(0, 10)}…{address.slice(-6)}
                        </span>
                      </div>
                      <button
                        onClick={copyAddress}
                        className="text-blue-400 hover:text-blue-700 transition-colors"
                        title="Copy address"
                      >
                        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <LogOut size={14} /> Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="w-full text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl py-3 transition-all disabled:opacity-60 shadow-sm"
                  >
                    {connecting ? 'Connecting…' : 'Connect Wallet'}
                  </button>
                )}
              </div>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2">
              {TAB_ORDER.map(t => {
                const { Icon, label } = TAB_META[t];
                const active = tab === t;
                return (
                  <button
                    key={t + '-desktop'}
                    onClick={() => switchTab(t)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold transition-all ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                    <span className="text-sm">{label}</span>
                  </button>
                );
              })}


            </nav>


          </aside>

          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile Header */}
            <header className={`${forceMobile ? 'flex' : 'md:hidden flex'} bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-sm shrink-0`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 relative">
                  <Image src="/SaloMed_logo.png" alt="SaloMed" fill className="object-contain" priority />
                </div>
                <span className="font-bold text-base text-slate-900 tracking-tight">SaloMed</span>
                <button onClick={() => setShowOnboarding(true)} className="text-slate-400 hover:text-blue-600 transition-colors ml-1" title="About SaloMed">
                  <Info size={16} />
                </button>
              </div>

              {address ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={copyAddress}
                    className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5 active:scale-95 transition-transform"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-[10px] font-mono text-blue-700 font-medium tracking-tight">
                      {address.slice(0, 4)}…{address.slice(-4)}
                    </span>
                    {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} className="text-blue-400" />}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    title="Disconnect wallet"
                    className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-full px-3 py-1.5 transition-colors disabled:opacity-60"
                >
                  {connecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
              )}
            </header>

            {/* Error banner */}
            {connectError && (
              <div className="bg-red-50 border-b border-red-100 px-4 py-2 flex items-center justify-between gap-3">
                <p className="text-xs text-red-600 leading-snug">{connectError}</p>
                <button onClick={() => setConnectError(null)} className="text-red-400 hover:text-red-600 shrink-0 text-lg leading-none">×</button>
              </div>
            )}

            {/* Content — rendered directly from state, no Next.js navigation */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={tab}
                  custom={dir}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  {tab === 'vault' && (
                    <VaultCard
                      address={address}
                      vault={vault}
                      loading={loadingVault}
                      connecting={connecting}
                      onConnect={handleConnect}
                      onRefresh={() => refreshVault()}
                    />
                  )}
                  {tab === 'payment' && (
                    <PaymentTab
                      address={address}
                      vault={vault}
                      onSuccess={() => { refreshVault(); switchTab('vault'); }}
                      onSwitchTab={switchTab}
                    />
                  )}
                  {tab === 'loan' && (
                    <LoanTab address={address} vault={vault} phpRate={phpRate} />
                  )}
                  {tab === 'remittance' && (
                    <RemittanceForm
                      ofwAddress={address}
                      vault={vault}
                      onSuccess={() => { refreshVault(); switchTab('vault'); }}
                      onSwitchTab={switchTab}
                    />
                  )}
                  {tab === 'history' && (
                    <TransactionsTab address={address} phpRate={phpRate} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom tab bar (Mobile only) */}
            <nav className={`${forceMobile ? 'block' : 'md:hidden'} bg-white border-t border-slate-100 shadow-[0_-1px_4px_0_rgb(0,0,0,0.06)] shrink-0`}>
              <div className="flex">
                {TAB_ORDER.map(t => {
                  const { Icon, label } = TAB_META[t];
                  const active = tab === t;
                  return (
                    <button
                      key={t}
                      onClick={() => switchTab(t)}
                      className={`relative flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                      <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                      <span className="text-[11px] font-semibold">{label}</span>
                      {active && (
                        <motion.div layoutId="tab-dot" className="absolute top-1 w-1 h-1 rounded-full bg-blue-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>

          {/* Floating button to toggle desktop/mobile view */}
          <button
            onClick={() => setForceMobile(!forceMobile)}
            className="hidden md:flex fixed top-4 right-4 items-center gap-1.5 bg-slate-800/90 hover:bg-slate-900 text-white px-3.5 py-2 rounded-full shadow-md text-xs font-semibold backdrop-blur-sm transition-all z-50 hover:scale-105 active:scale-95"
          >
            {forceMobile ? (
              <><Monitor size={14} strokeWidth={2.5} /> Desktop View</>
            ) : (
              <><Smartphone size={14} strokeWidth={2.5} /> Mobile View</>
            )}
          </button>

        </div>
      </body>
    </html>
  );
}
