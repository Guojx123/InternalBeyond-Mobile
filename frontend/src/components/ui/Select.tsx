import { SelectHTMLAttributes } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** 统一下拉框（appearance:none + 自绘箭头，亮暗主题一致） */
export function Select({ className = '', children, ...rest }: SelectProps) {
  return (
    <span className="sel-wrap">
      <select className={`fld ${className}`.trim()} {...rest}>
        {children}
      </select>
    </span>
  );
}

export default Select;
