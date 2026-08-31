import { TextareaHTMLAttributes } from 'react';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** 统一文本域（.fld 外观，自适应行高） */
export function Textarea({ className = '', rows = 4, ...rest }: TextareaProps) {
  return <textarea className={`fld ${className}`.trim()} rows={rows} {...rest} />;
}

export default Textarea;
