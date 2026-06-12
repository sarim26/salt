import { useApp } from '../context/AppContext';
import { isFirebaseConfigured } from '../lib/firebase';

export function LoginScreen() {
  const {
    loginEmail,
    loginPassword,
    loginError,
    authMode,
    setAuthMode,
    setLoginEmail,
    setLoginPassword,
    doLogin,
    resetPassword,
  } = useApp();

  const firebaseReady = isFirebaseConfigured;

  return (
    <>
      <div className="login-logo">SALT 🧂</div>
      <div className="login-tag">meet. eat. befriend.</div>
      <div className="login-box">
        {firebaseReady ? (
          <>
            <div className="auth-toggles" style={{ marginBottom: 14 }}>
              <button
                type="button"
                className={`auth-toggle${authMode === 'signin' ? ' on' : ''}`}
                onClick={() => setAuthMode('signin')}
              >
                sign in
              </button>
              <button
                type="button"
                className={`auth-toggle${authMode === 'signup' ? ' on' : ''}`}
                onClick={() => setAuthMode('signup')}
              >
                create account
              </button>
            </div>
            <div className="login-lbl">your .edu email</div>
            <input
              className="login-inp"
              type="email"
              placeholder="you@uic.edu"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
            <div className="login-lbl">password</div>
            <input
              className="login-inp"
              type="password"
              placeholder="••••••••"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doLogin()}
            />
            <button type="button" className="login-btn" onClick={doLogin}>
              {authMode === 'signup' ? 'CREATE ACCOUNT →' : 'JOIN THE SALT →'}
            </button>
            {authMode === 'signin' && (
              <button
                type="button"
                className="rskip"
                style={{ marginTop: 8 }}
                onClick={resetPassword}
              >
                forgot password?
              </button>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, textAlign: 'center' }}>
            Firebase is not configured for this build. Add your project keys to enable sign-in.
          </div>
        )}
        <div className="login-err">{loginError}</div>
      </div>
    </>
  );
}
