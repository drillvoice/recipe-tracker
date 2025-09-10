import { render, screen } from '@testing-library/react';
import App from '@/pages/_app';

function Dummy() {
  return <div data-testid="dummy" />;
}

test('renders page component', () => {
  render(<App Component={Dummy} pageProps={{}} />);
  expect(screen.getByTestId('dummy')).toBeInTheDocument();
});
