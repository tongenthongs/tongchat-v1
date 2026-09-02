import re

with open('src/components/customer/CustomerChat.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'  useEffect\(\(\) => \{\n    const cleanUser = guestRoblox.*?  \}, \[guestRoblox\]\);\n', '', content, flags=re.DOTALL)

with open('src/components/customer/CustomerChat.tsx', 'w') as f:
    f.write(content)
