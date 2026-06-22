import { useApp } from '../context/AppContext';

export function GlobalToast() {
  const { toastMsg, toastVisible } = useApp();

  return (
    <div className={`global-toast${toastVisible ? ' show' : ''}`} role="status" aria-live="polite">
      <i className="ti ti-sparkles" style={{ fontSize: 13, color: '#3DA882' }} />
      <span className="toast-msg">{toastMsg}</span>
    </div>
  );
}
