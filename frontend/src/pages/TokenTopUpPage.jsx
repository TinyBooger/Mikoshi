import React, { useContext, useEffect, useMemo, useState } from 'react';
import RefundPolicyModal from '../components/RefundPolicyModal';
import { useNavigate } from 'react-router';
import PageWrapper from '../components/PageWrapper';
import { AuthContext } from '../components/AuthProvider';
import { useToast } from '../components/ToastProvider';
import { formatCompactTokenCount } from '../utils/tokenDisplay';

export default function TokenTopUpPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { userData, sessionToken, refreshUserData } = useContext(AuthContext);
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [payingPackageId, setPayingPackageId] = useState(null);
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

  const handleBuyPackage = async (pkg) => {
    if (!userData || !sessionToken) {
      toast.show('请先登录', { type: 'info' });
      navigate('/');
      return;
    }

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
                  return (
                    <div key={pkg.id} className="col-12 col-md-6 col-lg-4">
                      <div
                        className="h-100 p-4 rounded-4"
                        style={{
                          background: '#fff',
                          border: isPopular ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                          boxShadow: isPopular ? '0 10px 30px rgba(245,158,11,0.18)' : '0 8px 20px rgba(15,23,42,0.06)',
                          position: 'relative',
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

                        <button
                          className="btn w-100 fw-bold"
                          style={{
                            background: isPopular ? '#f59e0b' : '#111827',
                            color: '#fff',
                            borderRadius: 10,
                            border: 'none',
                            padding: '0.65rem 0.8rem',
                          }}
                          disabled={payingPackageId === pkg.id}
                          onClick={() => handleBuyPackage(pkg)}
                        >
                          {payingPackageId === pkg.id ? '处理中...' : '立即购买'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Refund Policy Modal */}
      <RefundPolicyModal show={showRefundModal} onClose={() => setShowRefundModal(false)} policyType="token" />
    </PageWrapper>
  );
}
