def normalize_line_endings(value):
    """Normalize line endings in free-text fields to LF-only.

    Browser multipart/form-data transport converts each bare LF character in
    a form value into CRLF (\r\n) before it reaches the server. DOM textareas
    only ever hold LF line endings, so those \r characters are a transport
    artifact, not authored content. Normalizing at the storage boundary keeps
    the length the server counts, the text stored in the database, and the
    character counts shown by the frontend all consistent with what the user
    actually typed.

    Non-string values (e.g. None) are returned as an empty string.
    """
    if value is None:
        return ""
    return value.replace("\r\n", "\n").replace("\r", "\n")
