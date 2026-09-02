import re

with open('src/components/admin/AdminPortal.tsx', 'r') as f:
    content = f.read()

# Replace staffChatRef query with a limited query
content = re.sub(
    r"const q = query\(staffChatRef, orderBy\('timestamp', 'desc'\)\);",
    "const q = query(staffChatRef, orderBy('timestamp', 'desc'), limit(50));",
    content
)

with open('src/components/admin/AdminPortal.tsx', 'w') as f:
    f.write(content)
