import { ReactNode } from 'react';

interface ChipProps {
  on?: boolean;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}

/** 999px 玻璃标签（blog 分类 / circle 可见范围 / memory 分类复用，参考 .chip） */
export function Chip({ on, onClick, children, disabled, title }: ChipProps) {
  return (
    <button
      type="button"
      className={`chip${on ? ' on' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export default Chip;
