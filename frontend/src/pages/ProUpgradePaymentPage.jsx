import React, { useContext, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AuthContext } from '../components/AuthProvider';
import { useToast } from '../components/ToastProvider';
import PageWrapper from '../components/PageWrapper';
import WeChatPayModal from '../components/WeChatPayModal';

const planOptions = [
  { id: '1month', label: '1个月', amount: 15, unit: '/月' },
  { id: '3months', label: '3个月', amount: 40, unit: '/3月' },
  { id: '6months', label: '6个月', amount: 72, unit: '/6月' },
  { id: '1year', label: '1年', amount: 120, unit: '/年' },
];

function isMobileBrowser() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  return (
    window.matchMedia?.('(max-width: 768px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent)
  );
}

export default function ProUpgradePaymentPage() {
  const { userData, sessionToken } = useContext(AuthContext);
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultPlan = searchParams.get('plan') || '1month';
  const [selectedPlan, setSelectedPlan] = useState(defaultPlan);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('alipay');
  const [loading, setLoading] = useState(false);
  const [wechatQrData, setWechatQrData] = useState(null);

  const plan = planOptions.find((item) => item.id === selectedPlan) || planOptions[0];

  const paymentOptionStyle = (method) => ({
    borderRadius: '12px',
    border: selectedPaymentMethod === method
      ? method === 'alipay' ? '2px solid #1677ff' : '2px solid #07c160'
      : '1px solid #d9e2ec',
    background: '#fff',
    color: '#232323',
    padding: '0.75rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    cursor: 'pointer',
    fontWeight: 700,
    minWidth: 150,
    boxShadow: selectedPaymentMethod === method ? '0 6px 18px rgba(0,0,0,0.08)' : 'none',
    position: 'relative',
  });

  const handlePurchase = async () => {
    if (!userData || !sessionToken) {
      toast.show('请先登录后再继续', { type: 'info' });
      navigate('/login');
      return;
    }

    if (isMobileBrowser() && selectedPaymentMethod === 'wechat') {
      toast.show('手机端暂不支持微信支付，请使用支付宝支付', { type: 'info' });
      return;
    }

    if (selectedPaymentMethod !== 'alipay' && selectedPaymentMethod !== 'wechat') {
      toast.show('请选择支付方式', { type: 'info' });
      return;
    }

    const planDetails = {
      '1month': { amount: 15, subject: 'Pro会员1个月', body: 'Pro会员30天订阅' },
      '3months': { amount: 40, subject: 'Pro会员3个月', body: 'Pro会员90天订阅' },
      '6months': { amount: 72, subject: 'Pro会员6个月', body: 'Pro会员180天订阅' },
      '1year': { amount: 120, subject: 'Pro会员1年', body: 'Pro会员365天订阅' },
    };

    const selected = planDetails[selectedPlan];
    if (!selected) return;

    if (selectedPaymentMethod === 'wechat') {
      setLoading(true);
      try {
        const res = await fetch(`${window.API_BASE_URL}/api/wechat/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: sessionToken },
          body: JSON.stringify({
            total_amount: selected.amount,
            subject: selected.subject,
            body: selected.body,
            order_type: 'pro_upgrade',
            user_id: userData.id,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success || !data?.code_url) {
          throw new Error(data?.detail || '创建订单失败');
        }
        setWechatQrData({ codeUrl: data.code_url, outTradeNo: data.out_trade_no, amount: selected.amount });
      } catch (err) {
        toast.show(err?.message || '创建微信支付订单失败', { type: 'error' });
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/alipay/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: sessionToken,
        },
        body: JSON.stringify({
          total_amount: selected.amount,
          subject: selected.subject,
          body: selected.body,
          payment_type: isMobileBrowser() ? 'wap' : 'page',
          order_type: 'pro_upgrade',
          user_id: userData.id,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success || !data?.payment_url) {
        throw new Error(data?.detail || '创建订单失败');
      }

      toast.show('订单创建成功，正在跳转到支付页面...', { type: 'success' });
      window.location.href = data.payment_url;
    } catch (error) {
      toast.show(error?.message || '创建订单失败', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!userData) {
    return null;
  }

  return (
    <PageWrapper title="Pro 会员支付">
      <div className="container py-5">
        <div className="text-center mb-4">
          <h1 className="fw-bold" style={{ fontSize: '2rem', color: '#1f2937' }}>Pro 会员支付</h1>
          <p className="text-muted" style={{ fontSize: '1rem' }}>
            选择支付方式完成订阅，立即开启更高额度与优先体验。
          </p>
        </div>

        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            <div className="rounded-4 p-4" style={{ background: '#fff', border: '1px solid #e9ecef' }}>
              <div className="d-flex flex-column gap-4">
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>已选计划</div>
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{plan.label}</div>
                      <div style={{ color: '#6b7280', fontSize: '0.95rem' }}>{plan.amount} 元 {plan.unit}</div>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      {planOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedPlan(option.id)}
                          style={{
                            borderRadius: 999,
                            padding: '0.55rem 1rem',
                            border: selectedPlan === option.id ? '1px solid #7c3aed' : '1px solid #d1d5db',
                            background: selectedPlan === option.id ? '#f5f3ff' : '#ffffff',
                            color: selectedPlan === option.id ? '#5b21b6' : '#374151',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#6b7280', marginBottom: 12 }}>支付方式</div>
                  <div className="d-flex flex-column flex-sm-row gap-3">
                    <div className="d-flex flex-row flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn d-flex align-items-center gap-2"
                        onClick={() => setSelectedPaymentMethod('alipay')}
                        style={paymentOptionStyle('alipay')}
                      >
                        <img
                          src="/alipay/支付宝logo-方形.png"
                          alt="支付宝logo"
                          style={{ width: 22, height: 22, objectFit: 'contain' }}
                        />
                        <span style={{ color: '#232323', fontWeight: 700, fontSize: '0.9rem' }}>支付宝</span>
                        <img
                          src="/alipay/推荐.png"
                          alt="推荐"
                          style={{ height: 18, objectFit: 'contain' }}
                        />
                        <input
                          type="radio"
                          readOnly
                          checked={selectedPaymentMethod === 'alipay'}
                          aria-label="选择支付宝支付"
                          style={{ accentColor: '#1677ff' }}
                        />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="d-flex align-items-center"
                      onClick={() => { if (!isMobileBrowser()) setSelectedPaymentMethod('wechat'); }}
                      style={isMobileBrowser() ? {
                        ...paymentOptionStyle('wechat'),
                        cursor: 'not-allowed',
                        color: '#9ca3af',
                        border: '1px solid #d1d5db',
                        background: '#f8fafc',
                      } : paymentOptionStyle('wechat')}
                      title={isMobileBrowser() ? '手机端暂不支持微信支付' : ''}
                    >
                      <i className="bi bi-wechat" style={{ color: isMobileBrowser() ? '#9ca3af' : '#07c160', fontSize: '1.2rem' }} />
                      微信支付
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    className="btn w-100 text-white fw-bold"
                    style={{
                      borderRadius: '16px',
                      background: '#7c3aed',
                      border: '1px solid #7c3aed',
                      padding: '0.95rem 1rem',
                      fontSize: '1rem',
                    }}
                    onClick={handlePurchase}
                    disabled={loading}
                  >
                    {loading ? '处理中...' : '前往支付'}
                  </button>
                </div>

                <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                  点击前往支付后将跳转至安全支付页面完成 Pro 会员订阅。若使用微信支付，请确保电脑端浏览器支持扫码。
                </div>
              </div>
            </div>
          </div>
        </div>

        {wechatQrData && (
          <WeChatPayModal
            codeUrl={wechatQrData.codeUrl}
            outTradeNo={wechatQrData.outTradeNo}
            orderType="pro_upgrade"
            amount={wechatQrData.amount}
            onSuccess={() => {
              setWechatQrData(null);
              toast.show('Pro会员开通成功！', { type: 'success' });
            }}
            onCancel={() => setWechatQrData(null)}
          />
        )}
      </div>
    </PageWrapper>
  );
}
