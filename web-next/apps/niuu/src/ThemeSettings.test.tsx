import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@niuulabs/design-tokens';
import { ThemeSettings } from './ThemeSettings';

describe('ThemeSettings', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('selects and persists a theme', () => {
    render(
      <ThemeProvider theme="ice">
        <ThemeSettings />
      </ThemeProvider>,
    );

    expect((screen.getByDisplayValue('ice') as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByDisplayValue('light'));

    expect((screen.getByDisplayValue('light') as HTMLInputElement).checked).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('niuu.theme')).toBe('light');
  });
});
