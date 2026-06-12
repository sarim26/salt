import { AVC } from '../constants';

type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<AvatarSize, number> = {
  sm: 32,
  md: 34,
  lg: 68,
};

const FONT_PX: Record<AvatarSize, number> = {
  sm: 13,
  md: 14,
  lg: 28,
};

interface AvatarProps {
  initials: string;
  photoUrl?: string | null;
  colorIndex?: number;
  size?: AvatarSize;
  className?: string;
  onClick?: () => void;
}

export function Avatar({
  initials,
  photoUrl,
  colorIndex = 0,
  size = 'sm',
  className = '',
  onClick,
}: AvatarProps) {
  const px = SIZE_PX[size];
  const style = {
    width: px,
    height: px,
    fontSize: FONT_PX[size],
    background: photoUrl ? 'transparent' : AVC[colorIndex % AVC.length],
  };

  const shared = `${className} avatar avatar-${size}${onClick ? ' avatar-click' : ''}`.trim();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={shared}
        style={{ width: px, height: px }}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      />
    );
  }

  return (
    <div
      className={shared}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {initials}
    </div>
  );
}
