import type { ReactNode } from 'react';

export const metadata = { title: 'Avenue Examiner Portal — READ ONLY' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          background: '#fff8e1',
          color: '#1d1d1d',
        }}
      >
        <div
          role="banner"
          style={{
            background: '#b71c1c',
            color: '#fff',
            padding: '8px 16px',
            fontWeight: 600,
            letterSpacing: 0.5,
            textAlign: 'center',
          }}
        >
          EXAMINER SESSION — READ ONLY — ALL QUERIES ARE AUDITED
        </div>
        <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>{children}</main>
      </body>
    </html>
  );
}
