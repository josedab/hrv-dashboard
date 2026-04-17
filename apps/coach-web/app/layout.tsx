import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HRV Coach',
  description: 'Coach-facing dashboard for HRV Readiness',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          background: '#0F172A',
          color: '#F8FAFC',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          margin: 0,
          minHeight: '100vh',
        }}
      >
        {children}
      </body>
    </html>
  );
}
