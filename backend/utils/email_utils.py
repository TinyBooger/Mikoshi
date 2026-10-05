# -*- coding: utf-8 -*-
"""
阿里云邮件推送（DirectMail）SMTP 发信工具。

通过 SMTP 协议对接阿里云邮件推送服务：
- 发信地址（SMTP 用户名）与 SMTP 密码需在邮件推送控制台创建，并配置到环境变量。
- 默认使用 465 端口 + SSL 加密；若网络环境受限，可通过环境变量切换到 25/80 明文端口。

所需环境变量：
- ALIBABA_CLOUD_DM_ACCOUNT_NAME    发信地址（SMTP 用户名），必填
- ALIBABA_CLOUD_DM_SMTP_PASSWORD   SMTP 密码，必填
- ALIBABA_CLOUD_DM_SENDER_NICKNAME 发信人显示昵称，可选（默认语伴岛）
- ALIBABA_CLOUD_DM_REPLY_TO        回信地址，可选
- ALIBABA_CLOUD_DM_SMTP_HOST       SMTP 服务器地址，可选（默认 smtpdm.aliyun.com）
- ALIBABA_CLOUD_DM_SMTP_PORT       SMTP 端口，可选（默认 465）
- ALIBABA_CLOUD_DM_SMTP_SSL        是否启用 SSL，可选（默认 465 端口启用，其余端口禁用）

同时提供邮箱验证码的生成、缓存与校验（用于密码重置、更换邮箱等场景）。
"""
import os
import ssl
import secrets
import smtplib
import email
from datetime import datetime, timedelta
from typing import Dict
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.header import Header
from email.utils import formataddr

DEFAULT_SMTP_HOST = 'smtpdm.aliyun.com'
DEFAULT_SMTP_PORT = 465
# 用户可见文案统一使用产品名「语伴岛」；Mikoshi 仅作为代码/仓库名，不要出现在邮件里。
BRAND_NAME = '语伴岛'
DEFAULT_SENDER_NICKNAME = BRAND_NAME
SMTP_TIMEOUT_SECONDS = 15

EMAIL_CODE_LENGTH = 6
EMAIL_CODE_TTL_MINUTES = 5
EMAIL_CODE_RESEND_INTERVAL_SECONDS = 60

# 邮箱验证码缓存：key = "{purpose}:{email}"。
# 进程内内存存储，多进程/多实例部署时应替换为 Redis 等共享存储。
verification_codes: Dict[str, dict] = {}


def is_dev_environment() -> bool:
    """当前是否为非生产环境（开发/测试）。"""
    return os.getenv('ENVIRONMENT', 'development').strip().lower() != 'production'


def _get_port() -> int:
    raw = (os.getenv('ALIBABA_CLOUD_DM_SMTP_PORT') or '').strip()
    if not raw:
        return DEFAULT_SMTP_PORT
    try:
        return int(raw)
    except ValueError:
        return DEFAULT_SMTP_PORT


def _get_use_ssl(port: int) -> bool:
    raw = (os.getenv('ALIBABA_CLOUD_DM_SMTP_SSL') or '').strip().lower()
    if not raw:
        return port == 465
    return raw in ('1', 'true', 'yes', 'on')


def get_email_config():
    """
    读取阿里云邮件推送 SMTP 配置。

    Returns:
        dict | None: 配置项；未配置发信地址或 SMTP 密码时返回 None。
    """
    account_name = (os.getenv('ALIBABA_CLOUD_DM_ACCOUNT_NAME') or '').strip()
    smtp_password = (os.getenv('ALIBABA_CLOUD_DM_SMTP_PASSWORD') or '').strip()
    if not account_name or not smtp_password:
        return None

    port = _get_port()
    return {
        'host': (os.getenv('ALIBABA_CLOUD_DM_SMTP_HOST') or DEFAULT_SMTP_HOST).strip(),
        'port': port,
        # 465 端口固定使用 SSL
        'use_ssl': True if port == 465 else _get_use_ssl(port),
        'account_name': account_name,
        'smtp_password': smtp_password,
        'sender_nickname': (os.getenv('ALIBABA_CLOUD_DM_SENDER_NICKNAME') or DEFAULT_SENDER_NICKNAME).strip(),
        'reply_to': (os.getenv('ALIBABA_CLOUD_DM_REPLY_TO') or '').strip() or None,
    }


