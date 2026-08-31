interface ToggleProps {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** 左侧标题 */
  title?: string;
  /** 左侧说明 */
  sub?: string;
  /** 纯开关模式（不带文字行） */
  bare?: boolean;
}

/**
 * iOS 风格开关（参考 .sw2 —— 41×23 药丸）。
 * bare=false 时渲染为带标题/说明的设置行（.tog）。
 */
export function Toggle({ on, onChange, disabled, title, sub, bare }: ToggleProps) {
  const sw = (
    <button
      type="button"
      className={`sw2${on ? ' on' : ''}`}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      aria-label={title}
    />
  );

  if (bare || !title) return sw;

  return (
    <div className="tog">
      <div className="tog-m">
        <div className="tog-t">{title}</div>
        {sub && <div className="tog-s">{sub}</div>}
      </div>
      {sw}
    </div>
  );
}

export default Toggle;
