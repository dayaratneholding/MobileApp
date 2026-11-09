/** Button ids returned inside the login token. */
export const GroupMessagePermission = {
  add: 3666,
  edit: 3667,
  view: 3668,
  save: 3669,
  delete: 3670,
} as const;

export const GroupMemberPermission = {
  add: 3672,
  edit: 3673,
  view: 3674,
  save: 3675,
  delete: 3676,
} as const;

const PERMISSION_KEY = /perm|menu|mnu|btn|button|right|access/i;

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const atobFn = (globalThis as { atob?: (data: string) => string }).atob;
  if (!atobFn) return '';

  const binary = atobFn(padded);
  try {
    return decodeURIComponent(
      Array.from(binary)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
  } catch {
    return binary;
  }
}

function addId(into: Set<number>, value: number) {
  if (Number.isInteger(value) && value > 0 && value < 1_000_000) {
    into.add(value);
  }
}

function collectIds(value: unknown, into: Set<number>, permissionClaim: boolean) {
  if (typeof value === 'number') {
    if (permissionClaim) addId(into, value);
    return;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('[') || trimmed.startsWith('{')) && trimmed.length > 2) {
      try {
        collectIds(JSON.parse(trimmed), into, permissionClaim);
        return;
      } catch {
        // The claim is a plain list, not JSON.
      }
    }

    const parts = trimmed.split(/[^0-9]+/).filter(Boolean);
    if (permissionClaim || parts.length >= 2) {
      parts.forEach((part) => addId(into, Number(part)));
    }
    return;
  }

  if (Array.isArray(value)) {
    const numeric = value.every(
      (item) =>
        (typeof item === 'number' && Number.isInteger(item)) ||
        (typeof item === 'string' && /^\d+$/.test(item.trim())),
    );
    value.forEach((item) => collectIds(item, into, permissionClaim || numeric));
    return;
  }

  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      collectIds(child, into, permissionClaim || PERMISSION_KEY.test(key));
    });
  }
}

const KNOWN_PERMISSION_IDS = [
  GroupMessagePermission.add,
  GroupMessagePermission.edit,
  GroupMessagePermission.view,
  GroupMessagePermission.save,
  GroupMessagePermission.delete,
  GroupMemberPermission.add,
  GroupMemberPermission.edit,
  GroupMemberPermission.view,
  GroupMemberPermission.save,
  GroupMemberPermission.delete,
];

export function readPermissionIds(token: string): number[] {
  const payload = token.split('.')[1];
  if (!payload) return [];

  try {
    const decoded = decodeBase64Url(payload);
    const json = JSON.parse(decoded) as unknown;
    const ids = new Set<number>();
    collectIds(json, ids, false);
    KNOWN_PERMISSION_IDS.forEach((id) => {
      if (new RegExp(`(^|[^0-9])${id}([^0-9]|$)`).test(decoded)) {
        ids.add(id);
      }
    });
    return [...ids];
  } catch {
    return [];
  }
}

export function hasPermission(permissionIds: number[] | undefined, permissionId: number): boolean {
  return (permissionIds ?? []).includes(permissionId);
}
