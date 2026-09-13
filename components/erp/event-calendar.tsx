'use client';

// The holiday-and-event calendar the Blade rendered with FullCalendar, on the
// dashboard and on the Events screen.
//
// `calendarEvents()` already normalises holidays and events into FullCalendar's
// shape - a single-day holiday carries `date`, a range carries `start`/`end`
// with the end pushed out a day so it renders inclusively.

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import type { CalendarEvent } from '@/lib/dashboard/queries';

export function EventCalendar({
  events,
  initialView = 'dayGridMonth',
  height = 620,
}: {
  events: CalendarEvent[];
  initialView?: 'dayGridMonth' | 'listMonth';
  height?: number;
}) {
  return (
    // FullCalendar ships its own CSS variables; these map the ones that show
    // through to the design system's tokens so it matches in both themes.
    <div
      className="erp-calendar text-sm"
      style={
        {
          '--fc-border-color': 'var(--border)',
          '--fc-page-bg-color': 'transparent',
          '--fc-neutral-bg-color': 'var(--muted)',
          '--fc-today-bg-color': 'color-mix(in oklab, var(--primary) 10%, transparent)',
          '--fc-event-bg-color': 'var(--primary)',
          '--fc-event-border-color': 'var(--primary)',
          '--fc-event-text-color': 'var(--primary-foreground)',
          '--fc-button-bg-color': 'var(--muted)',
          '--fc-button-border-color': 'var(--border)',
          '--fc-button-text-color': 'var(--foreground)',
          '--fc-button-active-bg-color': 'var(--primary)',
          '--fc-button-active-border-color': 'var(--primary)',
          '--fc-button-hover-bg-color': 'var(--accent)',
          '--fc-button-hover-border-color': 'var(--border)',
        } as React.CSSProperties
      }
    >
      <FullCalendar
        plugins={[dayGridPlugin, listPlugin]}
        initialView={initialView}
        height={height}
        events={events.map((event) => ({
          title: event.title,
          date: event.date,
          start: event.start,
          end: event.end,
          url: event.url ?? undefined,
          extendedProps: { description: event.description },
        }))}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,listMonth',
        }}
        buttonText={{ today: 'Today', month: 'Month', list: 'List' }}
        dayMaxEvents={3}
        // An event with no URL should not look clickable.
        eventClassNames={(arg) => (arg.event.url ? [] : ['cursor-default'])}
      />
    </div>
  );
}
