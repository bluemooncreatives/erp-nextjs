// ---------------------------------------------------------------------------
// Maps the ERP navigation's icon names onto the TailAdmin icon set, so
// lib/navigation.ts stays free of JSX and can be imported on the server.
// ---------------------------------------------------------------------------

import {
  BoxCubeIcon,
  BoxIconLine,
  CalenderIcon,
  DocsIcon,
  DollarLineIcon,
  GridIcon,
  GroupIcon,
  ListIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  ShootingStarIcon,
  TableIcon,
  TaskIcon,
  TimeIcon,
  UserCircleIcon,
} from '@/icons/index';

type IconComponent = React.ComponentType<{ className?: string }>;

export const NAV_ICONS: Record<string, IconComponent> = {
  grid: GridIcon,
  briefcase: TaskIcon,
  store: ShootingStarIcon,
  users: GroupIcon,
  package: BoxCubeIcon,
  boxes: BoxIconLine,
  truck: PageIcon,
  'file-text': DocsIcon,
  wallet: DollarLineIcon,
  'bar-chart': PieChartIcon,
  'map-pin': PlugInIcon,
  'id-card': UserCircleIcon,
  calendar: CalenderIcon,
  settings: ListIcon,
  history: TimeIcon,
  table: TableIcon,
};
