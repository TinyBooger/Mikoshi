import { useEffect, useMemo, useRef, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useToast } from '../components/ToastProvider';
import { AuthContext } from '../components/AuthProvider';

function extractCharacterIdFromOutTradeNo(outTradeNo) {
  if (!outTradeNo || !outTradeNo.startsWith('CHAR_')) {
    return null;
  }
  const match = outTradeNo.match(/_C(\d+)$/);
  if (!match) {
    return null;
  }
  const characterId = Number(match[1]);
  return Number.isFinite(characterId) ? characterId : null;
}

function isPaymentSuccessStatus(status) {
  return status === 'TRADE_SUCCESS' || status === 'TRADE_FINISHED';
}

function AlipayReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshUserData } = useContext(AuthContext);
  const handledRef = useRef(false);
  const queryKey = useMemo(() => searchParams.toString(), [searchParams]);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }

    const params = new URLSearchParams(queryKey);
    const outTradeNo = params.get('out_trade_no');
    const tradeNo = params.get('trade_no');
    const totalAmount = params.get('total_amount');

    if (outTradeNo) {
      const handledKey = `alipay_return_handled_${outTradeNo}`;
      if (sessionStorage.getItem(handledKey)) {
        handledRef.current = true;
        return;
      }
      sessionStorage.setItem(handledKey, '1');
    }

    const verifyReturn = async () => {
      if (!window.API_BASE_URL) {
        return null;
      }

      const queryString = queryKey ? `?${queryKey}` : '';
      try {
        const response = await fetch(`${window.API_BASE_URL}/api/alipay/return${queryString}`);
        if (!response.ok) {
          return null;
        }
        return await response.json();
      } catch (error) {
        return null;
      }
    };

    if (outTradeNo) {
      // 检查是否是Pro升级订单
      const isProUpgrade = outTradeNo.startsWith('PRO_');
      const isCharacterPurchase = outTradeNo.startsWith('CHAR_');
      const characterId = extractCharacterIdFromOutTradeNo(outTradeNo);
      
      if (isProUpgrade) {
        toast.show(`恭喜！您已成功升级为Pro会员！订单号：${outTradeNo}`, { type: 'success' });
        verifyReturn().then((result) => {
          if (isPaymentSuccessStatus(result?.trade_status)) {
            if (refreshUserData) {
              refreshUserData({ silent: true });
            }
          }
        });
      } else if (isCharacterPurchase) {
        toast.show(`支付成功！订单号：${outTradeNo}，金额：¥${totalAmount}`, { type: 'success' });
        verifyReturn().then((result) => {
          if (isPaymentSuccessStatus(result?.trade_status) && characterId) {
            navigate(`/chat?character=${characterId}`, { replace: true });
          }
        });
      } else {
        toast.show(`支付成功！订单号：${outTradeNo}，金额：¥${totalAmount}`, { type: 'success' });
        verifyReturn();
      }
    } else {
      toast.show('未检测到有效的支付回调参数', { type: 'error' });
    }
    handledRef.current = true;
  }, [queryKey, toast, refreshUserData]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        {searchParams.get('out_trade_no')?.startsWith('PRO_') ? (
          <>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
            <h2 style={{ marginBottom: 12 }}>欢迎成为Pro会员！</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>
              您已成功升级，现在可以享受Pro会员的所有特权。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                className="btn"
                onClick={() => navigate('/profile')}
                style={{ padding: '0.5rem 1rem' }}
              >
                查看我的账户
              </button>
              <button
                className="btn"
                onClick={() => navigate('/')}
                style={{ padding: '0.5rem 1rem' }}
              >
                回到首页
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: 12 }}>支付结果</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>
              如果支付已完成但页面未自动跳转，你可以返回测试页查看订单状态。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                className="btn"
                onClick={() => navigate('/alipay/test')}
                style={{ padding: '0.5rem 1rem' }}
              >
                返回测试页
              </button>
              <button
                className="btn"
                onClick={() => navigate('/')}
                style={{ padding: '0.5rem 1rem' }}
              >
                回到首页
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AlipayReturnPage;
