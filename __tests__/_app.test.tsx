import { render, screen } from '@testing-library/react';
import App from '@/pages/_app';

function Dummy() {
  return <div data-testid="dummy" />;
}

test('renders nav and page component', () => {
  render(<App Component={Dummy} pageProps={{}} />);
  expect(screen.getByText('Add Meal')).toBeInTheDocument();
  expect(screen.getByText('History')).toBeInTheDocument();
  expect(screen.getByText('Account')).toBeInTheDocument();
  expect(screen.getByTestId('dummy')).toBeInTheDocument();
});
