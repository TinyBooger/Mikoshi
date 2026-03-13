def validate_character_fields(name, persona, tagline, greeting, sample_dialogue, tags, context_label="standard"):
    MAX_NAME_LENGTH = 50
    STANDARD_MAX_PERSONA_LENGTH = 400
    ADVANCED_MAX_PERSONA_LENGTH = 1200
    MAX_TAGLINE_LENGTH = 200
    MAX_GREETING_LENGTH = 500
    STANDARD_MAX_SAMPLE_LENGTH = 200
    ADVANCED_MAX_SAMPLE_LENGTH = 600
    MAX_TAGS = 20

    safe_context_label = "advanced" if context_label == "advanced" else "standard"
    max_persona_length = ADVANCED_MAX_PERSONA_LENGTH if safe_context_label == "advanced" else STANDARD_MAX_PERSONA_LENGTH
    max_sample_length = ADVANCED_MAX_SAMPLE_LENGTH if safe_context_label == "advanced" else STANDARD_MAX_SAMPLE_LENGTH

    if len(name) > MAX_NAME_LENGTH:
        return f"Name too long (max {MAX_NAME_LENGTH})"
    if len(persona) > max_persona_length:
        return f"Persona too long (max {max_persona_length})"
    if len(tagline) > MAX_TAGLINE_LENGTH:
        return f"Tagline too long (max {MAX_TAGLINE_LENGTH})"
    if len(greeting) > MAX_GREETING_LENGTH:
        return f"Greeting too long (max {MAX_GREETING_LENGTH})"
    if len(sample_dialogue) > max_sample_length:
        return f"Sample dialogue too long (max {max_sample_length})"
    if len(tags) > MAX_TAGS:
        return f"Too many tags (max {MAX_TAGS})"
    if len(set(tags)) != len(tags):
        return "Duplicate tags are not allowed"

    return None  # valid


def validate_account_fields(email=None, password=None, name=None):
    MAX_NAME_LENGTH = 50
    MAX_EMAIL_LENGTH = 100
    MAX_PASSWORD_LENGTH = 128

    if email is not None and len(email) > MAX_EMAIL_LENGTH:
        return f"Email too long (max {MAX_EMAIL_LENGTH})"
    if password is not None and len(password) > MAX_PASSWORD_LENGTH:
        return f"Password too long (max {MAX_PASSWORD_LENGTH})"
    if name is not None and len(name) > MAX_NAME_LENGTH:
        return f"Name too long (max {MAX_NAME_LENGTH})"
    return None
