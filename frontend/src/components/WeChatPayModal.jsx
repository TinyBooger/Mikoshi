import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';
import QRCode from 'react-qr-code';
import { AuthContext } from './AuthProvider';
import '../styles/WeChatPayModal.css';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_COUNT = 100; // ~5 minutes

export default function WeChatPayModal({
  codeUrl,
  outTradeNo,
  orderType,
  amount,
  onSuccess,
  onCancel,
}) {
  const { sessionToken, refreshUserData } = useContext(AuthContext);
  const [status, setStatus] = useState('pending'); // pending | success | timeout | error
  const [errorMsg, setErrorMsg] = useState('');
  const pollCountRef = useRef(0);
  const pollTimerRef = useRef(null);
  const closedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const closeOrder = useCallback(async () => {
    if (closedRef.current || !outTradeNo) return;
    closedRef.current = true;
    try {
      await fetch(`${window.API_BASE_URL}/api/wechat/close-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: sessionToken },
        body: JSON.stringify({ out_trade_no: outTradeNo }),
      });
    } catch (_) {
      // best-effort
    }
  }, [outTradeNo, sessionToken]);

  const poll = useCallback(async () => {
    if (status !== 'pending') return;

    pollCountRef.current += 1;
    if (pollCountRef.current > POLL_MAX_COUNT) {
      stopPolling();
      setStatus('timeout');
      await closeOrder();
      return;
    }

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/wechat/query-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: sessionToken },
        body: JSON.stringify({ out_trade_no: outTradeNo }),
      });
      if (!res.ok) throw new Error('查询失败');
      const data = await res.json();
      const tradeState = data?.trade_state;

      if (tradeState === 'SUCCESS') {
        stopPolling();
        closedRef.current = true; // no need to close
        setStatus('success');
        if (refreshUserData) refreshUserData({ silent: true });
        if (onSuccess) onSuccess(orderType);
        return;
      }

      if (tradeState === 'CLOSED' || tradeState === 'PAYERROR') {
        stopPolling();
        setStatus('error');
        setErrorMsg('订单已关闭或支付失败，请重新发起支付');
        return;
      }
    } catch (e) {
      // network error; continue polling
    }

    pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [status, outTradeNo, sessionToken, stopPolling, closeOrder, refreshUserData, onSuccess, orderType]);

  useEffect(() => {
    pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      stopPolling();
      // Close order on unmount if still pending
      if (status === 'pending') {
        closeOrder();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = async () => {
    stopPolling();
    if (status === 'pending') {
      await closeOrder();
    }
    if (onCancel) onCancel();
  };

  const handleRetry = () => {
    if (onCancel) onCancel(); // let parent re-open a new order
  };

  return (
    <div className="wechat-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}>
      <div className="wechat-modal-box">
        {/* Header */}
        <div className="wechat-modal-header">
          <div className="wechat-modal-title">
            <i className="bi bi-wechat wechat-icon" />
            微信扫码支付
          </div>
          <button className="wechat-modal-close" onClick={handleCancel} aria-label="关闭">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Amount */}
        <div className="wechat-modal-amount">
          <span className="wechat-amount-label">支付金额</span>
          <span className="wechat-amount-value">¥{Number(amount).toFixed(2)}</span>
        </div>

        {/* QR area */}
        <div className="wechat-modal-qr-area">
          {status === 'pending' && (
            <>
              <div className="wechat-qr-wrapper">
                <QRCode value={codeUrl} size={180} />
              </div>
              <div className="wechat-scan-hint">
                <i className="bi bi-phone" />
                请使用微信扫一扫完成支付
              </div>
              <div className="wechat-polling-indicator">
                <span className="wechat-dot-pulse" />
                等待支付确认...
              </div>
            </>
          )}

          {status === 'success' && (
            <div className="wechat-status-success">
              <i className="bi bi-check-circle-fill" />
              <span>支付成功！</span>
            </div>
          )}

          {status === 'timeout' && (
            <div className="wechat-status-error">
              <i className="bi bi-clock-history" />
              <span>二维码已超时，请重新发起支付</span>
              <button className="btn btn-outline-success btn-sm mt-3" onClick={handleRetry}>
                重新发起支付
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="wechat-status-error">
              <i className="bi bi-exclamation-circle" />
              <span>{errorMsg || '支付遇到问题，请重试'}</span>
              <button className="btn btn-outline-success btn-sm mt-3" onClick={handleRetry}>
                重新发起支付
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wechat-modal-footer">
          <button className="btn btn-outline-secondary btn-sm" onClick={handleCancel}>
            取消支付
          </button>
        </div>
      </div>
    </div>
  );
}
