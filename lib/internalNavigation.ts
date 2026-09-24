export const INTERNAL_FALLBACK_ROUTE = '/dashboard';

const INTERNAL_ROUTE_PREFIXES = [
  '/dashboard',
  '/create-post',
  '/bulk-upload',
  '/calendar',
  '/scheduled',
  '/published',
  '/accounts',
  '/analytics',
  '/team',
  '/billing',
  '/settings',
];

const HISTORY_KEY = 'smos:internal-route-history';
const MAX_HISTORY_ITEMS = 30;

function stripOrigin(path: string) {
  try {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      const url = new URL(path);
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return path;
  }

  return path;
}

function getPathname(path: string) {
  return stripOrigin(path).split('?')[0].replace(/\/$/, '') || '/';
}

export function isInternalAppRoute(path: string) {
  const pathname = getPathname(path);

  return INTERNAL_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function normalizeInternalPath(path: string) {
  const normalized = stripOrigin(path);
  return isInternalAppRoute(normalized) ? normalized : INTERNAL_FALLBACK_ROUTE;
}

export function readInternalRouteHistory() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map(normalizeInternalPath)
      .filter(isInternalAppRoute);
  } catch {
    return [];
  }
}

function writeInternalRouteHistory(history: string[]) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history.slice(-MAX_HISTORY_ITEMS))
  );
}

export function rememberInternalRoute(path: string) {
  const normalized = normalizeInternalPath(path);
  const history = readInternalRouteHistory();
  const last = history[history.length - 1];

  if (last === normalized) return;

  if (last && getPathname(last) === getPathname(normalized)) {
    writeInternalRouteHistory([...history.slice(0, -1), normalized]);
    return;
  }

  writeInternalRouteHistory([...history, normalized]);
}

export function resolveInternalBackTarget(currentPath: string) {
  const normalizedCurrent = normalizeInternalPath(currentPath);
  const currentScreen = getPathname(normalizedCurrent);
  const history = readInternalRouteHistory();

  while (history.length > 0 && getPathname(history[history.length - 1]) === currentScreen) {
    history.pop();
  }

  const target = [...history].reverse().find(
    (path) => getPathname(path) !== currentScreen && isInternalAppRoute(path)
  );

  if (target) {
    const targetIndex = history.lastIndexOf(target);
    writeInternalRouteHistory(history.slice(0, targetIndex + 1));
    return target;
  }

  writeInternalRouteHistory([INTERNAL_FALLBACK_ROUTE]);
  return INTERNAL_FALLBACK_ROUTE;
}
