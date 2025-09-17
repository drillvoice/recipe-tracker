import Link from "next/link";

interface NavigationProps {
  currentPage: 'add' | 'ideas' | 'tags' | 'account';
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
        href="/ideas"
        className={`nav-item ${currentPage === 'ideas' ? 'active' : ''}`}
      >
        Ideas
      </Link>
      <Link
        href="/tags"
        className={`nav-item ${currentPage === 'tags' ? 'active' : ''}`}
      >
        Tags
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