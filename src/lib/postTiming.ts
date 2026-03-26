import { format } from 'date-fns';

interface IncidentTimingLike {
  incidentDate?: string | null;
  incidentTime?: string | null;
}

function formatIncidentDate(incidentDate: string): string {
  const parsed = new Date(`${incidentDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? incidentDate : format(parsed, 'MMM d, yyyy');
}

function formatIncidentTime(incidentTime: string): string {
  const [rawHour, rawMinute] = incidentTime.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return incidentTime;
  }

  const period = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = ((hour + 11) % 12) + 1;
  return `${normalizedHour}:${String(minute).padStart(2, '0')} ${period}`;
}

export function formatIncidentTiming({
  incidentDate,
  incidentTime,
}: IncidentTimingLike): string | null {
  if (!incidentDate && !incidentTime) {
    return null;
  }

  const dateLabel = incidentDate ? formatIncidentDate(incidentDate) : null;
  const timeLabel = incidentTime ? formatIncidentTime(incidentTime) : null;

  if (dateLabel && timeLabel) {
    return `${dateLabel} at ${timeLabel}`;
  }

  if (dateLabel) {
    return dateLabel;
  }

  return timeLabel ? `Approx. ${timeLabel}` : null;
}
