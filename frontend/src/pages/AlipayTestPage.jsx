import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useToast } from '../components/ToastProvider';
import '../styles/AlipayTest.css';

/**
 * 支付宝支付测试页面
 * 用于测试支付宝沙盒环境的支付功能
 */
function AlipayTestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  
  // 表单状态
  const [formData, setFormData] = useState({
    totalAmount: '0.01',
    subject: '测试商品',
    body: '这是一个测试订单',
    paymentType: 'page',
    timeoutExpress: '30m'
  });
  
  // 配置信息
  const [config, setConfig] = useState(null);
  
  // 加载状态
  const [loading, setLoading] = useState(false);
  
  // 支付返回处理
  useEffect(() => {
    const outTradeNo = searchParams.get('out_trade_no');
    const tradeNo = searchParams.get('trade_no');
    const totalAmount = searchParams.get('total_amount');
    
    if (outTradeNo && tradeNo) {
      toast.show(`支付成功！订单号：${outTradeNo}，金额：¥${totalAmount}`, { type: 'success' });
    }
  }, [searchParams, toast]);
  
  // 获取支付宝配置
  useEffect(() => {
    fetchConfig();
  }, []);
  
  const fetchConfig = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/alipay/config', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('获取配置失败:', error);
    }
  };
  
  // 处理表单变化
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // 创建支付订单
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    
    if (!formData.totalAmount || parseFloat(formData.totalAmount) <= 0) {
      toast.show('请输入有效的订单金额', { type: 'error' });
      return;
    }
    
    if (!formData.subject.trim()) {
      toast.show('请输入订单标题', { type: 'error' });
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:8000/api/alipay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          total_amount: parseFloat(formData.totalAmount),
          subject: formData.subject,
          body: formData.body,
          payment_type: formData.paymentType,
          timeout_express: formData.timeoutExpress || undefined
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.payment_url) {
          toast.show('订单创建成功，正在跳转到支付页面...', { type: 'success' });
          
          // 跳转到支付宝支付页面
          setTimeout(() => {
            window.location.href = data.payment_url;
          }, 1000);
        } else {
          toast.show('创建订单失败', { type: 'error' });
        }
      } else {
        const error = await response.json();
        toast.show(error.detail || '创建订单失败', { type: 'error' });
      }
    } catch (error) {
      console.error('创建订单失败:', error);
      toast.show('创建订单失败：' + error.message, { type: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  // 查询订单
  const handleQueryOrder = async () => {
    const outTradeNo = prompt('请输入商户订单号：');
    
    if (!outTradeNo) {
      return;
    }
    
    try {
      const response = await fetch('http://localhost:8000/api/alipay/query-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          out_trade_no: outTradeNo
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          alert(JSON.stringify(result.data, null, 2));
        } else {
          toast.show('查询失败', { type: 'error' });
        }
      } else {
        const error = await response.json();
        toast.show(error.detail || '查询失败', { type: 'error' });
      }
    } catch (error) {
      console.error('查询订单失败:', error);
      toast.show('查询订单失败：' + error.message, { type: 'error' });
    }
  };
  
  return (
    <div className="alipay-test-page">
      <div className="test-container">
        <div className="test-header">
          <h1>支付宝支付测试</h1>
          <button className="back-btn" onClick={() => navigate(-1)}>
            返回
          </button>
        </div>
        
        {/* 配置信息显示 */}
        {config && (
          <div className="config-info">
            <h3>配置信息</h3>
            <div className="config-item">
              <span>APP ID:</span>
              <strong>{config.app_id || '未配置'}</strong>
            </div>
            <div className="config-item">
              <span>环境:</span>
              <strong className={config.debug ? 'sandbox' : 'production'}>
                {config.debug ? '沙盒环境' : '正式环境'}
              </strong>
            </div>
            <div className="config-item">
              <span>配置状态:</span>
              <strong className={config.is_configured ? 'configured' : 'not-configured'}>
                {config.is_configured ? '已配置' : '未配置'}
              </strong>
            </div>
            
            {config.debug && (
              <div className="sandbox-limits">
                <h4>⚠️ 沙箱环境限制说明</h4>
                <ul>
                  <li><strong>支付方式</strong>：仅支持余额支付，不支持银行卡、余额宝、花呗等</li>
                  <li><strong>扫码支付</strong>：需使用沙箱钱包客户端的扫一扫功能</li>
                  <li><strong>PC登录支付</strong>：需使用沙箱账户登录</li>
                  <li><strong>订单超时</strong>：不超过当前时间15小时</li>
                  <li><strong>退款限制</strong>：退款金额需与支付金额一致，每笔订单仅支持调用一次</li>
                </ul>
              </div>
            )}
            
            {!config.is_configured && (
              <div className="warning-box">
                <p>⚠️ 支付宝未配置，请在 .env 文件中添加以下配置：</p>
                <pre>
{`ALIPAY_APP_ID=你的APPID
ALIPAY_APP_PRIVATE_KEY=你的应用私钥
ALIPAY_PUBLIC_KEY=支付宝公钥
ALIPAY_DEBUG=true`}
                </pre>
              </div>
            )}
          </div>
        )}
        
        {/* 支付测试表单 */}
        <div className="test-form-section">
          <h3>创建支付订单</h3>
          
          <form onSubmit={handleCreateOrder} className="test-form">
            <div className="form-group">
              <label htmlFor="totalAmount">订单金额（元）</label>
              <input
                type="number"
                id="totalAmount"
                name="totalAmount"
                value={formData.totalAmount}
                onChange={handleChange}
                step="0.01"
                min="0.01"
                placeholder="请输入订单金额"
                required
              />
              <small>
                💡 沙箱环境建议使用 0.01 元进行测试 | 退款时金额必须与支付金额完全一致
              </small>
            </div>
            
            <div className="form-group">
              <label htmlFor="subject">订单标题</label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="请输入订单标题"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="body">订单描述</label>
              <textarea
                id="body"
                name="body"
                value={formData.body}
                onChange={handleChange}
                placeholder="请输入订单描述（可选）"
                rows="3"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="paymentType">支付类型</label>
              <select
                id="paymentType"
                name="paymentType"
                value={formData.paymentType}
                onChange={handleChange}
              >
                <option value="page">电脑网站支付</option>
                <option value="wap">手机网站支付</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="timeoutExpress">订单超时时间</label>
              <input
                type="text"
                id="timeoutExpress"
                name="timeoutExpress"
                value={formData.timeoutExpress}
                onChange={handleChange}
                placeholder="例如: 30m、2h、1d"
              />
              <small>
                沙箱环境限制：不超过当前时间15小时
              </small>
            </div>
            
            <button 
              type="submit" 
              className="submit-btn" 
              disabled={loading || !config?.is_configured}
            >
              {loading ? '创建中...' : '创建订单并支付'}
            </button>
          </form>
        </div>
        
        {/* 其他操作 */}
        <div className="other-actions">
          <h3>其他操作</h3>
          
          <div className="action-buttons">
            <button 
              className="action-btn" 
              onClick={handleQueryOrder}
              disabled={!config?.is_configured}
            >
              查询订单
            </button>
          </div>
        </div>
        
        {/* 沙盒账号提示 */}
        <div className="sandbox-info">
          <h3>沙盒测试账号</h3>
          <p>在支付宝开放平台的沙箱应用中可以获取测试账号信息：</p>
          <ul>
            <li>
              <strong>买家账号</strong>：测试支付宝账号，仅在沙箱环境有效
              <br /><small>用于登录支付宝钱包和PC端支付</small>
            </li>
            <li>
              <strong>登录密码</strong>：用于登录支付宝账号
            </li>
            <li>
              <strong>支付密码</strong>：用于确认支付交易
            </li>
          </ul>
          
          <div className="test-tips">
            <h4>💡 测试建议</h4>
            <ul>
              <li>首次支付前，建议给沙箱账号充值一定的测试余额（在沙箱控制台操作）</li>
              <li>使用 <code>0.01</code> 元进行初期测试，确保流程通畅</li>
              <li>测试退款时，退款金额必须与原支付金额完全相同</li>
              <li>每笔订单仅支持一次退款操作，退款后无法再退</li>
              <li>手机网站支付建议在真实手机设备上测试</li>
            </ul>
          </div>
          
          <p>
            <a 
              href="https://open.alipay.com/develop/sandbox/app" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              打开支付宝沙箱控制台 →
            </a>
          </p>
        </div>
        
        {/* 开发指南 */}
        <div className="dev-guide">
          <h3>开发指南</h3>
          <ol>
            <li>在支付宝开放平台创建应用并获取沙箱环境配置</li>
            <li>将配置信息添加到项目的 .env 文件中</li>
            <li>重启后端服务使配置生效</li>
            <li>在沙箱控制台的"沙箱账户"中给买家账号充值测试余额</li>
            <li>在本页面创建测试订单（建议先用 0.01 元测试）</li>
            <li>使用沙箱账号登录支付宝钱包并完成支付</li>
            <li>支付完成后会返回到本页面并显示支付结果</li>
            <li>进阶：测试订单查询、关闭、退款等其他功能</li>
          </ol>
          
          <div className="doc-links">
            <h4>相关文档</h4>
            <ul>
              <li>
                <a href="https://opendocs.alipay.com/common/02kkv7" target="_blank" rel="noopener noreferrer">
                  快速接入
                </a>
              </li>
              <li>
                <a href="https://opendocs.alipay.com/open/00dn7o" target="_blank" rel="noopener noreferrer">
                  沙箱调试说明
                </a>
              </li>
              <li>
                <a href="https://opendocs.alipay.com/open/270" target="_blank" rel="noopener noreferrer">
                  电脑网站支付产品文档
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlipayTestPage;
