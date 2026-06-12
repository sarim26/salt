import { useApp } from '../context/AppContext';

export function EmailVerificationGate() {
  const {
    loginEmail,
    loginError,
    resendVerification,
    doLogout,
    checkVerification,
  } = useApp();

  return (
    <>
      <div className="login-logo">SALT 🧂</div>
      <div className="login-tag">verify your campus email</div>
      <div className="login-box">
        <p
          style={{
            fontSize: 12,
            color: 'var(--cream)',
            lineHeight: 1.6,
            marginBottom: 14,
            fontFamily: 'var(--fm)',
          }}
        >
          We sent a verification link to{' '}
          <strong style={{ color: 'var(--teal)' }}>{loginEmail}</strong>. Click it,
          then return here and tap below.
        </p>
        <button type="button" className="login-btn" onClick={checkVerification}>
          I VERIFIED — CONTINUE →
        </button>
        <button
          type="button"
          className="auth-toggle"
          style={{ width: '100%', marginTop: 10, padding: '8px 16px' }}
          onClick={resendVerification}
        >
          resend email
        </button>
        <div className="login-err">{loginError}</div>
        <button
          type="button"
          className="rskip"
          style={{ marginTop: 12 }}
          onClick={doLogout}
        >
          sign out
        </button>
      </div>
    </>
  );
}
