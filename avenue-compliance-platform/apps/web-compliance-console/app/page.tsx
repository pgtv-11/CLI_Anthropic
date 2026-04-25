import Link from 'next/link';

const modules = [
  {
    href: '/surveillance/alerts',
    title: 'Surveillance — Alerts',
    blurb: 'Triage queues for FINRA 5210 / 3110 supervision (M3).',
  },
  {
    href: '/aml/sars',
    title: 'AML — SAR Cases',
    blurb: 'Drafting + dual-approval for suspicious activity reports (M1).',
  },
  {
    href: '/regbi/recommendations',
    title: 'Reg BI — Recommendations',
    blurb: 'Pre-trade Care/Disclosure/Conflict checks (M2).',
  },
  {
    href: '/comms/review',
    title: 'Comms — Review queue',
    blurb: 'FINRA 2210 + 3110.06–.09 communications review (M4).',
  },
  {
    href: '/evidence',
    title: 'Evidence — Export packages',
    blurb: 'Generate examiner-ready PDF/A bundles (P5).',
  },
  {
    href: '/research',
    title: 'Research — Rulebook Q&A',
    blurb: 'Claude-powered RAG over FINRA/SEC corpus (P6).',
  },
];

export default function Home() {
  return (
    <div>
      <h1 style={{ fontSize: 22, marginTop: 0 }}>Compliance Console</h1>
      <p style={{ color: '#9aa6bb', marginTop: 0 }}>
        Internal-only. All actions are audited (P1) and authorized through OPA (P3).
      </p>
      <ul style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', listStyle: 'none', padding: 0 }}>
        {modules.map((m) => (
          <li key={m.href} style={{ background: '#101725', border: '1px solid #1f2a3d', borderRadius: 8, padding: 16 }}>
            <Link href={m.href} style={{ color: '#e6e8ee', textDecoration: 'none' }}>
              <strong>{m.title}</strong>
              <p style={{ color: '#9aa6bb', fontSize: 13, margin: '8px 0 0' }}>{m.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
