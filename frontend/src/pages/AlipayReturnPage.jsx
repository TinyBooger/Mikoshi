import { useEffect, useMemo, useRef, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useToast } from '../components/ToastProvider';
import { AuthContext } from '../components/AuthProvider';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';

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

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        {isProUpgradeForView ? (
          <>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
            <h2 style={{ marginBottom: 12 }}>欢迎成为Pro会员！</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>
              您已成功升级，现在可以享受Pro会员的所有特权。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <PrimaryButton
                onClick={() => navigate('/profile')}
                style={{ minWidth: 132 }}
              >
                查看我的账户
              </PrimaryButton>
              <SecondaryButton
                onClick={() => navigate('/')}
                style={{ minWidth: 132 }}
              >
                回到首页
              </SecondaryButton>
            </div>
          </>
        ) : isTokenTopupForView ? (
          <>
            <div style={{ fontSize: '2.6rem', marginBottom: 12 }}>💰</div>
            <h2 style={{ marginBottom: 12 }}>Token充值成功</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>
              钱包Token已到账，可在套餐额度用尽后继续使用。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <PrimaryButton
                onClick={() => navigate('/token-topup')}
                style={{ minWidth: 132 }}
              >
                继续充值
              </PrimaryButton>
              <SecondaryButton
                onClick={() => navigate('/chat')}
                style={{ minWidth: 132 }}
              >
                去聊天
              </SecondaryButton>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: 12 }}>支付结果</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>
              支付已完成，请点击下方按钮继续。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <SecondaryButton
                onClick={() => navigate('/')}
                style={{ minWidth: 132 }}
              >
                回到首页
              </SecondaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AlipayReturnPage;
