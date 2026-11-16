import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { resolveChatBase } from '../config/serviceHosts';

let connection: HubConnection | null = null;
let connectedKey: string | null = null;
let starting: Promise<HubConnection> | null = null;

async function buildHub(userId: string, comSerialID: number): Promise<HubConnection> {
  const params = new URLSearchParams({
    userID: userId,
    comSerialID: String(comSerialID),
  });
  const base = await resolveChatBase();

  const hub = new HubConnectionBuilder()
    .withUrl(`${base}/hubs/chat?${params.toString()}`, {
      // Keep the login token off this URL. A long token makes negotiate return HTTP 414.
      // The hub reads userID and comSerialID from the query.
      // chat.pskerp.com is behind Cloudflare. Negotiate succeeds, then the
      // WebSocket upgrade is dropped. Long polling reaches the same hub.
      transport: HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect()
    .configureLogging(__DEV__ ? LogLevel.Information : LogLevel.Error)
    .build();

  // The server tells the client when someone reads a message. The screen
  // does not show read receipts, but the hub still expects this method.
  hub.on('messageRead', () => undefined);
  return hub;
}

export async function ensureChatHub(userId: string, comSerialID: number): Promise<HubConnection> {
  if (!userId.trim()) {
    throw new Error('userID is required.');
  }

  if (!comSerialID) {
    throw new Error('comSerialID is required.');
  }

  const key = `${userId}:${comSerialID}`;
  if (connection && connectedKey !== key) {
    await stopChatHub();
  }

  if (!connection) {
    connection = await buildHub(userId, comSerialID);
    connectedKey = key;
  }

  const hub = connection;
  if (hub.state === HubConnectionState.Connected) {
    return hub;
  }

  if (!starting) {
    starting = hub
      .start()
      .then(() => hub)
      .catch((err) => {
        if (connection === hub) {
          connection = null;
          connectedKey = null;
        }
        throw err;
      })
      .finally(() => {
        starting = null;
      });
  }

  return starting;
}

export async function stopChatHub(): Promise<void> {
  const hub = connection;
  connection = null;
  connectedKey = null;
  starting = null;
  if (hub && hub.state !== HubConnectionState.Disconnected) {
    await hub.stop();
  }
}
