import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useToast } from '../components/ToastProvider';

function AlipayReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const outTradeNo = searchParams.get('out_trade_no');
    const tradeNo = searchParams.get('trade_no');
    const totalAmount = searchParams.get('total_amount');

    if (outTradeNo && tradeNo) {
      toast.show(`支付成功！订单号：${outTradeNo}，金额：¥${totalAmount}`, { type: 'success' });
    } else {
      toast.show('未检测到有效的支付回调参数', { type: 'error' });
    }
  }, [searchParams, toast]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
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
      </div>
    </div>
  );
}

export default AlipayReturnPage;
