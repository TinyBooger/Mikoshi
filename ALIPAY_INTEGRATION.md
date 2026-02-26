# 支付宝支付接入指南

本项目已集成两种支付提供方：
- `alipay`：真实支付宝（沙箱/正式）
- `mock`：开发环境模拟支付（创建订单后立即视为支付成功）

默认策略：
- `ENVIRONMENT=production` 时强制使用 `alipay`
- 非生产环境默认使用 `mock`（可通过 `PAYMENT_PROVIDER` 覆盖为 `alipay`）

## 目录
- [快速开始](#快速开始)
- [获取支付宝配置](#获取支付宝配置)
- [配置项目](#配置项目)
- [测试支付](#测试支付)
- [API接口说明](#api接口说明)
- [常见问题](#常见问题)

## 快速开始

### 1. 获取支付宝配置

#### 步骤1: 注册支付宝开放平台账号
1. 访问 [支付宝开放平台](https://open.alipay.com/)
2. 注册并登录账号

#### 步骤2: 进入沙箱环境
1. 登录后，点击"开发服务" > "研发服务" > "沙箱"
2. 或直接访问 [沙箱控制台](https://open.alipay.com/develop/sandbox/app)

#### 步骤3: 获取应用信息
在沙箱控制台页面，你可以看到：

- **APPID**: 应用的唯一标识
- **应用私钥**: 用于签名（需要生成）
- **支付宝公钥**: 用于验签
- **支付宝网关**: `https://openapi-sandbox.dl.alipaydev.com/gateway.do`

### 2. 生成密钥对

#### 方法1: 使用支付宝工具（推荐）
1. 下载 [支付宝开放平台密钥工具](https://opendocs.alipay.com/common/02kipl)
2. 运行工具，选择"RSA2(SHA256)密钥"
3. 点击"生成密钥"
4. 保存"应用私钥"（私钥需要保密）
5. 复制"应用公钥"，上传到支付宝沙箱控制台

#### 方法2: 使用OpenSSL命令行
```bash
# 生成私钥
openssl genrsa -out app_private_key.pem 2048

# 从私钥生成公钥
openssl rsa -in app_private_key.pem -pubout -out app_public_key.pem

# 查看私钥内容（用于配置）
cat app_private_key.pem
```

#### 步骤4: 上传应用公钥
1. 在沙箱控制台，找到"接口加签方式(密钥/证书)"
2. 选择"公钥"模式
3. 点击"设置应用公钥"
4. 粘贴应用公钥内容
5. 保存后，系统会生成"支付宝公钥"，复制保存

## 配置项目

### 1. 安装依赖
```bash
# 后端
cd backend
pip install -r requirements.txt

# 前端
cd frontend
npm install
```

### 2. 配置环境变量

在项目的 `secrets/Mikoshi.env` 文件中添加以下配置：

```env
# 环境与支付提供方
ENVIRONMENT=development
PAYMENT_PROVIDER=mock

# 支付宝支付配置
ALIPAY_APP_ID=你的沙箱APPID
ALIPAY_APP_PRIVATE_KEY=你的应用私钥（完整的，包括头尾）
ALIPAY_PUBLIC_KEY=支付宝公钥（完整的，包括头尾）
ALIPAY_DEBUG=true

# 后端公网地址（用于支付宝异步通知 notify_url）
BACKEND_BASE_URL=https://api.your-domain.com
```

生产环境示例：
```env
ENVIRONMENT=production
PAYMENT_PROVIDER=alipay
```

**重要提示**:
- 私钥和公钥需要包含 `-----BEGIN ... KEY-----` 和 `-----END ... KEY-----`
- 如果密钥内容很长，请确保没有换行问题
- 可以将密钥内容转换为单行格式（去掉头尾后，移除所有换行）
- `BACKEND_BASE_URL` 必须是支付宝可以访问到的公网后端地址，不能是 localhost

**示例格式**:
```env
ALIPAY_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...（完整私钥内容）...
-----END RSA PRIVATE KEY-----

ALIPAY_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG...（完整公钥内容）...
-----END PUBLIC KEY-----
```

或单行格式（去除头尾）:
```env
ALIPAY_APP_PRIVATE_KEY=MIIEowIBAAKCAQEA...（私钥内容，无换行）
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG...（公钥内容，无换行）
```

### 3. 重启服务
配置完成后，重启后端服务使配置生效：
```bash
cd backend
python server.py
```

## 测试支付

### 1. 访问测试页面
启动项目后，访问: `http://localhost:5173/alipay/test`

### 2. 获取沙箱测试账号
在沙箱控制台可以看到：
- **买家账号**: 用于登录测试的支付宝账号
- **登录密码**: 用于登录
- **支付密码**: 用于确认支付

### 3. 测试流程
1. 在测试页面填写订单信息（建议金额: 0.01元）
2. 点击"创建订单并支付"
3. 跳转到支付宝沙箱支付页面
4. 使用沙箱买家账号登录
5. 输入支付密码完成支付
6. 支付完成后会返回测试页面并显示结果

## API接口说明

### 创建支付订单
```
POST /api/alipay/create-order
Content-Type: application/json

{
  "total_amount": 0.01,
  "subject": "测试商品",
  "body": "这是一个测试订单",
  "payment_type": "page",
  "timeout_express": "30m"
}
```

**参数说明**:
- `total_amount`: 订单金额（元）
- `subject`: 订单标题
- `body`: 订单描述（可选）
- `payment_type`: 支付类型（page=电脑网站, wap=手机网站）
- `timeout_express`: 订单超时时间（可选，沙箱环境不超过15小时，格式如: 30m、2h、1d等）

**提供方行为**:
- `mock`: `payment_url` 会直接跳转到前端 `/alipay/return`，并带上成功参数，订单立即标记为已支付
- `alipay`: `payment_url` 为支付宝收银台地址，支付结果通过同步返回/异步通知确认

**响应**:
```json
{
  "success": true,
  "payment_url": "https://openapi-sandbox.dl.alipaydev.com/gateway.do?...",
  "out_trade_no": "MK20260206123456abcd1234",
  "total_amount": 0.01,
  "subject": "测试商品",
  "provider": "alipay"
}
```

### 查询订单
```
POST /api/alipay/query-order
Content-Type: application/json

{
  "out_trade_no": "MK20260206123456abcd1234"
}
```

### 关闭订单
```
POST /api/alipay/close-order
Content-Type: application/json

{
  "out_trade_no": "MK20260206123456abcd1234"
}
```

### 申请退款
```
POST /api/alipay/refund
Content-Type: application/json

{
  "out_trade_no": "MK20260206123456abcd1234",
  "refund_amount": 0.01,
  "refund_reason": "测试退款"
}
```

### 获取配置信息
```
GET /api/alipay/config
```

## 项目结构

```
backend/
  ├── routes/
  │   └── alipay.py           # 支付宝支付路由
  ├── utils/
  │   ├── alipay_utils.py     # 支付宝工具类
  │   └── payment_provider.py # 支付提供方选择（alipay/mock）
  └── server.py               # 注册支付宝路由

frontend/
  ├── src/
  │   ├── pages/
  │   │   └── AlipayTestPage.jsx   # 测试页面
  │   └── styles/
  │       └── AlipayTest.css       # 测试页面样式
  └── App.jsx                      # 路由配置
```

## 沙箱环境限制

在沙箱环境中，有一些特殊的限制和注意事项需要了解：

### 支付限制
- **支付方式**: 仅支持余额支付，不支持银行卡、余额宝、花呗等支付方式
- **扫码支付**: 电脑网站支付的扫码支付必须使用沙箱钱包客户端的扫一扫功能
- **PC登录支付**: 电脑网站支付PC端登录必须使用沙箱账户登录支付
- **手续费**: 沙箱测试会扣手续费（比例仅供参考，生产环境以签约适议为准）

### 参数限制

#### timeout_express（相对超时时间）
- **沙箱环境**: 不可超过当前时间15小时
- **正式环境**: 最大不可超过合约约定时间，默认15天
- **示例**: `30m`（30分钟）、`2h`（2小时）、`1d`（1天）

#### time_expire（绝对超时时间）
- **沙箱环境**: 不可超过当前时间15小时

#### extend_params（扩展参数）
- **花呗分期**: 沙箱环境不支持花呗分期测试

#### ext_user_info（外部指定买家）
- **沙箱环境**: 无法校验买家身份信息

### 退款限制
- **退款金额**: 退款需和支付金额保持一致，不支持部分退款
- **退款次数**: 每笔交易订单仅支持调用一次退款接口
- **注意**: 沙箱环境无论退款是否成功，都无法进行二次退款

### 其他限制
- **对账单**: 沙箱环境只做模拟调用，下载的账单为模板，账单内没有实际数据
- **银行卡支付**: 沙箱环境不支持银行卡支付，无法模拟测试
- 建议只传必传参数测试，避免部分参数只对正式环境兼容

## 测试建议

1. **初期测试**
   - 使用 `0.01` 元进行初期测试，确保整个支付流程没有问题
   - 给沙箱账号充值足够的测试余额（在沙箱控制台操作）

2. **支付测试**
   - 使用沙箱买家账号登录支付宝钱包
   - 输入沙箱支付密码完成支付
   - 验证支付完成回调和异步通知

3. **退款测试**
   - 先进行小额支付（例如0.01元）
   - 使用与支付金额完全相同的金额进行退款
   - 注意每笔订单仅支持一次退款操作

4. **订单查询和关闭**
   - 测试订单查询接口，验证支付状态
   - 测试未支付订单的关闭操作

5. **移动端测试**
   - 手机网站支付建议在真实手机设备上测试
   - 使用手机钉钉/浏览器访问测试页面
   - 验证手机支付流程正常

## 常见问题

### 1. 提示"支付宝客户端未初始化"
**原因**: 环境变量配置不正确或未配置
**解决**: 
- 检查 `.env` 文件是否包含所有必需的配置
- 确保密钥格式正确
- 重启后端服务

### 2. 签名验证失败
**原因**: 密钥配置错误
**解决**:
- 确认应用私钥和支付宝公钥配置正确
- 确认支付宝控制台已上传正确的应用公钥
- 检查密钥格式是否完整（包含头尾）

### 3. 支付页面无法访问
**原因**: 沙箱网关地址错误
**解决**:
- 确认使用沙箱网关: `https://openapi-sandbox.dl.alipaydev.com/gateway.do`
- 检查 `ALIPAY_DEBUG=true` 是否设置

### 4. 异步通知无法接收
**原因**: 本地环境无法被支付宝服务器访问
**解决**:
- 沙箱环境的异步通知需要公网可访问的地址
- 可以使用 ngrok 等工具将本地服务暴露到公网
- 或在有公网IP的服务器上测试

### 5. 从沙箱迁移到正式环境
**步骤**:
1. 在支付宝开放平台创建正式应用
2. 签约所需的支付产品
3. 更新环境变量:
   ```env
   ALIPAY_APP_ID=正式环境的APPID
   ALIPAY_APP_PRIVATE_KEY=正式环境的应用私钥
   ALIPAY_PUBLIC_KEY=正式环境的支付宝公钥
   ALIPAY_DEBUG=false
   ```
4. 修改回调地址为正式域名
5. 重启服务

### 6. 沙箱环境特殊情况

#### 问题：支付时无法选择银行卡支付
**原因**: 沙箱环境仅支持余额支付
**解决**: 
- 给沙箱账号充值测试余额（在沙箱控制台操作）
- 使用余额完成支付测试

#### 问题：订单超时时间设置不生效
**原因**: 沙箱环境有15小时的限制
**解决**:
- 检查 `timeout_express` 是否超过15小时
- 使用 `30m`、`2h`、`1d` 等有效格式

#### 问题：退款失败
**原因**: 退款金额与支付金额不一致或已退款过
**解决**:
- 确保退款金额与支付金额完全相同
- 检查是否重复调用退款接口（每笔订单仅支持一次）

#### 问题：测试账号无法登录
**原因**: 账号信息过期或错误
**解决**:
- 在沙箱控制台重新获取测试账号信息
- 确认登录密码和支付密码正确
- 使用谷歌浏览器隐身窗口重新尝试

## 更多资源

- [支付宝开放平台文档](https://opendocs.alipay.com/)
- [沙箱环境说明](https://opendocs.alipay.com/common/02kkv7)
- [电脑网站支付](https://opendocs.alipay.com/open/270)
- [手机网站支付](https://opendocs.alipay.com/open/203)
- [API文档](https://opendocs.alipay.com/apis)

## 技术支持

如有问题，可以：
1. 查看支付宝开放平台的[常见问题](https://opendocs.alipay.com/support)
2. 访问[支付宝开发者社区](https://forum.alipay.com/)
3. 在项目中提交Issue

---

**注意**: 
- 沙箱环境仅用于开发测试，不能用于生产环境
- 测试账号和密码仅在沙箱环境有效
- 正式上线前需要完成企业认证和产品签约
