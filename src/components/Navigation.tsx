import Link from "next/link";

interface NavigationProps {
  currentPage: 'add' | 'history' | 'ideas' | 'account';
}

export default function Navigation({ currentPage }: NavigationProps) {
  return (
    <nav className="top-nav">
      <Link 
        href="/" 
        className={`nav-item ${currentPage === 'add' ? 'active' : ''}`}
      >
        + Add
      </Link>
      <Link 
        href="/history" 
        className={`nav-item ${currentPage === 'history' ? 'active' : ''}`}
      >
        History
      </Link>
      <Link 
        href="/ideas" 
        className={`nav-item ${currentPage === 'ideas' ? 'active' : ''}`}
      >
        Ideas
      </Link>
      <Link
        href="/account"
        className={`nav-item ${currentPage === 'account' ? 'active' : ''}`}
      >
        Data
      </Link>
    </nav>
  );
}