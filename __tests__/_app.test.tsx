import { render, screen } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({ auth: {} }));

const mockSignInAnonymously = jest.fn().mockResolvedValue({});
jest.mock('firebase/auth', () => ({ signInAnonymously: mockSignInAnonymously }));

import App from '@/pages/_app';

function Dummy() {
  return <div data-testid="dummy" />;
}

test('renders page component', () => {
  const mockRouter = {
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
  } as any;
  
  render(<App Component={Dummy} pageProps={{}} router={mockRouter} />);
  expect(screen.getByTestId('dummy')).toBeInTheDocument();
  expect(mockSignInAnonymously).toHaveBeenCalled();
});
