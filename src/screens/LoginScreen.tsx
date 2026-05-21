import { useApp } from '../context/AppContext';

export function LoginScreen() {
  const {
    loginEmail,
    loginPassword,
    loginError,
    setLoginEmail,
    setLoginPassword,
    doLogin,
    demoLogin,
  } = useApp();

  return (
    <>
      <div className="login-logo">SALT 🧂</div>
      <div className="login-tag">meet. eat. befriend.</div>
      <div className="login-box">
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
          JOIN THE SALT →
        </button>
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
