import re
from pathlib import Path
from typing import Any, Dict, List, Tuple


BASE_DIR = Path(__file__).resolve().parent
KEYWORDS_FILE = BASE_DIR / "sensitive_keywords.txt"
PATTERNS_FILE = BASE_DIR / "sensitive_patterns.txt"

DEFAULT_KEYWORDS = {
    "色情", "约炮", "援交", "嫖娼", "卖淫", "鸡巴", "阴茎", "阴道", "奶子", "裸聊",
    "迷奸", "乱伦", "强奸", "毒品", "冰毒", "海洛因", "大麻", "枪支", "爆炸物", "恐怖袭击",
    "法轮功", "台独", "港独", "疆独", "反动", "煽动颠覆", "暴恐", "自杀教学",
    "微信号", "加微信", "加v", "加V", "vx", "Vx", "vx号", "qq号", "电报群", "飞机群",
    "博彩", "赌博", "刷单", "裸贷", "高利贷", "洗钱", "代开发票", "办证"
}

DEFAULT_PATTERN_STRINGS = [
    r"\b1[3-9]\d{9}\b",
    r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
    r"https?://[^\s]+",
    r"\b(?:t\.me|telegram\.me|discord\.gg)/[^\s]+",
    r"\b(?:wx|vx|wechat|qq)[:：\s]*[A-Za-z0-9_-]{5,}\b",
    r"(?:QQ群|Q群|群号)[:：\s]*\d{5,}",
]


def _load_lines_from_file(file_path: Path) -> List[str]:
    if not file_path.exists():
        return []

    lines: List[str] = []
    with file_path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            lines.append(line)
    return lines


def _load_keywords() -> List[str]:
    file_keywords = _load_lines_from_file(KEYWORDS_FILE)
    if not file_keywords:
        return sorted(DEFAULT_KEYWORDS, key=len, reverse=True)
    return sorted(set(file_keywords), key=len, reverse=True)


def _load_patterns() -> List[re.Pattern[str]]:
    file_pattern_strings = _load_lines_from_file(PATTERNS_FILE)
    raw_pattern_strings = file_pattern_strings or DEFAULT_PATTERN_STRINGS
    compiled_patterns: List[re.Pattern[str]] = []

    for pattern_string in raw_pattern_strings:
        try:
            compiled_patterns.append(re.compile(pattern_string, re.IGNORECASE))
        except re.error:
            continue

    if not compiled_patterns:
        compiled_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in DEFAULT_PATTERN_STRINGS]

    return compiled_patterns


SENSITIVE_KEYWORDS = _load_keywords()
SENSITIVE_PATTERNS = _load_patterns()


def _mask_text_span(source_text: str, start_index: int, end_index: int) -> str:
    if start_index >= end_index:
        return source_text
    mask = "*" * (end_index - start_index)
    return f"{source_text[:start_index]}{mask}{source_text[end_index:]}"


def censor_text(raw_text: str) -> Tuple[str, bool]:
    if raw_text is None:
        return raw_text, False

    censored_text = raw_text
    changed = False

    for keyword in SENSITIVE_KEYWORDS:
        keyword_regex = re.compile(re.escape(keyword), re.IGNORECASE)

        def _replace_keyword(match: re.Match[str]) -> str:
            nonlocal changed
            changed = True
            return "*" * len(match.group(0))

        censored_text = keyword_regex.sub(_replace_keyword, censored_text)

    for pattern in SENSITIVE_PATTERNS:
        search_start = 0
        while True:
            matched = pattern.search(censored_text, search_start)
            if not matched:
                break
            changed = True
            start_index, end_index = matched.span()
            censored_text = _mask_text_span(censored_text, start_index, end_index)
            search_start = start_index + 1

    return censored_text, changed


def censor_form_payload(payload: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
    sanitized_payload: Dict[str, Any] = {}
    has_censored_changes = False

    for field_name, field_value in payload.items():
        if isinstance(field_value, str):
            censored_value, changed = censor_text(field_value)
            sanitized_payload[field_name] = censored_value
            has_censored_changes = has_censored_changes or changed
            continue

        if isinstance(field_value, list):
            sanitized_list: List[Any] = []
            list_changed = False
            for list_item in field_value:
                if isinstance(list_item, str):
                    censored_item, item_changed = censor_text(list_item)
                    sanitized_list.append(censored_item)
                    list_changed = list_changed or item_changed
                else:
                    sanitized_list.append(list_item)
            sanitized_payload[field_name] = sanitized_list
            has_censored_changes = has_censored_changes or list_changed
            continue

        sanitized_payload[field_name] = field_value

    return sanitized_payload, has_censored_changes