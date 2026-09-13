// ---------------------------------------------------------------------------
// Maps the ERP navigation's icon names onto Lucide, the icon set the design
// system's components draw with, so lib/navigation.ts stays free of JSX and can
// be imported on the server.
//
// The names in `lib/navigation.ts` were already Lucide's own, so each one is
// simply the icon it asks for rather than the nearest TailAdmin equivalent.
// ---------------------------------------------------------------------------

import {
  BarChart3,
  Boxes,
  Briefcase,
  CalendarDays,
  DatabaseBackup,
  FileText,
  History,
  IdCard,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Package,
  Settings,
  Store,
  Table,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export const NAV_ICONS: Record<string, LucideIcon> = {
  grid: LayoutGrid,
  'layout-dashboard': LayoutDashboard,
  'database-backup': DatabaseBackup,
  briefcase: Briefcase,
  store: Store,
  users: Users,
  package: Package,
  boxes: Boxes,
  truck: Truck,
  'file-text': FileText,
  wallet: Wallet,
  'bar-chart': BarChart3,
  'map-pin': MapPin,
  'id-card': IdCard,
  calendar: CalendarDays,
  settings: Settings,
  history: History,
  table: Table,
};
