import re

with open('firestore.rules', 'r') as f:
    content = f.read()

# Update settings rule
new_settings_rule = """
    match /settings/{settingId} {
      allow read: if true;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['ADMIN', 'OWNER'];
    }
"""
content = re.sub(
    r'match /settings/\{settingId\} \{\s+allow read, write: if true;\s+\}',
    new_settings_rule.strip(),
    content
)

with open('firestore.rules', 'w') as f:
    f.write(content)
