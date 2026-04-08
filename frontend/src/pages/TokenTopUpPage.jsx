import React, { useContext, useEffect, useMemo, useState } from 'react';
import RefundPolicyModal from '../components/RefundPolicyModal';
import { useNavigate } from 'react-router';
import PageWrapper from '../components/PageWrapper';
import { AuthContext } from '../components/AuthProvider';
import { useToast } from '../components/ToastProvider';
import { formatCompactTokenCount } from '../utils/tokenDisplay';
import { useTranslation } from 'react-i18next';

export default function TokenTopUpPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { userData, sessionToken, refreshUserData } = useContext(AuthContext);
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [payingPackageId, setPayingPackageId] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('alipay');
  const [showRefundModal, setShowRefundModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchPackages = async () => {
      setLoadingPackages(true);
      try {
        const response = await fetch(`${window.API_BASE_URL}/api/alipay/token-packages`);
        if (!response.ok) {
          throw new Error('Failed to load token packages');
        }
        const data = await response.json();
        if (!cancelled) {
          setPackages(Array.isArray(data?.packages) ? data.packages : []);
        }
      } catch (error) {
        if (!cancelled) {
          toast.show('加载充值包失败，请稍后重试。', { type: 'error' });
        }
      } finally {
        if (!cancelled) {
          setLoadingPackages(false);
        }
      }
    };

    fetchPackages();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (packages.length > 0 && selectedPackageId === null) {
      const sorted = [...packages].sort((a, b) => Number(a.tokens || 0) - Number(b.tokens || 0));
      setSelectedPackageId(sorted[0]?.id ?? null);
    }
  }, [packages, selectedPackageId]);

  const sortedPackages = useMemo(
    () => [...packages].sort((a, b) => Number(a.tokens || 0) - Number(b.tokens || 0)),
    [packages]
  );

  const getLocalizedPackageLabel = (label) => {
    const normalized = String(label || '').trim().toLowerCase();
    if (!normalized) return '充值包';
    if (normalized === 'entry') return '入门';
    if (normalized === 'standard') return '标准';
    if (normalized === 'popular') return '热门';
    if (normalized === 'heavy') return '巨量';
    if (normalized === 'whale') return '海量';
    if (normalized === '高频') return '巨量';
    if (normalized === '鲸鱼') return '海量';
    return label;
  };

  const handlePurchase = async () => {
    if (!userData || !sessionToken) {
      toast.show('请先登录', { type: 'info' });
      navigate('/');
      return;
    }

    if (!selectedPackageId) {
      toast.show('请先选择充值套餐', { type: 'info' });
      return;
    }

    if (selectedPaymentMethod !== 'alipay') {
      toast.show('当前仅支持支付宝支付', { type: 'info' });
      return;
    }

    const pkg = sortedPackages.find((p) => p.id === selectedPackageId);
    if (!pkg) return;

    setPayingPackageId(pkg.id);
    try {
      const requestBody = {
        total_amount: Number(pkg.price_cny),
        subject: `Token充值 ${formatCompactTokenCount(Number(pkg.tokens || 0))}`,
        body: `购买${formatCompactTokenCount(Number(pkg.tokens || 0))} tokens`,
        payment_type: 'page',
        order_type: 'token_topup',
        user_id: userData.id,
        package_id: pkg.id,
      };

      const response = await fetch(`${window.API_BASE_URL}/api/alipay/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: sessionToken,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (!response.ok || !data?.success || !data?.payment_url) {
        throw new Error(data?.detail || '创建订单失败');
      }

      toast.show('订单创建成功，正在跳转到支付页面...', { type: 'success' });
      if (refreshUserData) {
        refreshUserData({ silent: true });
      }
      setTimeout(() => {
        window.location.href = data.payment_url;
      }, 800);
    } catch (error) {
      toast.show(error?.message || '创建订单失败', { type: 'error' });
    } finally {
      setPayingPackageId(null);
    }
  };

  return (
    <PageWrapper title="Token充值">
      <div className="container py-4 py-lg-5">
        <div className="row justify-content-center">
          <div className="col-12 col-xl-10">
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
              <div>
                <h1 className="fw-bold mb-1" style={{ fontSize: '2rem', color: '#1f2937' }}>Token充值</h1>
                <p className="text-muted mb-0">
                  套餐会充值到钱包，套餐额度用完后自动抵扣钱包Token。
                  <button className="btn btn-link p-0 ms-2" style={{ fontSize: '0.98em' }} onClick={() => setShowRefundModal(true)}>
                    退款政策
                  </button>
                </p>
              </div>
              <div
                className="px-3 py-2 rounded-3"
                style={{ background: '#fff', border: '1px solid #e5e7eb', minWidth: 220 }}
              >
                <div style={{ fontSize: '0.76rem', color: '#6b7280', fontWeight: 700 }}>当前钱包余额</div>
                <div style={{ fontSize: '1.2rem', color: '#111827', fontWeight: 800 }}>
                  {formatCompactTokenCount(Number(userData?.purchased_token_balance || 0))}
                </div>
              </div>
            </div>

            {loadingPackages ? (
              <div className="text-center py-5 text-muted">正在加载充值包...</div>
            ) : (
              <div className="row g-3 g-lg-4">
                {sortedPackages.map((pkg) => {
                  const isPopular = Number(pkg.tokens) === 2000000;
                  const isStandard = Number(pkg.tokens) === 1000000;
                  const isSelected = selectedPackageId === pkg.id;
                  return (
                    <div key={pkg.id} className="col-12 col-md-6 col-lg-4">
                      <div
                        className="h-100 p-4 rounded-4"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedPackageId(pkg.id)}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedPackageId(pkg.id)}
                        style={{
                          background: '#fff',
                          border: isSelected
                            ? '2px solid #667eea'
                            : '1px solid #e5e7eb',
                          boxShadow: isSelected
                            ? '0 6px 18px rgba(102, 126, 234, 0.18)'
                            : '0 8px 20px rgba(15,23,42,0.06)',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'border 0.15s, box-shadow 0.15s',
                        }}
                      >
                        {isPopular && (
                          <div
                            style={{
                              position: 'absolute',
                              top: -10,
                              right: 16,
                              background: '#f59e0b',
                              color: '#fff',
                              padding: '0.2rem 0.6rem',
                              borderRadius: 999,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                            }}
                          >
                            最受欢迎
                          </div>
                        )}
                        {isStandard && !isPopular && (
                          <div
                            style={{
                              position: 'absolute',
                              top: -10,
                              right: 16,
                              background: '#2563eb',
                              color: '#fff',
                              padding: '0.2rem 0.6rem',
                              borderRadius: 999,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                            }}
                          >
                            标准档
                          </div>
                        )}
                        <div className="mb-2" style={{ color: '#64748b', fontWeight: 700, fontSize: '0.82rem' }}>
                          {getLocalizedPackageLabel(pkg.label)}
                        </div>
                        <div className="mb-1" style={{ fontWeight: 900, color: '#0f172a', fontSize: '1.7rem' }}>
                          {formatCompactTokenCount(Number(pkg.tokens || 0))}
                        </div>
                        <div className="mb-4" style={{ fontWeight: 800, color: '#16a34a', fontSize: '1.35rem' }}>
                          ¥{Number(pkg.price_cny || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
            {/* Payment Methods */}
            <div className="mt-4 mb-3">
              <div className="mb-2" style={{ color: '#6c757d', fontSize: '0.82rem', fontWeight: 700 }}>
                支付方式
              </div>
              <div className="d-flex flex-row flex-wrap gap-2">
                <button
                  type="button"
                  className="btn d-flex align-items-center gap-2"
                  onClick={() => setSelectedPaymentMethod('alipay')}
                  style={{
                    background: '#fff',
                    border: selectedPaymentMethod === 'alipay' ? '2px solid #1677ff' : '1px solid #d9e2ec',
                    borderRadius: '12px',
                    padding: '0.6rem 1rem',
                    boxShadow: selectedPaymentMethod === 'alipay' ? '0 4px 12px rgba(22, 119, 255, 0.15)' : 'none',
                  }}
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

                <button
                  type="button"
                  className="btn d-flex align-items-center gap-2"
                  onClick={() => setSelectedPaymentMethod('coming_soon')}
                  style={{
                    background: '#f8f9fa',
                    border: selectedPaymentMethod === 'coming_soon' ? '2px solid #adb5bd' : '1px solid #dee2e6',
                    borderRadius: '12px',
                    padding: '0.6rem 1rem',
                    color: '#6c757d',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>更多支付方式（即将支持）</span>
                  <input
                    type="radio"
                    readOnly
                    checked={selectedPaymentMethod === 'coming_soon'}
                    aria-label="选择更多支付方式"
                  />
                </button>
              </div>
            </div>

            {/* Purchase Button */}
            <div className="text-center mt-4 mb-3">
              <button
                className="btn btn-lg fw-bold px-5 py-3 shadow"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '16px',
                  fontSize: '1.1rem',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.3)';
                }}
                onClick={handlePurchase}
                disabled={!!payingPackageId || !selectedPackageId || selectedPaymentMethod !== 'alipay'}
              >
                {payingPackageId ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    处理中...
                  </>
                ) : (
                  '立即购买'
                )}
              </button>
            </div>

        </div>
      </div>
      {/* Refund Policy Modal */}
      <RefundPolicyModal show={showRefundModal} onClose={() => setShowRefundModal(false)} policyType="token" />
      {/* Footer Note */}
      <p className="text-muted" style={{ fontSize: '0.9rem' }}>
        {t('pro_upgrade.footer_note')}
        {' '}
        <a href="/terms-of-service" className="text-decoration-none" style={{ color: '#667eea' }}>
          {t('pro_upgrade.terms')}
        </a>
        {' '}{t('common.and')}{' '}
        <a href="/privacy-policy" className="text-decoration-none" style={{ color: '#667eea' }}>
          {t('pro_upgrade.privacy')}
        </a>
      </p>
    </PageWrapper>
  );
}
