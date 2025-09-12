import { render, screen } from '@testing-library/react';

jest.mock('@/lib/firebase', () => ({ auth: {} }));

const mockSignInAnonymously = jest.fn().mockResolvedValue({});
jest.mock('firebase/auth', () => ({ signInAnonymously: mockSignInAnonymously }));

import App from '@/pages/_app';

function Dummy() {
  return <div data-testid="dummy" />;
}

test('renders page component', () => {
  render(<App Component={Dummy} pageProps={{}} />);
  expect(screen.getByTestId('dummy')).toBeInTheDocument();
  expect(mockSignInAnonymously).toHaveBeenCalled();
});
