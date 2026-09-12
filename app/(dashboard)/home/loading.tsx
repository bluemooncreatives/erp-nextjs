import { HighlightStatCard, StatisticsCard, TrendReportCard, BreakdownListCard, WeeklyOverviewCard, RingListCard } from '@/components/dashboard';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        <div className="col-span-2 flex flex-col gap-6 lg:col-span-3 xl:flex-row xl:items-stretch">
          <HighlightStatCard className="xl:w-72 xl:shrink-0" title="Total sale" caption="Received to date" value="" loading />
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-6 lg:grid-cols-4">
            {['Total purchase', 'Expense', 'Invoice due', 'Net profit'].map((title) => (
              <StatisticsCard key={title} title={title} value="" icon={<Skeleton className="size-4" />} badge="Loading" loading />
            ))}
          </div>
        </div>
        <TrendReportCard className="col-span-2" trendTitle="Sales throughput" trendCaption="Invoiced per month, this year" seriesLabel="Sales" reportTitle="All time" reportCaption="Across every open invoice" data={[]} rows={[]} loading />
        <BreakdownListCard className="max-sm:col-span-full md:max-lg:col-span-full" title="Cash position" rows={[]} loading />
        <WeeklyOverviewCard className="max-sm:col-span-full md:max-lg:col-span-full" title="Sales vs purchases" data={[]} loading />
        <RingListCard className="max-sm:col-span-full md:max-lg:col-span-full" title="Stock by branch" rows={[]} loading />
        <Card className="max-sm:col-span-full md:max-lg:col-span-full">
          <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
          <CardContent className="space-y-3.5">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </CardContent>
        </Card>
        <Card className="col-span-full gap-0 py-0">
          <div className="space-y-2 px-4 py-4 sm:px-6"><Skeleton className="h-6 w-40" /><Skeleton className="h-5 w-64 max-w-full" /></div>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 border-t px-4 py-4 sm:px-6"><Skeleton className="size-9 rounded-full" /><Skeleton className="h-8 w-48" /></div>
          ))}
        </Card>
      </div>
    </div>
  );
}
