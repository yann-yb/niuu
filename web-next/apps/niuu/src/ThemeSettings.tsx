import { useTheme, type ThemeName } from '@niuulabs/design-tokens';

const THEME_OPTIONS: { description: string; label: string; value: ThemeName }[] = [
  { value: 'light', label: 'Light', description: 'Bright neutral surfaces with understated gray accents.' },
  { value: 'ice', label: 'Ice', description: 'Dark surfaces with cool blue accents.' },
  { value: 'amber', label: 'Amber', description: 'Dark surfaces with warm amber accents.' },
  { value: 'spring', label: 'Spring', description: 'Dark surfaces with green accents.' },
];

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset className="theme-settings">
      <legend className="theme-settings__legend">Interface theme</legend>
      <div className="theme-settings__options">
        {THEME_OPTIONS.map((option) => (
          <label
            className="theme-settings__option"
            data-selected={theme === option.value}
            key={option.value}
          >
            <input
              checked={theme === option.value}
              name="niuu-theme"
              onChange={() => setTheme(option.value)}
              type="radio"
              value={option.value}
            />
            <span
              aria-hidden="true"
              className={`theme-settings__swatch theme-settings__swatch--${option.value}`}
            />
            <span className="theme-settings__copy">
              <span className="theme-settings__label">{option.label}</span>
              <span className="theme-settings__description">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="theme-settings__note">Saved in this browser and applied immediately.</p>
    </fieldset>
  );
}
