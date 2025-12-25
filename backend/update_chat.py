import sys
with open('routes/chat.py', 'r') as f:
    content = f.read()

# Replace the old delete_chat implementation
old_code = '''    if current_user.chat_history:
        current_user.chat_history = [chat for chat in current_user.chat_history if chat.get("chat_id") != chat_id]
        attributes.flag_modified(current_user, "chat_history")
        db.commit()
        return {"status": "success"}
    
    return JSONResponse(content={"error": "Chat not found"}, status_code=404)'''

new_code = '''    entry = fetch_chat_history_entry(db, current_user.id, chat_id)
    if not entry:
        return JSONResponse(content={"error": "Chat not found"}, status_code=404)

    db.delete(entry)
    db.commit()
    return {"status": "success"}'''

if old_code not in content:
    print("ERROR: Could not find old code to replace")
    sys.exit(1)

content = content.replace(old_code, new_code)

with open('routes/chat.py', 'w') as f:
    f.write(content)

print("✓ Updated delete_chat function")
