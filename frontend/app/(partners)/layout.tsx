import localFont from 'next/font/local';
import '@/app/globals.css';

const inter = localFont({
  src: '../../public/fonts/Inter-Variable.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
  style: 'normal',
  preload: true,
  fallback: ['system-ui', 'Arial'],
});

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>SaloMed Partner Portal</title>
        <link rel="icon" href="/SaloMed_logo.png" />
      </head>
      <body className={`${inter.variable} antialiased font-sans bg-slate-50 text-slate-900`}>
        {children}
      </body>
    </html>
  );
}
