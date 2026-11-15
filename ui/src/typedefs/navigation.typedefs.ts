export interface PublicNavItem {
  href: string;
  label: string;
}

export interface AdminNavItem {
  to: string;
  label: string;
  iconName: string;
  end?: boolean;
}

export interface SystemNavItem {
  href: string;
  label: string;
  iconName: string;
}
