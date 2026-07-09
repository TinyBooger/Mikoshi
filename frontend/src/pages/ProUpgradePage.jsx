import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router';
import PageWrapper from '../components/PageWrapper';
import { AuthContext } from '../components/AuthProvider';

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

  const freeFeatures = [
    '每日 10 点积分额度',
    '普通排队处理',
    '仅可使用基础聊天体验',
    '可进行基础创作',
  ];

  const proFeatures = [
    '每月享有1万点数，使用更充足',
    '聊天请求将优先处理',
    '可调整模型、温度、上下文长度等高级参数',
    '可在创作角色时使用高级参数，获得更丰富的创作体验',
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

  if (!userData) return null;

  return (
    <PageWrapper title="升级为 Pro">
      <div className="container" style={{ minHeight: '100vh', paddingTop: isMobile ? '8vh' : '15vh', paddingBottom: '3.5rem' }}>
        <div className="text-center mb-5">
          <h1 className="fw-bold mb-2" style={{ fontSize: isMobile ? '1.4rem' : '2rem', color: '#111827' }}>升级为 Pro</h1>
          <p className="text-muted mb-0" style={{ fontSize: isMobile ? '0.85rem' : '1rem' }}>
            选择适合你的方案，立即开启更高额度与优先体验。
          </p>
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
                style={{
                  width: '100%',
                  borderRadius: isMobile ? '14px' : '18px',
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#111827',
                  fontWeight: 700,
                  fontSize: isMobile ? '0.85rem' : '0.95rem',
                  padding: isMobile ? '0.7rem' : '0.9rem',
                  cursor: 'pointer',
                }}
              >
                继续免费使用
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
                成为Pro用户
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
        </div>
      </div>
    </PageWrapper>
  );
}
