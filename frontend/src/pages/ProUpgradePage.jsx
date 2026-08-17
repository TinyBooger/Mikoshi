import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import PageWrapper from '../components/PageWrapper';
import { AuthContext } from '../components/AuthProvider';
import { formatCompactTokenCount } from '../utils/creditDisplay';

const planOptions = [
  { id: '1month', label: '1个月', amount: 15, unit: '/月', discount: null },
  { id: '3months', label: '3个月', amount: 40, unit: '/3月', discount: '-11%' },
  { id: '6months', label: '6个月', amount: 72, unit: '/6月', discount: '-20%' },
  { id: '1year', label: '1年', amount: 120, unit: '/年', discount: '-33%' },
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

export default function ProUpgradePage() {
  const { userData } = useContext(AuthContext);
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState('1month');
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return isMobileBrowser();
  });

  // -- credit packages --
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [selectedPackageId, setSelectedPackageId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchPackages = async () => {
      setLoadingPackages(true);
      try {
        const response = await fetch(`${window.API_BASE_URL}/api/alipay/credit-packages`);
        if (!response.ok) throw new Error('Failed to load packages');
        const data = await response.json();
        if (!cancelled) {
          const list = Array.isArray(data?.packages) ? data.packages : [];
          setPackages(list);
        }
      } catch (error) {
        // silently fail, card shows empty state
      } finally {
        if (!cancelled) setLoadingPackages(false);
      }
    };
    fetchPackages();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (packages.length > 0 && selectedPackageId === null) {
      const sorted = [...packages].sort((a, b) => Number(a.credits || 0) - Number(b.credits || 0));
      setSelectedPackageId(sorted[0]?.id ?? null);
    }
  }, [packages, selectedPackageId]);

  const sortedPackages = useMemo(
    () => [...packages].sort((a, b) => Number(a.credits || 0) - Number(b.credits || 0)),
    [packages]
  );

  const isProActive = !!userData?.pro_active;
  const proDaysRemaining = Number(userData?.pro_days_remaining ?? 0);
  const proExpireLabel = useMemo(() => {
    if (!userData?.pro_expire_date) return '';
    const d = new Date(userData.pro_expire_date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }, [userData?.pro_expire_date]);

  const freeFeatures = [
    '每日 10 点聊天点数额度',
    '聊天请求排队处理',
    '仅可使用基础聊天体验',
    '可进行基础创作',
  ];

  const proFeatures = [
    '每月享有1万聊天点数，聊天额度更充足',
    '聊天请求将优先处理',
    '可调整模型温度等高级参数',
    '可在创作角色时使用高级参数，获得更丰富的创作体验',
  ];

  const packageFeatures = [
    '点数包为更灵活的定制方案',
    '购买的点数存入钱包，永不过期',
    '每日/每月点数额度用完后自动抵扣钱包点数',
    '多个档位可选，满足不同用量需求',
  ];

  const handleFreeContinue = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/browse');
    }
  };

  const handleProPurchase = () => {
    navigate(`/pro-upgrade/payment?plan=${selectedPlan}`);
  };

  const handlePackagePurchase = () => {
    navigate(`/pro-upgrade/payment/package?package=${selectedPackageId}`);
  };

  if (!userData) return null;

  return (
    <PageWrapper title="升级为 Pro">
      <div className="container" style={{ minHeight: '100vh', paddingTop: isMobile ? '8vh' : '15vh', paddingBottom: '3.5rem' }}>
        <div className="text-center mb-5">
          <h1 className="fw-bold mb-2" style={{ fontSize: isMobile ? '1.4rem' : '2rem', color: '#111827' }}>升级为 Pro 用户</h1>
          <p className="text-muted mb-0" style={{ fontSize: isMobile ? '0.85rem' : '1rem' }}>
            选择适合你的方案，立即开启更高点数额度与畅聊优先体验。
          </p>
          {isProActive && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: isMobile ? 12 : 16,
                padding: isMobile ? '6px 14px' : '8px 18px',
                borderRadius: '999px',
                background: '#f5f3ff',
                border: '1px solid #ddd6fe',
                color: '#5b21b6',
                fontWeight: 700,
                fontSize: isMobile ? '0.8rem' : '0.9rem',
              }}
            >
              <i className="bi bi-patch-check-fill" />
              当前为 Pro 用户{proExpireLabel ? ` · 有效期至 ${proExpireLabel}` : ''} · 剩余 {proDaysRemaining} 天
            </div>
          )}
        </div>

        <div className="row justify-content-center g-4 align-items-stretch">
          <div className="col-12 col-lg-4">
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: isMobile ? '22px' : '28px', padding: isMobile ? '14px 16px' : '18px 22px', height: '100%', maxWidth: isMobile ? '100%' : 340, width: '100%', margin: '0 auto', boxShadow: '0 18px 50px rgba(15, 23, 42, 0.07)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="d-flex align-items-end justify-content-between flex-wrap" style={{ gap: 12 }}>
                <div style={{ fontSize: isMobile ? '0.78rem' : '0.88rem', fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap' }}>Free</div>
                <div style={{ width: '100%', maxWidth: 170, minHeight: 30 }} />
              </div>
              <div>
                <div style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', color: '#111827', marginTop: 4, paddingTop: '0.5rem', fontWeight: 600 }}>基础体验</div>
                <div style={{ marginTop: 8, color: '#6b7280', fontSize: isMobile ? '0.78rem' : '0.88rem' }}>无限次使用基础功能</div>
              </div>

              <div style={{ marginTop: isMobile ? 12 : 18, marginBottom: isMobile ? 12 : 18 }}>
                <div style={{ fontSize: isMobile ? '1.8rem' : '2.4rem', fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                  ￥0
                </div>
              </div>

              <button
                type="button"
                onClick={handleFreeContinue}
                disabled={isProActive}
                style={{
                  width: '100%',
                  borderRadius: isMobile ? '14px' : '18px',
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#111827',
                  fontWeight: 700,
                  fontSize: isMobile ? '0.85rem' : '0.95rem',
                  padding: isMobile ? '0.7rem' : '0.9rem',
                  cursor: isProActive ? 'not-allowed' : 'pointer',
                  opacity: isProActive ? 0.55 : 1,
                }}
              >
                {isProActive ? '已是 Pro 用户' : '继续免费使用'}
              </button>

              <div style={{ borderTop: '1px dashed #d1d5db', margin: isMobile ? '14px 0' : '20px 0' }} />

              <div className="mb-3">
                {freeFeatures.map((feature) => (
                  <div key={feature} className="d-flex align-items-center mb-2" style={{ gap: isMobile ? 8 : 10 }}>
                    <div style={{ width: isMobile ? 6 : 7, height: isMobile ? 6 : 7, borderRadius: '50%', background: '#7c3aed' }} />
                    <div style={{ color: '#374151', fontSize: isMobile ? '0.78rem' : '0.9rem' }}>{feature}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: isMobile ? '22px' : '28px', padding: isMobile ? '14px 16px' : '18px 22px', height: '100%', maxWidth: isMobile ? '100%' : 340, width: '100%', margin: '0 auto', boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="d-flex align-items-end justify-content-between flex-wrap" style={{ gap: 12 }}>
                <div style={{ fontSize: isMobile ? '0.78rem' : '0.88rem', fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap' }}>Pro</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f3f4f6', borderRadius: '999px', padding: '1px 2px', minHeight: 30 }}>
                  {planOptions.map((option) => {
                    const selected = selectedPlan === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedPlan(option.id)}
                        style={{
                          border: 'none',
                          background: selected ? '#ffffff' : 'transparent',
                          color: selected ? '#111827' : '#6b7280',
                          fontSize: isMobile ? '0.7rem' : '0.75rem',
                          fontWeight: 700,
                          padding: isMobile ? '0.3rem 0.5rem' : '0.35rem 0.65rem',
                          borderRadius: '999px',
                          cursor: 'pointer',
                          minWidth: isMobile ? 44 : 52,
                          transition: 'background-color 0.2s ease, color 0.2s ease',
                          boxShadow: selected ? '0 5px 10px rgba(15, 23, 42, 0.08)' : 'none',
                          position: 'relative',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ lineHeight: 1 }}>{option.label}</span>
                        {option.discount && (
                          <span style={{ position: 'absolute', top: isMobile ? '-9px' : '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: isMobile ? '0.6rem' : '0.65rem', color: '#7c3aed', pointerEvents: 'none', zIndex: 2 }}>{option.discount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', color: '#111827', marginTop: 4, paddingTop: '0.5rem', fontWeight: 600 }}>优先订阅</div>
                <div style={{ marginTop: 8, color: '#6b7280', fontSize: isMobile ? '0.78rem' : '0.88rem' }}>享受Pro用户专属功能</div>
              </div>

              <div style={{ marginTop: isMobile ? 12 : 18, marginBottom: isMobile ? 12 : 18 }}>
                <div style={{ fontSize: isMobile ? '1.8rem' : '2.4rem', fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                  ￥{planOptions.find((item) => item.id === selectedPlan)?.amount}
                </div>
              </div>

              <button
                type="button"
                onClick={handleProPurchase}
                style={{
                  width: '100%',
                  borderRadius: isMobile ? '14px' : '18px',
                  border: 'none',
                  background: '#7c3aed',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: isMobile ? '0.85rem' : '0.95rem',
                  padding: isMobile ? '0.7rem' : '0.9rem',
                  cursor: 'pointer',
                }}
              >
                {isProActive ? '续费' : '成为Pro用户'}
              </button>

              <div style={{ borderTop: '1px dashed #d1d5db', margin: isMobile ? '14px 0' : '20px 0' }} />

              <div className="mb-3">
                {proFeatures.map((feature) => (
                  <div key={feature} className="d-flex align-items-center mb-2" style={{ gap: isMobile ? 8 : 10 }}>
                    <div style={{ width: isMobile ? 6 : 7, height: isMobile ? 6 : 7, borderRadius: '50%', background: '#7c3aed' }} />
                    <div style={{ color: '#374151', fontSize: isMobile ? '0.78rem' : '0.9rem' }}>{feature}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: isMobile ? '22px' : '28px', padding: isMobile ? '14px 16px' : '18px 22px', height: '100%', maxWidth: isMobile ? '100%' : 340, width: '100%', margin: '0 auto', boxShadow: '0 18px 50px rgba(15, 23, 42, 0.07)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="d-flex align-items-end justify-content-between flex-wrap" style={{ gap: 12 }}>
                <div style={{ fontSize: isMobile ? '0.78rem' : '0.88rem', fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap' }}>点数包</div>
                <div style={{ width: '100%', maxWidth: 170, minHeight: 30 }} />
              </div>
              <div>
                <div style={{ fontSize: isMobile ? '1.2rem' : '1.6rem', color: '#111827', marginTop: 4, paddingTop: '0.5rem', fontWeight: 600 }}>灵活充值</div>
                <div style={{ marginTop: 8, color: '#6b7280', fontSize: isMobile ? '0.78rem' : '0.88rem' }}>按需购买点数，永不过期</div>
              </div>

              <div style={{ marginTop: isMobile ? 12 : 18, marginBottom: isMobile ? 8 : 12 }}>
                <div style={{ fontSize: isMobile ? '1.8rem' : '2.4rem', fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                  ￥{sortedPackages.find(p => p.id === selectedPackageId)?.price_cny ?? '—'}
                </div>
              </div>

              {sortedPackages.length > 0 ? (
                <div style={{ marginBottom: isMobile ? 12 : 18 }}>
                  <div style={{
                    position: 'relative',
                    display: 'flex',
                    background: '#f3f4f6',
                    borderRadius: '10px',
                    padding: '2px',
                    height: isMobile ? '36px' : '40px',
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '2px',
                      left: `${Math.max(0, sortedPackages.findIndex(p => p.id === selectedPackageId)) * (100 / sortedPackages.length)}%`,
                      width: `${100 / sortedPackages.length}%`,
                      height: isMobile ? '32px' : '36px',
                      background: '#ffffff',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
                      transition: 'left 0.25s ease, width 0.25s ease',
                    }} />
                    {sortedPackages.map((pkg) => {
                      const selected = selectedPackageId === pkg.id;
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setSelectedPackageId(pkg.id)}
                          style={{
                            flex: 1,
                            zIndex: 1,
                            border: 'none',
                            background: 'transparent',
                            color: selected ? '#111827' : '#6b7280',
                            fontWeight: 700,
                            fontSize: isMobile ? '0.75rem' : '0.82rem',
                            cursor: 'pointer',
                            transition: 'color 0.2s ease',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {formatCompactTokenCount(Number(pkg.credits || 0))}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: isMobile ? 12 : 18, height: isMobile ? '36px' : '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: isMobile ? '0.75rem' : '0.82rem' }}>
                  {loadingPackages ? '加载中...' : '暂无可用套餐'}
                </div>
              )}

              <button
                type="button"
                onClick={handlePackagePurchase}
                disabled={!selectedPackageId || sortedPackages.length === 0}
                style={{
                  width: '100%',
                  borderRadius: isMobile ? '14px' : '18px',
                  border: 'none',
                  background: selectedPackageId && sortedPackages.length > 0 ? '#7c3aed' : '#d1d5db',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: isMobile ? '0.85rem' : '0.95rem',
                  padding: isMobile ? '0.7rem' : '0.9rem',
                  cursor: selectedPackageId && sortedPackages.length > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                购买点数包
              </button>

              <div style={{ borderTop: '1px dashed #d1d5db', margin: isMobile ? '14px 0' : '20px 0' }} />

              <div className="mb-3">
                {packageFeatures.map((feature) => (
                  <div key={feature} className="d-flex align-items-center mb-2" style={{ gap: isMobile ? 8 : 10 }}>
                    <div style={{ width: isMobile ? 6 : 7, height: isMobile ? 6 : 7, borderRadius: '50%', background: '#7c3aed' }} />
                    <div style={{ color: '#374151', fontSize: isMobile ? '0.78rem' : '0.9rem' }}>{feature}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
