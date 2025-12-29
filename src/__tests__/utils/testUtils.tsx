import React from 'react';
import { render } from '@testing-library/react-native';
import { I18nProvider } from '../../contexts/I18nContext';
import { AuthProvider } from '../../contexts/AuthContext';

/**
 * Custom render function that wraps components with necessary providers
 */
export const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  return render(
    <I18nProvider>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </I18nProvider>,
    options
  );
};

/**
 * Re-export everything from React Testing Library
 */
export * from '@testing-library/react-native';
