import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../components/AuthProvider.jsx';

const REFRESH_INTERVAL_MS = 60_000;
export const PROBLEM_REPORTS_UPDATED_EVENT = 'problem-reports-updated';

const EMPTY_COUNTS = { issueCount: 0, moderationCount: 0, totalCount: 0 };

/**
 * Unhandled (pending) report counts for users with admin access: bug/website
 * issue reports, entity (moderation) reports, and their total.
 * Polls periodically and refreshes on window focus or an explicit update event.
 */
export function useUnhandledProblemReportCount() {
  const { userData, sessionToken } = useContext(AuthContext);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const enabled = Boolean(userData?.is_admin && sessionToken);

  const refresh = useCallback(() => {
    if (!enabled) {
      setCounts(EMPTY_COUNTS);
      return;
    }
    fetch(`${window.API_BASE_URL}/api/problem-reports/unhandled-count`, {
      headers: { Authorization: sessionToken },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const issueCount = Number(data?.unhandled_count) || 0;
        const moderationCount = Number(data?.moderation_count) || 0;
        setCounts({
          issueCount,
          moderationCount,
          totalCount: Number(data?.total_count) || issueCount + moderationCount,
        });
      })
      .catch(() => {});
  }, [enabled, sessionToken]);

  useEffect(() => {
    if (!enabled) {
      setCounts(EMPTY_COUNTS);
      return undefined;
    }

    refresh();
    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener(PROBLEM_REPORTS_UPDATED_EVENT, refresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(PROBLEM_REPORTS_UPDATED_EVENT, refresh);
    };
  }, [enabled, refresh]);

  return counts;
}

export function notifyProblemReportsUpdated() {
  window.dispatchEvent(new Event(PROBLEM_REPORTS_UPDATED_EVENT));
}
