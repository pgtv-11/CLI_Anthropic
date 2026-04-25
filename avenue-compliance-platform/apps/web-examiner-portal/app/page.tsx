export default function Home() {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Examiner Portal</h1>
      <p>
        This portal exposes a read-only, point-in-time snapshot of compliance
        records for FINRA / SEC examination and external audit. Every query is
        recorded in the immutable audit log under your <strong>examiner_session.id</strong>.
      </p>
      <ul>
        <li>Surveillance alerts and case files</li>
        <li>SAR filings and supporting documentation</li>
        <li>Reg BI recommendation events with Form CRS delivery records</li>
        <li>Communications archive (FINRA 4511, 17a-4(b)(4))</li>
        <li>Evidence package downloads (PDF/A + signed manifest)</li>
        <li>Annual CEO certification (FINRA 3130)</li>
      </ul>
      <p style={{ background: '#fff', border: '1px solid #ddd', padding: 12, borderRadius: 6, fontSize: 13 }}>
        <strong>Session expiry:</strong> sessions are time-limited and may be revoked at any moment by Avenue's CCO.
      </p>
    </div>
  );
}
