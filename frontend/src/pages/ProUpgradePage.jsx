import React, { useState, useContext } from 'react';
import RefundPolicyModal from '../components/RefundPolicyModal';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../components/AuthProvider';
import { useToast } from '../components/ToastProvider';
import PageWrapper from '../components/PageWrapper';

export default function ProUpgradePage() {
  const { t } = useTranslation();
  const { userData, sessionToken } = useContext(AuthContext);
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('alipay');
  const [selectedPlan, setSelectedPlan] = useState('1month');

  if (!userData) return null;

  return (
    <PageWrapper title={t('pro_upgrade.title')}>
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10 col-xl-8">
            {/* Header Section */}
            <div className="text-center mb-3">
              <h1 className="fw-bold mb-3" style={{ color: '#232323', fontSize: '2.2rem' }}>
                {t('pro_upgrade.title')}
              </h1>
              <p className="text-muted" style={{ fontSize: '1.05rem' }}>
                {t('pro_upgrade.subtitle')}
              </p>
            </div>

            {/* Comparison Table */}
            <div className="mb-3">
              <div
                className="rounded-4 p-3 p-md-4"
                style={{
                  background: '#fff',
                  border: '1px solid #e9ecef',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
                }}
              >
                <div className="table-responsive">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: '40%', color: '#6c757d', fontSize: '0.85rem' }}>
                          {t('pro_upgrade.comparison_aspect')}
                        </th>
                        <th style={{ width: '30%', color: '#6c757d', fontSize: '0.85rem' }}>
                          {t('pro_upgrade.comparison_regular')}
                        </th>
                        <th style={{ width: '30%', color: '#6c757d', fontSize: '0.85rem' }}>
                          {t('pro_upgrade.comparison_pro')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          key: 'chat_limit',
                          label: t('pro_upgrade.compare_chat_limit'),
                          regular: t('pro_upgrade.compare_chat_limit_regular'),
                          pro: t('pro_upgrade.compare_chat_limit_pro')
                        },
                        {
                          key: 'context_length',
                          label: t('pro_upgrade.compare_context_length'),
                          regular: t('pro_upgrade.compare_context_length_regular'),
                          pro: t('pro_upgrade.compare_context_length_pro')
                        },
                        {
                          key: 'chat_setting',
                          label: t('pro_upgrade.compare_chat_setting'),
                          regular: t('pro_upgrade.compare_chat_setting_regular'),
                          pro: t('pro_upgrade.compare_chat_setting_pro')
                        },
                        {
                          key: 'character_create',
                          label: t('pro_upgrade.compare_character_create'),
                          regular: t('pro_upgrade.compare_character_create_regular'),
                          pro: t('pro_upgrade.compare_character_create_pro')
                        }
                      ].map((row, idx) => (
                        <tr key={row.key} style={{ borderTop: idx === 0 ? '1px solid #e9ecef' : '1px solid #f1f3f5' }}>
                          <td style={{ fontWeight: 600, color: '#232323', fontSize: '0.95rem' }}>{row.label}</td>
                          <td style={{ color: '#6c757d', fontSize: '0.9rem' }}>{row.regular}</td>
                          <td style={{ color: '#232323', fontWeight: 700, fontSize: '0.9rem' }}>{row.pro}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Plan Selection */}
            <div className="mb-3">
              <div className="row g-3">
                {[
                  { id: '1month', label: '1个月', price: 15, unit: '/月', discount: null },
                  { id: '3months', label: '3个月', price: 40, unit: '/3月', discount: '9折' },
                  { id: '6months', label: '6个月', price: 72, unit: '/6月', discount: '8折' },
                  { id: '1year', label: '1年', price: 120, unit: '/年', discount: '6.7折' },
                ].map((plan) => {
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <div key={plan.id} className="col-6 col-md-3">
                      <div style={{ position: 'relative', paddingTop: plan.discount ? '12px' : '0' }}>
                        {plan.discount && (
                          <span
                            style={{
                              position: 'absolute',
                              top: 0,
                              right: 8,
                              background: 'linear-gradient(135deg, #667eea, #764ba2)',
                              color: '#fff',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.5rem',
                              borderRadius: '999px',
                              zIndex: 1,
                            }}
                          >
                            {plan.discount}
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn w-100"
                          onClick={() => setSelectedPlan(plan.id)}
                          style={{
                            background: isSelected
                              ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.12) 100%)'
                              : '#fff',
                            border: isSelected ? '2px solid #667eea' : '1px solid #dee2e6',
                            borderRadius: '16px',
                            padding: '1.1rem 0.75rem',
                            boxShadow: isSelected
                              ? '0 6px 18px rgba(102, 126, 234, 0.18)'
                              : '0 2px 8px rgba(0,0,0,0.04)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ color: '#6c757d', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                            {plan.label}
                          </div>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: '1.5rem',
                              background: isSelected
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : 'none',
                              backgroundClip: isSelected ? 'text' : 'unset',
                              WebkitBackgroundClip: isSelected ? 'text' : 'unset',
                              WebkitTextFillColor: isSelected ? 'transparent' : '#232323',
                            }}
                          >
                            ¥{plan.price}
                          </div>
                          <div style={{ color: '#adb5bd', fontSize: '0.78rem' }}>{plan.unit}</div>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-muted mt-3 mb-0" style={{ fontSize: '0.85rem' }}>
                {t('pro_upgrade.cancel_anytime')}
              </p>
            </div>

            {/* Payment Methods */}
            <div className="mb-4">
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
            <div className="text-center mb-3">
              <button
                className="btn btn-lg fw-bold px-5 py-3 shadow"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '16px',
                  fontSize: '1.1rem',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.3)';
                }}
                onClick={async () => {
                  if (!userData) {
                    toast.show(t('sidebar.login_first'), { type: 'info' });
                    return;
                  }

                  if (selectedPaymentMethod !== 'alipay') {
                    toast.show('当前仅支持支付宝支付', { type: 'info' });
                    return;
                  }

                  const planDetails = {
                    '1month':  { amount: 15,  subject: 'Pro会员1个月', body: 'Pro会员30天订阅' },
                    '3months': { amount: 40,  subject: 'Pro会员3个月', body: 'Pro会员90天订阅' },
                    '6months': { amount: 72,  subject: 'Pro会员6个月', body: 'Pro会员180天订阅' },
                    '1year':   { amount: 120, subject: 'Pro会员1年',   body: 'Pro会员365天订阅' },
                  };
                  const plan = planDetails[selectedPlan];

                  setLoading(true);

                  try {
                    const requestBody = {
                      total_amount: plan.amount,
                      subject: plan.subject,
                      body: plan.body,
                      payment_type: 'page',
                      order_type: 'pro_upgrade',
                      user_id: userData.id
                    };

                    const response = await fetch(`${window.API_BASE_URL}/api/alipay/create-order`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': sessionToken
                      },
                      body: JSON.stringify(requestBody)
                    });

                    if (response.ok) {
                      const data = await response.json();

                      if (data.success && data.payment_url) {
                        toast.show('订单创建成功，正在跳转到支付页面...', { type: 'success' });

                        setTimeout(() => {
                          window.location.href = data.payment_url;
                        }, 1000);
                      } else {
                        toast.show('创建订单失败', { type: 'error' });
                      }
                    } else {
                      const error = await response.json();
                      console.error('创建订单失败:', error);

                      // Handle validation errors (422) which come as an array
                      let errorMessage = '创建订单失败';
                      if (error.detail) {
                        if (Array.isArray(error.detail)) {
                          // Pydantic validation errors
                          errorMessage = error.detail.map(err => err.msg).join('; ');
                        } else if (typeof error.detail === 'string') {
                          errorMessage = error.detail;
                        }
                      }

                      toast.show(errorMessage, { type: 'error' });
                    }
                  } catch (error) {
                    console.error('创建订单失败:', error);
                    toast.show('创建订单失败：' + error.message, { type: 'error' });
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || selectedPaymentMethod !== 'alipay'}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    {t('common.loading')}
                  </>
                ) : (
                  t('pro_upgrade.upgrade_now')
                )}
              </button>
            </div>

            {/* Refund Policy Modal */}
            <RefundPolicyModal show={showRefundModal} onClose={() => setShowRefundModal(false)} policyType="pro" />

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
          </div>
        </div>
    </PageWrapper>
  );
}
