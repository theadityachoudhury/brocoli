interface TagProps {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

export function Tag({ label, onClick, active = false }: TagProps) {
  const base =
    'inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-sm border transition-colors duration-150';
  const inactive =
    'bg-surface-raised text-text-muted border-border hover:bg-accent-subtle hover:text-accent hover:border-accent-border';
  const activeStyle =
    'bg-accent-subtle text-accent border-accent-border';

  const className = `${base} ${active ? activeStyle : inactive}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} cursor-pointer`}>
        {label}
      </button>
    );
  }

  return <span className={className}>{label}</span>;
}
