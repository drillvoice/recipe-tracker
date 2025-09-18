import Link from "next/link";

interface NavigationProps {
  currentPage: 'add' | 'dishes' | 'tags' | 'account';
}

export default function Navigation({ currentPage }: NavigationProps) {
  return (
    <nav className="top-nav">
      <Link
        href="/"
        className={`nav-item ${currentPage === 'add' ? 'active' : ''}`}
      >
        Diary
      </Link>
      <Link
        href="/dishes"
        className={`nav-item ${currentPage === 'dishes' ? 'active' : ''}`}
      >
        Dishes
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