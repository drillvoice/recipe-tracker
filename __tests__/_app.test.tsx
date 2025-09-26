import { render, screen, waitFor } from '@testing-library/react';
import type { AppProps } from 'next/app';

const mockEnsureAuthPersistence = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/firebase', () => ({
  auth: {},
  ensureAuthPersistence: mockEnsureAuthPersistence,
  isFirebaseConfigured: true,
}));

const mockSignInAnonymously = jest.fn().mockResolvedValue({});
jest.mock('firebase/auth', () => ({ signInAnonymously: mockSignInAnonymously }));

import App from '@/pages/_app';

function Dummy() {
  return <div data-testid="dummy" />;
}

test('renders page component', async () => {
  const mockAppProps: AppProps = {
    Component: Dummy,
    pageProps: {},
    router: {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      beforePopState: jest.fn(),
      events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() }
    } as unknown as AppProps['router']
  };

  render(<App {...mockAppProps} />);
  expect(screen.getByTestId('dummy')).toBeInTheDocument();

  await waitFor(() => {
    expect(mockEnsureAuthPersistence).toHaveBeenCalled();
    expect(mockSignInAnonymously).toHaveBeenCalled();
  });
});
