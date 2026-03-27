import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../components/AuthProvider';
import { useToast } from '../components/ToastProvider';

export default function OrderHistoryTab() {
  const { sessionToken } = useContext(AuthContext);
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    setLoading(true);
    fetch(`${window.API_BASE_URL}/api/payment/orders`, {
      headers: { 'Authorization': sessionToken }
    })
      .then(res => res.json())
      .then(data => {
        setOrders(data.items || []);
      })
      .catch(() => {
        toast.show('Failed to load order history', { type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [sessionToken]);

  async function handleRefund(outTradeNo) {
    const order = orders.find(o => o.out_trade_no === outTradeNo);
    if (!order) return toast.show('订单未找到', { type: 'error' });
    const refundAmount = Number(order.total_amount);
    if (isNaN(refundAmount) || refundAmount <= 0) return toast.show('无效的退款金额', { type: 'error' });

    if (!window.confirm(`确定要为订单 ${outTradeNo} 申请退款吗？`)) return;

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/alipay/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sessionToken
        },
        body: JSON.stringify({ out_trade_no: outTradeNo, refund_amount: refundAmount })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.show('退款申请已提交', { type: 'success' });
      } else {
        toast.show(data.detail || '退款申请失败', { type: 'error' });
      }
    } catch (e) {
      toast.show('网络错误，退款失败', { type: 'error' });
    }
  }

  const [expandedError, setExpandedError] = useState(null);
  return (
    <div style={{ padding: 16, borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 16, background: '#fff' }}>
      <h4 style={{ fontSize: 18, marginBottom: 16 }}>订单历史</h4>
      {loading ? (
        <div>加载中...</div>
      ) : orders.length === 0 ? (
        <div>暂无订单记录。</div>
      ) : (
        <table className="table" style={{ width: '100%', fontSize: 13, tableLayout: 'auto' }}>
          <colgroup>
            <col style={{ width: '170px' }} /> {/* 订单号 */}
            <col style={{ width: '70px' }} />  {/* 类型 */}
            <col style={{ width: '60px' }} />  {/* 金额 */}
            <col style={{ width: '60px' }} />  {/* 状态 */}
            <col style={{ width: '90px' }} />  {/* 来源 */}
            <col style={{ width: '120px' }} /> {/* 时间 */}
            <col style={{ width: '80px' }} />  {/* 退款状态 */}
            <col style={{ width: '60px' }} />  {/* 操作 */}
          </colgroup>
          <thead>
            <tr style={{ fontSize: 13 }}>
              <th style={{ whiteSpace: 'nowrap' }}>订单号</th>
              <th style={{ whiteSpace: 'nowrap' }}>类型</th>
              <th style={{ whiteSpace: 'nowrap' }}>金额</th>
              <th style={{ whiteSpace: 'nowrap' }}>状态</th>
              <th style={{ whiteSpace: 'nowrap' }}>来源</th>
              <th style={{ whiteSpace: 'nowrap' }}>时间</th>
              <th style={{ whiteSpace: 'nowrap' }}>退款状态</th>
              <th style={{ whiteSpace: 'nowrap' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => {
              // Disable refund if refund_status is set (pending, success, failed, etc.)
              const refundDisabled = order.refund_status && ["pending", "success", "failed"].includes(order.refund_status);
              let refundStatusLabel = '';
              switch (order.refund_status) {
                case 'pending': refundStatusLabel = '退款中'; break;
                case 'success': refundStatusLabel = '已退款'; break;
                case 'failed': refundStatusLabel = '退款失败'; break;
                case null:
                case undefined:
                case '': refundStatusLabel = '无'; break;
                default: refundStatusLabel = order.refund_status;
              }
              return (
                <React.Fragment key={order.out_trade_no}>
                  <tr style={{ fontSize: 13 }}>
                    <td style={{ textAlign: 'left', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 12, background: '#f8f9fa', cursor: 'pointer' }}
                        title="点击复制"
                        onClick={() => {navigator.clipboard.writeText(order.out_trade_no); toast.show('订单号已复制', {type: 'info'});}}>
                      {order.out_trade_no}
                    </td>
                    <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{order.order_type === 'pro_upgrade' ? 'Pro会员' : order.order_type === 'token_topup' ? 'Token充值' : order.order_type}</td>
                    <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{order.total_amount}</td>
                    <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>{order.status}</td>
                    <td style={{ textAlign: 'left', wordBreak: 'break-all', fontSize: 12 }}>{order.source}</td>
                    <td style={{ textAlign: 'left', whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(order.created_at).toLocaleString('zh-CN')}</td>
                    <td style={{ textAlign: 'left', whiteSpace: 'nowrap', fontSize: 12 }}>{refundStatusLabel}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid #736B92', background: refundDisabled ? '#f0f0f0' : '#fff', color: refundDisabled ? '#aaa' : '#736B92', cursor: refundDisabled ? 'not-allowed' : 'pointer', fontSize: 12 }}
                        onClick={() => !refundDisabled && handleRefund(order.out_trade_no)}
                        disabled={refundDisabled}
                        title={refundDisabled ? '已退款或退款处理中' : '申请退款'}
                      >
                        申请退款
                      </button>
                      {order.error_message && (
                        <button
                          style={{ marginLeft: 4, padding: '2px 6px', borderRadius: 4, border: '1px solid #c00', background: '#fff', color: '#c00', cursor: 'pointer', fontSize: 11 }}
                          onClick={() => setExpandedError(expandedError === order.out_trade_no ? null : order.out_trade_no)}
                        >
                          {expandedError === order.out_trade_no ? '隐藏错误' : '显示错误'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {order.error_message && expandedError === order.out_trade_no && (
                    <tr>
                      <td colSpan={8} style={{ color: '#c00', background: '#fff3f3', fontSize: 13, padding: 8, wordBreak: 'break-all' }}>
                        <b>错误信息：</b>{order.error_message}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
