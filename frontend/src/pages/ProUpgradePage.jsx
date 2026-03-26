import React, { useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../components/AuthProvider';
import { useToast } from '../components/ToastProvider';
import PageWrapper from '../components/PageWrapper';

export default function ProUpgradePage() {
  const { t } = useTranslation();
  const { userData, sessionToken } = useContext(AuthContext);
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (!userData) return null;

  return (
    <PageWrapper title={t('pro_upgrade.title')}>
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10 col-xl-8">
            {/* Header Section */}
            <div className="text-center mb-5">
              <h1 className="fw-bold mb-3" style={{ color: '#232323', fontSize: '2.2rem' }}>
                {t('pro_upgrade.title')}
              </h1>
              <p className="text-muted" style={{ fontSize: '1.05rem' }}>
                {t('pro_upgrade.subtitle')}
              </p>
            </div>

            {/* Comparison Table */}
            <div className="mb-5">
              <div className="text-center mb-4">
                <h3 className="fw-bold" style={{ color: '#232323' }}>
                  {t('pro_upgrade.comparison_title')}
                </h3>
                <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
                  {t('pro_upgrade.comparison_subtitle')}
                </p>
              </div>
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

            {/* Pricing Card */}
            <div className="text-center mb-5">
              <div 
                className="d-inline-block p-5 rounded-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.08) 100%)',
                  border: '2px solid',
                  borderImage: 'linear-gradient(135deg, #667eea, #764ba2) 1',
                  borderRadius: '24px',
                  minWidth: '300px'
                }}
              >
                <div className="mb-3">
                  <span 
                    className="fw-bold"
                    style={{
                      fontSize: '3rem',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    ¥29
                  </span>
                  <span className="text-muted" style={{ fontSize: '1.1rem' }}>
                    {t('pro_upgrade.per_month')}
                  </span>
                </div>
                <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>
                  {t('pro_upgrade.cancel_anytime')}
                </p>
                
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
                    
                    setLoading(true);
                    
                    try {
                      const requestBody = {
                        total_amount: 29.00,
                        subject: 'Pro会员订阅',
                        body: 'Pro会员30天订阅',
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
                  disabled={loading}
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
            </div>

            {/* FAQ Section */}
            <div className="mt-5">
              <h3 className="fw-bold text-center mb-4" style={{ color: '#232323' }}>
                {t('pro_upgrade.faq_title')}
              </h3>
              <div className="accordion" id="faqAccordion">
                {[
                  { 
                    q: '如何支付？', 
                    a: '我们支持支付宝支付，安全便捷。' 
                  },
                  { 
                    q: '可以随时取消吗？', 
                    a: '是的，您可以随时在设置中取消订阅。' 
                  },
                  { 
                    q: '有退款政策吗？', 
                    a: '在购买后7天内，如果您不满意，可以申请全额退款。' 
                  }
                ].map((faq, idx) => (
                  <div key={idx} className="accordion-item border-0 mb-3 rounded-4 overflow-hidden" style={{ background: '#fff' }}>
                    <h2 className="accordion-header">
                      <button
                        className="accordion-button collapsed fw-bold"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#faq${idx}`}
                        style={{
                          background: '#f8f9fa',
                          color: '#232323',
                          fontSize: '1rem'
                        }}
                      >
                        {t(`pro_upgrade.faq_${idx}_q`)}
                      </button>
                    </h2>
                    <div id={`faq${idx}`} className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                      <div className="accordion-body" style={{ color: '#6c757d' }}>
                        {t(`pro_upgrade.faq_${idx}_a`)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Note */}
            <div className="text-center mt-5 pt-5" style={{ borderTop: '1px solid #e9ecef' }}>
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
        </div>
      </div>
    </PageWrapper>
  );
}
