/**
 * Dashboard widgets, ported from the shared product design system.
 *
 * These are composition-level pieces the dashboard assembles, not `ui/`
 * primitives: each is a card with its own header, overflow menu and loading
 * shape, driven entirely by props.
 */
export { YAxisTick, Y_AXIS_WIDTH } from './chart-axis';
export { CardOverflowMenu, type CardOverflowMenuProps } from './card-overflow-menu';
export {
  StatisticsCard,
  type StatisticsCardProps,
  type StatAccent,
} from './statistics-card';
export {
  HighlightStatCard,
  type HighlightStatCardProps,
  type HighlightTrendDirection,
} from './highlight-stat-card';
export {
  TrendReportCard,
  type TrendReportCardProps,
  type TrendPoint,
  type ReportRow,
} from './trend-report-card';
export {
  BreakdownListCard,
  type BreakdownListCardProps,
  type BreakdownRow,
} from './breakdown-list-card';
export {
  WeeklyOverviewCard,
  type WeeklyOverviewCardProps,
  type WeeklyOverviewPoint,
} from './weekly-overview-card';
export {
  VehiclesConditionCard as RingListCard,
  type VehiclesConditionCardProps as RingListCardProps,
  type VehiclesConditionRow as RingListRow,
} from './vehicles-condition-card';
export {
  TopCustomersCard,
  type TopCustomersCardProps,
  type TopCustomer,
} from './top-customers-card';
