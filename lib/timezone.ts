import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const WORKSPACE_TIMEZONE = 'Asia/Karachi';

export const TIMEZONE_OPTIONS = [
  {
    value: 'Asia/Karachi',
    label: 'Asia/Karachi (PKT +05:00)',
    shortLabel: 'PKT',
  },
  {
    value: 'UTC',
    label: 'UTC (Coordinated Universal Time)',
    shortLabel: 'UTC',
  },
  {
    value: 'America/New_York',
    label: 'America/New_York (ET)',
    shortLabel: 'ET',
  },
  {
    value: 'America/Los_Angeles',
    label: 'America/Los_Angeles (PT)',
    shortLabel: 'PT',
  },
  {
    value: 'Europe/London',
    label: 'Europe/London (GMT/BST)',
    shortLabel: 'GMT/BST',
  },
];

export function getTimezoneLabel(timezone?: string | null) {
  if (!timezone) return TIMEZONE_OPTIONS[0].label;
  return TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label || timezone;
}

export function getTimezoneShortLabel(timezone?: string | null) {
  if (!timezone) return TIMEZONE_OPTIONS[0].shortLabel;
  return TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.shortLabel || timezone;
}

export function getDateKeyInTimeZone(
  date: Date | string | number,
  timezone = WORKSPACE_TIMEZONE
) {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

export function getTodayDateKey(timezone = WORKSPACE_TIMEZONE) {
  return getDateKeyInTimeZone(new Date(), timezone);
}

export function createDateFromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

export function isValidDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;

  const date = createDateFromDateKey(dateKey);
  const [year, month, day] = dateKey.split('-').map(Number);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function zonedDateTimeToUtcDate(
  dateKey: string,
  timeValue: string,
  timezone = WORKSPACE_TIMEZONE
) {
  if (!isValidDateKey(dateKey) || !timeValue) {
    throw new Error('A valid publish date and publish time are required.');
  }

  const utcDate = fromZonedTime(`${dateKey}T${timeValue}:00`, timezone);
  if (Number.isNaN(utcDate.getTime())) {
    throw new Error('A valid publish date and publish time are required.');
  }

  return utcDate;
}

export function zonedDateTimeToUtcIso(
  dateKey: string,
  timeValue: string,
  timezone = WORKSPACE_TIMEZONE
) {
  return zonedDateTimeToUtcDate(dateKey, timeValue, timezone).toISOString();
}

export function formatDateInTimeZone(
  date: Date | string | number,
  timezone = WORKSPACE_TIMEZONE
) {
  return formatInTimeZone(date, timezone, 'MMM d, yyyy');
}

export function formatMonthYearInTimeZone(
  date: Date | string | number,
  timezone = WORKSPACE_TIMEZONE
) {
  return formatInTimeZone(date, timezone, 'MMMM yyyy');
}

export function formatTimeInTimeZone(
  date: Date | string | number,
  timezone = WORKSPACE_TIMEZONE
) {
  return formatInTimeZone(date, timezone, 'h:mm a');
}

export function formatTimeInputInTimeZone(
  date: Date | string | number,
  timezone = WORKSPACE_TIMEZONE
) {
  return formatInTimeZone(date, timezone, 'HH:mm');
}

export function formatDateKeyForDisplay(dateKey: string) {
  return formatInTimeZone(`${dateKey}T00:00:00Z`, 'UTC', 'MMM d, yyyy');
}

export function formatTimeInputForDisplay(timeValue: string) {
  if (!timeValue) return '';
  const [hourText, minuteText] = timeValue.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return timeValue;

  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}
