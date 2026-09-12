'use client';

// ---------------------------------------------------------------------------
// Dashboard charts - the ApexCharts panels from TailAdmin, fed by the ERP's
// own series (App\Charts\SalesChart, DailyProfit, MonthlyProfit, YearlyProfit
// and ProductQuantity in the PHP stack).
// ---------------------------------------------------------------------------

import React from 'react';
import type { ApexOptions } from 'apexcharts';
import dynamic from 'next/dynamic';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const FONT = 'Outfit, sans-serif';

/** `monthlySales()` / `yearlySales()` - the sale statistics panel. */
export function SalesChart({
  title,
  labels,
  data,
  seriesName,
  currencySymbol,
}: {
  title: string;
  labels: string[];
  data: number[];
  seriesName: string;
  currencySymbol: string;
}) {
  const options: ApexOptions = {
    colors: ['#465fff'],
    chart: { fontFamily: FONT, type: 'bar', height: 220, toolbar: { show: false } },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '39%',
        borderRadius: 5,
        borderRadiusApplication: 'end',
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 4, colors: ['transparent'] },
    xaxis: {
      categories: labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    legend: { show: true, position: 'top', horizontalAlign: 'left', fontFamily: 'Outfit' },
    yaxis: { title: { text: undefined } },
    grid: { yaxis: { lines: { show: true } } },
    fill: { opacity: 1 },
    tooltip: {
      x: { show: true },
      y: { formatter: (val: number) => `${currencySymbol} ${val.toFixed(2)}` },
    },
  };

  return (
    <ChartPanel title={title}>
      <div className="-ml-5 min-w-[650px] xl:min-w-full pl-2">
        <ReactApexChart
          options={options}
          series={[{ name: seriesName, data }]}
          type="bar"
          height={220}
        />
      </div>
    </ChartPanel>
  );
}

/** The profit panels - cost of goods against the branch's sale postings. */
export function ProfitChart({
  title,
  labels,
  mainAmount,
  saleAmount,
  currencySymbol,
}: {
  title: string;
  labels: string[];
  mainAmount: number[];
  saleAmount: number[];
  currencySymbol: string;
}) {
  const options: ApexOptions = {
    colors: ['#7c32ff', '#465fff'],
    chart: {
      fontFamily: FONT,
      type: 'bar',
      height: 260,
      stacked: false,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: { horizontal: false, columnWidth: '39%', borderRadius: 5 },
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 4, colors: ['transparent'] },
    xaxis: { categories: labels, axisBorder: { show: false }, axisTicks: { show: false } },
    legend: { show: true, position: 'top', horizontalAlign: 'left', fontFamily: 'Outfit' },
    grid: { yaxis: { lines: { show: true } } },
    fill: { opacity: 1 },
    tooltip: { y: { formatter: (val: number) => `${currencySymbol} ${val.toFixed(2)}` } },
  };

  return (
    <ChartPanel title={title}>
      <div className="-ml-5 min-w-[650px] xl:min-w-full pl-2">
        <ReactApexChart
          options={options}
          series={[
            { name: 'Main Amount', data: mainAmount },
            { name: 'Sale Amount', data: saleAmount },
          ]}
          type="bar"
          height={260}
        />
      </div>
    </ChartPanel>
  );
}

/** `productQuantity()` - branch-wise stock on hand. */
export function BranchStockChart({
  title,
  labels,
  data,
}: {
  title: string;
  labels: string[];
  data: number[];
}) {
  const options: ApexOptions = {
    colors: ['#12b76a'],
    chart: { fontFamily: FONT, type: 'bar', height: 260, toolbar: { show: false } },
    plotOptions: {
      bar: { horizontal: true, barHeight: '45%', borderRadius: 4 },
    },
    dataLabels: { enabled: false },
    xaxis: { categories: labels },
    grid: { yaxis: { lines: { show: true } } },
    tooltip: { y: { formatter: (val: number) => `${val} units` } },
  };

  return (
    <ChartPanel title={title}>
      <ReactApexChart
        options={options}
        series={[{ name: 'Stock', data }]}
        type="bar"
        height={260}
      />
    </ChartPanel>
  );
}

function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 pb-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h3>
      </div>
      <div className="max-w-full overflow-x-auto custom-scrollbar">{children}</div>
    </div>
  );
}
