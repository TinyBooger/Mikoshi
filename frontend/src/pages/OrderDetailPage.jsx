import React from 'react';
import { useParams, useNavigate } from 'react-router';

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    fetch(`${window.API_BASE_URL}/api/wallet/history?limit=1000`, {
      headers: { 'Authorization': window.sessionToken || '' }
    })
      .then(res => res.json())
      .then(data => {
        const found = (data.items || []).find(item => String(item.id) === String(orderId));
        if (found) setOrder(found);
        else setError('未找到该订单');
      })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', background: '#fff', borderRadius: 12, border: '1px solid #e9ecef', padding: 32 }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 24, color: '#736B92', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>← 返回</button>
      <h2 style={{ marginBottom: 24 }}>订单详情</h2>
      {loading ? (
        <div>加载中...</div>
      ) : error ? (
        <div style={{ color: 'red' }}>{error}</div>
      ) : order ? (
        <table style={{ width: '100%', fontSize: 16 }}>
          <tbody>
            <tr><td style={{ width: 120, color: '#888' }}>订单编号</td><td>{order.id}</td></tr>
            <tr><td style={{ color: '#888' }}>类型</td><td>{order.transaction_type}</td></tr>
            <tr><td style={{ color: '#888' }}>数量</td><td>{order.token_amount}</td></tr>
            <tr><td style={{ color: '#888' }}>变动后余额</td><td>{order.balance_after}</td></tr>
            <tr><td style={{ color: '#888' }}>来源</td><td>{order.source}</td></tr>
            <tr><td style={{ color: '#888' }}>订单号</td><td>{order.source_order_no}</td></tr>
            <tr><td style={{ color: '#888' }}>日期</td><td>{new Date(order.created_at).toLocaleString('zh-CN')}</td></tr>
            <tr><td style={{ color: '#888' }}>附加信息</td><td><pre style={{ margin: 0, fontSize: 14 }}>{JSON.stringify(order.wallet_meta, null, 2)}</pre></td></tr>
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
