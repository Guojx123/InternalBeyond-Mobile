import { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** 统一输入框（.fld 外观）—— 修掉各页裸 border:1px 的不一致样式 */
export function Input({ className = '', ...rest }: InputProps) {
  return <input className={`fld ${className}`.trim()} {...rest} />;
}

export default Input;
