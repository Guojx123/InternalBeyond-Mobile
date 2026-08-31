interface SliderProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** 右侧数值胶囊；传 false 可隐藏 */
  showValue?: boolean;
  /** 数值格式化（默认直接显示原值） */
  format?: (v: number) => string;
  label?: string;
}

/**
 * 自定义范围滑块（参考 .ib-range）
 * 用于替换 memory / visual 等页面的原生 range，保证亮暗双主题一致。
 */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  showValue = true,
  format,
  label,
}: SliderProps) {
  return (
    <label className="field">
      {label && <span className="fld-lb">{label}</span>}
      <span className="range-row">
        <input
          className="ib-range"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {showValue && <span className="range-val">{format ? format(value) : value}</span>}
      </span>
    </label>
  );
}
