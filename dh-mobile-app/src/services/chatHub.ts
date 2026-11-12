import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { CHAT_API_URL } from '../config/api';

let connection: HubConnection | null = null;
let connectedKey: string | null = null;
let starting: Promise<HubConnection> | null = null;

function buildHub(userId: string, comSerialID: number): HubConnection {
  const params = new URLSearchParams({
    userID: userId,
    comSerialID: String(comSerialID),
  });

  return new HubConnectionBuilder()
    .withUrl(`${CHAT_API_URL}/hubs/chat?${params.toString()}`, {
      // Keep the login token off this URL. A long token makes negotiate return HTTP 414.
      // The hub reads userID and comSerialID from the query.
      // chat.pskerp.com is behind Cloudflare. Negotiate succeeds, then the
      // WebSocket upgrade is dropped. Long polling reaches the same hub.
      transport: HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect()
    .configureLogging(__DEV__ ? LogLevel.Information : LogLevel.Error)
    .build();
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
    connection = buildHub(userId, comSerialID);
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
