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
    demoLogin,
    resetPassword,
  } = useApp();

  const firebaseReady = isFirebaseConfigured;

  return (
    <>
      <div className="login-logo">SALT 🧂</div>
      <div className="login-tag">meet. eat. befriend.</div>
      <div className="login-box">
        {firebaseReady && (
          <div className="demo-btns" style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={`demo-btn${authMode === 'signin' ? ' on' : ''}`}
              style={
                authMode === 'signin'
                  ? { borderColor: 'var(--teal)', color: 'var(--teal)' }
                  : undefined
              }
              onClick={() => setAuthMode('signin')}
            >
              sign in
            </button>
            <button
              type="button"
              className={`demo-btn${authMode === 'signup' ? ' on' : ''}`}
              style={
                authMode === 'signup'
                  ? { borderColor: 'var(--teal)', color: 'var(--teal)' }
                  : undefined
              }
              onClick={() => setAuthMode('signup')}
            >
              create account
            </button>
          </div>
        )}
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
          {firebaseReady
            ? authMode === 'signup'
              ? 'CREATE ACCOUNT →'
              : 'JOIN THE SALT →'
            : 'JOIN THE SALT →'}
        </button>
        {firebaseReady && authMode === 'signin' && (
          <button
            type="button"
            className="rskip"
            style={{ marginTop: 8 }}
            onClick={resetPassword}
          >
            forgot password?
          </button>
        )}
        <div className="login-err">{loginError}</div>
      </div>
      <div className="login-demos">
        <div className="demo-title">try a demo account</div>
        <div className="demo-btns">
          <button type="button" className="demo-btn" onClick={() => demoLogin('uic')}>
            UIC
          </button>
          <button type="button" className="demo-btn" onClick={() => demoLogin('uiuc')}>
            UIUC
          </button>
          <button type="button" className="demo-btn" onClick={() => demoLogin('mit')}>
            MIT
          </button>
        </div>
      </div>
    </>
  );
}
