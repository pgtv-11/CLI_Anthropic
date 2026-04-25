import type { ReactNode } from 'react';

export const metadata = {
  title: 'Avenue Compliance Console',
  description: 'Internal regulatory compliance console for Avenue Securities LLC',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          background: '#0b0f17',
          color: '#e6e8ee',
        }}
      >
        <header
          style={{
            padding: '12px 24px',
            background: '#101725',
            borderBottom: '1px solid #1f2a3d',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <strong>Avenue Compliance Console</strong>
          <span style={{ color: '#7e8aa0', fontSize: 12 }}>internal · authenticated</span>
        </header>
        <main style={{ padding: '24px' }}>{children}</main>
      </body>
    </html>
  );
}