def is_email_configured() -> bool:
    """邮件推送服务是否已配置（发信地址与 SMTP 密码均存在）。"""
    return get_email_config() is not None


# --- 邮箱验证码 ---

def generate_email_code(length: int = EMAIL_CODE_LENGTH) -> str:
    """生成指定长度的数字验证码。"""
    return ''.join(str(secrets.randbelow(10)) for _ in range(length))


def _code_key(email: str, purpose: str) -> str:
    """验证码缓存键：邮箱大小写不敏感，按用途隔离。"""
    return f"{purpose}:{(email or '').strip().lower()}"


def can_resend_email_code(email: str, purpose: str) -> bool:
    """距离上次发送是否已超过最小重发间隔。"""
    entry = verification_codes.get(_code_key(email, purpose))
    if not entry:
        return True
    sent_at = entry.get('sent_at')
    if not sent_at:
        return True
    return (datetime.now() - sent_at).total_seconds() >= EMAIL_CODE_RESEND_INTERVAL_SECONDS


def store_email_code(email: str, purpose: str, code: str) -> None:
    """缓存验证码，仅在邮件发送成功后调用。"""
    now = datetime.now()
    verification_codes[_code_key(email, purpose)] = {
        'code': code,
        'sent_at': now,
        'expires_at': now + timedelta(minutes=EMAIL_CODE_TTL_MINUTES),
    }


def verify_email_code(email: str, purpose: str, code: str) -> bool:
    """校验验证码，校验通过后立即失效（一次性使用）。"""
    key = _code_key(email, purpose)
    entry = verification_codes.get(key)
    if not entry:
        return False
    if datetime.now() > entry['expires_at']:
        verification_codes.pop(key, None)
        return False
    if str(entry.get('code')) != str(code or '').strip():
        return False
    verification_codes.pop(key, None)
    return True


def _build_message(config: dict, to_address: str, subject: str, html_body: str, text_body: str = None) -> MIMEMultipart:
    """构建 multipart/alternative 邮件内容。"""
    msg = MIMEMultipart('alternative')
    msg['Subject'] = Header(subject, 'UTF-8')
    msg['From'] = formataddr([config['sender_nickname'], config['account_name']])
    msg['To'] = to_address
    if config['reply_to']:
        msg['Reply-to'] = config['reply_to']
    msg['Message-id'] = email.utils.make_msgid()
    msg['Date'] = email.utils.formatdate()

    if text_body is not None:
        msg.attach(MIMEText(text_body, _subtype='plain', _charset='UTF-8'))
    msg.attach(MIMEText(html_body, _subtype='html', _charset='UTF-8'))
    return msg


def _create_client(config: dict) -> smtplib.SMTP:
    """创建并登录 SMTP 客户端。"""
    if config['use_ssl']:
        # Python 3.10/3.11 默认加密套件与部分 SMTP 服务端握手失败，显式回退到 DEFAULT
        context = ssl.create_default_context()
        context.set_ciphers('DEFAULT')
        client = smtplib.SMTP_SSL(
            config['host'], config['port'], timeout=SMTP_TIMEOUT_SECONDS, context=context
        )
    else:
        client = smtplib.SMTP(config['host'], config['port'], timeout=SMTP_TIMEOUT_SECONDS)

    try:
        client.login(config['account_name'], config['smtp_password'])
    except Exception:
        try:
            client.close()
        except Exception:
            pass
        raise
    return client


