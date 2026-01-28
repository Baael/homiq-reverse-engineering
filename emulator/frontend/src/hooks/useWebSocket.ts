import { useEffect, useState, useCallback, useRef } from 'react';
import type { WsMessage } from '@homiq-emulator/shared';

interface UseWebSocketReturn {
  connected: boolean;
  messages: WsMessage[];
  clearMessages: () => void;
}

export function useWebSocket(maxMessages = 500): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('[WS] Connected');
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('[WS] Disconnected, reconnecting in 2s...');
        setTimeout(connect, 2000);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          setMessages((prev) => {
            const newMessages = [msg, ...prev];
            if (newMessages.length > maxMessages) {
              return newMessages.slice(0, maxMessages);
            }
            return newMessages;
          });
        } catch {
          console.error('[WS] Failed to parse message');
        }
      };
    }

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [maxMessages]);

  return { connected, messages, clearMessages };
}
