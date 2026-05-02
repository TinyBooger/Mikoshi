import { useEffect, useMemo, useRef, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useToast } from '../components/ToastProvider';
import { AuthContext } from '../components/AuthProvider';

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
  const outTradeNoForView = searchParams.get('out_trade_no');
  const isProUpgradeForView = outTradeNoForView?.startsWith('PRO_');
  const isTokenTopupForView = outTradeNoForView?.startsWith('TOPUP_');

  useEffect(() => {
    if (handledRef.current) {
      return;
    }

    const params = new URLSearchParams(queryKey);
    const outTradeNo = params.get('out_trade_no');
    const tradeNo = params.get('trade_no');
    const totalAmount = params.get('total_amount');
    let wasHandled = false;

    if (outTradeNo) {
      const handledKey = `alipay_return_handled_${outTradeNo}`;
      if (sessionStorage.getItem(handledKey)) {
        wasHandled = true;
      } else {
        sessionStorage.setItem(handledKey, '1');
      }
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
      const isTokenTopup = outTradeNo.startsWith('TOPUP_');
      
      if (isProUpgrade) {
        if (!wasHandled) {
          toast.show(`恭喜！您已成功升级为Pro会员！订单号：${outTradeNo}`, { type: 'success' });
        }
        verifyReturn().then((result) => {
          if (isPaymentSuccessStatus(result?.trade_status)) {
            if (refreshUserData) {
              refreshUserData({ silent: true });
            }
          }
        });
      } else if (isTokenTopup) {
        if (!wasHandled) {
          toast.show(`Token充值成功！订单号：${outTradeNo}`, { type: 'success' });
        }
        verifyReturn().then((result) => {
          if (isPaymentSuccessStatus(result?.trade_status) && refreshUserData) {
            refreshUserData({ silent: true });
          }
        });
      } else {
        if (!wasHandled) {
          toast.show(`支付成功！订单号：${outTradeNo}，金额：¥${totalAmount}`, { type: 'success' });
        }
        verifyReturn();
      }
    } else {
      toast.show('未检测到有效的支付回调参数', { type: 'error' });
    }
    handledRef.current = true;
  }, [queryKey, toast, refreshUserData]);

  const baseButtonStyle = {
    borderRadius: '0.65rem',
    border: '1px solid #d8dbe2',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
    minWidth: 132,
    padding: '0.56rem 1.05rem',
  };

  const neutralButtonStyle = {
    ...baseButtonStyle,
    background: '#f3f4f6',
    border: '1px solid #e1e5eb',
    color: '#4b5563',
  };

  const lavenderButtonStyle = {
    ...baseButtonStyle,
    background: '#ede7f7',
    border: '1px solid #ddd4ef',
    color: '#5f567f',
  };

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div
        style={{
          textAlign: 'center',
          maxWidth: 560,
          width: '100%',
          background: '#fff',
          border: '1px solid #ece9f4',
          borderRadius: 16,
          boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
          padding: '1.3rem 1.1rem',
        }}
      >
        {isProUpgradeForView ? (
          <>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
            <h2 style={{ marginBottom: 10, color: '#2f2b3d' }}>欢迎成为Pro会员！</h2>
            <p style={{ color: '#666', marginBottom: 22 }}>
              您已成功升级，现在可以享受Pro会员的所有特权。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/profile')}
                style={lavenderButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e7e0f4';
                  e.currentTarget.style.color = '#554d73';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ede7f7';
                  e.currentTarget.style.color = '#5f567f';
                }}
              >
                查看我的账户
              </button>
              <button
                onClick={() => navigate('/')}
                style={neutralButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#eceff4';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                }}
              >
                回到首页
              </button>
            </div>
          </>
        ) : isTokenTopupForView ? (
          <>
            <div style={{ fontSize: '2.6rem', marginBottom: 12 }}>💰</div>
            <h2 style={{ marginBottom: 10, color: '#2f2b3d' }}>Token充值成功</h2>
            <p style={{ color: '#666', marginBottom: 22 }}>
              钱包Token已到账，可在套餐额度用尽后继续使用。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/token-topup')}
                style={lavenderButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e7e0f4';
                  e.currentTarget.style.color = '#554d73';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ede7f7';
                  e.currentTarget.style.color = '#5f567f';
                }}
              >
                继续充值
              </button>
              <button
                onClick={() => navigate('/chat')}
                style={neutralButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#eceff4';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                }}
              >
                去聊天
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: 10, color: '#2f2b3d' }}>支付结果</h2>
            <p style={{ color: '#666', marginBottom: 22 }}>
              支付已完成，请点击下方按钮继续。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/')}
                style={neutralButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#eceff4';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                }}
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
