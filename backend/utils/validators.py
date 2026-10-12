from utils.text_normalization import normalize_line_endings


def validate_example_messages(example_messages):
    if not isinstance(example_messages, list) or len(example_messages) > 3:
        return "示例对话最多为 3 条"
    for message in example_messages:
        if not isinstance(message, str):
            return "每条示例对话必须是文本"
        if len(normalize_line_endings(message)) > 400:
            return "单条示例对话过长（最多 400 字）"
    return None


def validate_character_fields(name, description, tagline, greetings, sample_dialogue, tags):
    MAX_NAME_LENGTH = 50
    MAX_DESCRIPTION_LENGTH = 15000
    MAX_TAGLINE_LENGTH = 255
    MAX_GREETING_LENGTH = 3000
    MAX_GREETINGS_COUNT = 20
    MAX_TAGS = 20

    if len(name) > MAX_NAME_LENGTH:
        return f"名称过长（最多 {MAX_NAME_LENGTH} 字）"
    if len(normalize_line_endings(description)) > MAX_DESCRIPTION_LENGTH:
        return f"角色设定过长（最多 {MAX_DESCRIPTION_LENGTH} 字）"
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
    example_error = validate_example_messages(sample_dialogue)
    if example_error:
        return example_error
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
