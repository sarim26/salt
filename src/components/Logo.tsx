import logoSrc from '../assets/Logo.png';

type LogoProps = {
  variant?: 'login' | 'header';
  className?: string;
  onClick?: () => void;
};

export function Logo({ variant = 'header', className = '', onClick }: LogoProps) {
  const rootClass = variant === 'login' ? 'login-logo' : 'logo';

  return (
    <div
      className={[rootClass, className].filter(Boolean).join(' ')}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <img src={logoSrc} alt="SALT" />
    </div>
  );
}