def send_email(to_address: str, subject: str, html_body: str, text_body: str = None) -> dict:
    """
    发送单封邮件。

    Args:
        to_address: 收件人地址
        subject: 邮件主题
        html_body: HTML 正文
        text_body: 纯文本正文（可选）

    Returns:
        dict: {"success": bool, "message": str}
    """
    config = get_email_config()
    if not config:
        return {
            "success": False,
            "message": "邮件服务未配置（缺少 ALIBABA_CLOUD_DM_ACCOUNT_NAME / ALIBABA_CLOUD_DM_SMTP_PASSWORD）",
        }

    msg = _build_message(config, to_address, subject, html_body, text_body)
    client = None
    try:
        client = _create_client(config)
        client.sendmail(config['account_name'], [to_address], msg.as_string())
        return {"success": True, "message": "邮件已发送"}
    except smtplib.SMTPConnectError as e:
        return {"success": False, "message": f"邮件发送失败，连接失败：{e.smtp_code} {e.smtp_error}"}
    except smtplib.SMTPAuthenticationError as e:
        return {"success": False, "message": f"邮件发送失败，认证错误：{e.smtp_code} {e.smtp_error}"}
    except smtplib.SMTPSenderRefused as e:
        return {"success": False, "message": f"邮件发送失败，发件人被拒绝：{e.smtp_code} {e.smtp_error}"}
    except smtplib.SMTPRecipientsRefused as e:
        return {"success": False, "message": f"邮件发送失败，收件人被拒绝：{e}"}
    except smtplib.SMTPDataError as e:
        return {"success": False, "message": f"邮件发送失败，数据接收拒绝：{e.smtp_code} {e.smtp_error}"}
    except smtplib.SMTPException as e:
        return {"success": False, "message": f"邮件发送失败：{str(e)}"}
    except Exception as e:
        return {"success": False, "message": f"邮件发送异常：{str(e)}"}
    finally:
        if client is not None:
            try:
                client.quit()
            except Exception:
                pass


def _build_code_email(title: str, lead: str, code: str):
    """构建验证码邮件的主题与正文，返回 (subject, html_body, text_body)。"""
    footer = (
        f"验证码 {EMAIL_CODE_TTL_MINUTES} 分钟内有效，请勿转发给他人。"
        "如非本人操作，请忽略本邮件。"
    )
    subject = f'{BRAND_NAME} {title}'
    text_body = f"{lead}{code}\n{footer}"
    html_body = (
        '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,'
        'Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937;">'
        f'<h2 style="margin:0 0 16px;font-size:20px;">{BRAND_NAME} {title}</h2>'
        f'<p style="margin:0 0 12px;line-height:1.6;">{lead}</p>'
        f'<p style="margin:0 0 16px;font-size:28px;font-weight:700;letter-spacing:6px;">{code}</p>'
        '<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">'
        f'{footer}</p>'
        '</div>'
    )
    return subject, html_body, text_body


def build_password_reset_email(code: str):
    """构建密码重置验证码邮件的主题与正文，返回 (subject, html_body, text_body)。"""
    return _build_code_email('密码重置验证码', f'您正在重置 {BRAND_NAME} 账号密码，验证码为：', code)


def build_email_change_email(code: str):
    """构建更换邮箱验证码邮件的主题与正文，返回 (subject, html_body, text_body)。"""
    return _build_code_email('更换邮箱验证码', f'您正在更换 {BRAND_NAME} 账号绑定的邮箱，验证码为：', code)


def send_password_reset_code(to_address: str, code: str) -> dict:
    """发送密码重置验证码邮件。"""
    subject, html_body, text_body = build_password_reset_email(code)
    return send_email(to_address, subject, html_body, text_body)


def send_email_change_code(to_address: str, code: str) -> dict:
    """发送更换邮箱验证码邮件。"""
    subject, html_body, text_body = build_email_change_email(code)
    return send_email(to_address, subject, html_body, text_body)

