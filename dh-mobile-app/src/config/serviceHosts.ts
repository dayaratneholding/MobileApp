const CHAT_BASES = ['https://chat.pskerp.com', 'http://2.24.130.171:5055'];
const FILE_BASES = ['https://files.pskerp.com/api/', 'http://2.24.130.171:5000/api/'];
const FACE_BASES = ['https://facerecognition.pskerp.com'];

let chatBase = CHAT_BASES[0];
let fileBase = FILE_BASES[0];
let faceBase = FACE_BASES[0];

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function canOpen(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'GET', signal: withTimeout(5000) });
    return response.status > 0 && response.status < 500;
  } catch {
    return false;
  }
}

async function firstReachable(preferred: string, candidates: string[], probe: (base: string) => string): Promise<string> {
  const ordered = [preferred, ...candidates.filter((item) => item !== preferred)];
  for (const base of ordered) {
    if (await canOpen(probe(base))) {
      return base;
    }
  }
  return ordered[ordered.length - 1] ?? preferred;
}

/** Use the chat name when the phone can resolve it, otherwise the direct server address. */
export async function resolveChatBase(): Promise<string> {
  chatBase = await firstReachable(chatBase, CHAT_BASES, (base) => base);
  return chatBase;
}

/** Use the file name when the phone can resolve it, otherwise the direct server address. */
export async function resolveFileManagerBase(): Promise<string> {
  fileBase = await firstReachable(fileBase, FILE_BASES, (base) => `${base}health`);
  return fileBase;
}

export function currentFileManagerBase(): string {
  return fileBase;
}

/** Use the face name when the phone can resolve it, otherwise the direct server address. */
export async function resolveFaceBase(): Promise<string> {
  faceBase = await firstReachable(faceBase, FACE_BASES, (base) => `${base}/health`);
  return faceBase;
}
