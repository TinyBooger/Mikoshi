import { useEffect } from 'react';

const CHANNEL_NAME = 'mikoshi-credit-topup-return';
const STORAGE_KEY = 'mikoshi-credit-topup-return';
const REFRESH_INTERVAL_MS = 5000;
const REFRESH_DURATION_MS = 120000;

export function useCreditTopupRefresh(refreshUserData, enabled = true) {
  useEffect(() => {
    if (!enabled || !refreshUserData) return undefined;

    let pollIntervalId;
    let channel;
    let pollingStarted = false;

    const startCreditRefreshPolling = () => {
      if (pollingStarted) return;
      pollingStarted = true;
      refreshUserData({ silent: true });

      const startedAt = Date.now();
      pollIntervalId = window.setInterval(() => {
        refreshUserData({ silent: true });
        if (Date.now() - startedAt >= REFRESH_DURATION_MS) {
          window.clearInterval(pollIntervalId);
        }
      }, REFRESH_INTERVAL_MS);
    };

    const handleStorage = (event) => {
      if (event.key === STORAGE_KEY) {
        startCreditRefreshPolling();
      }
    };

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.addEventListener('message', (event) => {
        if (event.data?.type === 'credit-topup-return') {
          startCreditRefreshPolling();
        }
      });
    } else {
      window.addEventListener('storage', handleStorage);
    }

    return () => {
      if (pollIntervalId) window.clearInterval(pollIntervalId);
      channel?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [enabled, refreshUserData]);
}
