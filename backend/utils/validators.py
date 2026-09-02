from utils.text_normalization import normalize_line_endings


def validate_character_fields(name, persona, tagline, greetings, sample_dialogue, tags, context_label="standard", long_description=""):
    MAX_NAME_LENGTH = 50
    MAX_PERSONA_LENGTH = 400
    MAX_TAGLINE_LENGTH = 200
    MAX_GREETING_LENGTH = 3000
    MAX_GREETINGS_COUNT = 20
    MAX_SAMPLE_LENGTH = 200
    MAX_TAGS = 20
    ADVANCED_MAX_LONG_DESCRIPTION_LENGTH = 15000

    safe_context_label = "advanced" if context_label == "advanced" else "standard"
    normalized_long_description = normalize_line_endings(long_description).strip()

    if len(name) > MAX_NAME_LENGTH:
        return f"名称过长（最多 {MAX_NAME_LENGTH} 字）"
    logical_persona = normalize_line_endings(persona)
    if len(logical_persona) > MAX_PERSONA_LENGTH:
        return f"核心设定过长（最多 {MAX_PERSONA_LENGTH} 字）"
    if len(normalize_line_endings(tagline)) > MAX_TAGLINE_LENGTH:
        return f"简介过长（最多 {MAX_TAGLINE_LENGTH} 字）"
    # Validate greetings list
    greetings_list = greetings or []
    if len(greetings_list) > MAX_GREETINGS_COUNT:
        return f"开场白数量过多（最多 {MAX_GREETINGS_COUNT} 条）"
    for g in greetings_list:
        if not isinstance(g, str):
            return "每条开场白必须是文本"
        if len(normalize_line_endings(g)) > MAX_GREETING_LENGTH:
            return f"开场白过长（最多 {MAX_GREETING_LENGTH} 字）"
    if len(normalize_line_endings(sample_dialogue)) > MAX_SAMPLE_LENGTH:
        return f"示例对话过长（最多 {MAX_SAMPLE_LENGTH} 字）"
    if safe_context_label == "advanced" and len(normalized_long_description) > ADVANCED_MAX_LONG_DESCRIPTION_LENGTH:
        return f"详细设定过长（最多 {ADVANCED_MAX_LONG_DESCRIPTION_LENGTH} 字）"
    if len(tags) > MAX_TAGS:
        return f"标签数量过多（最多 {MAX_TAGS} 个）"
    if len(set(tags)) != len(tags):
        return "标签不能重复"

    return None  # valid


def validate_account_fields(email=None, password=None, name=None):
    MAX_NAME_LENGTH = 50
    MAX_EMAIL_LENGTH = 100
    MAX_PASSWORD_LENGTH = 128

    if email is not None and len(email) > MAX_EMAIL_LENGTH:
        return f"邮箱过长（最多 {MAX_EMAIL_LENGTH} 字）"
    if password is not None and len(password) > MAX_PASSWORD_LENGTH:
        return f"密码过长（最多 {MAX_PASSWORD_LENGTH} 字）"
    if name is not None and len(name) > MAX_NAME_LENGTH:
        return f"昵称过长（最多 {MAX_NAME_LENGTH} 字）"
    return None
