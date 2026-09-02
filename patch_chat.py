import re

with open('src/components/customer/CustomerChat.tsx', 'r') as f:
    content = f.read()

# Remove store_status logic
content = re.sub(
    r"const unsubStoreStatus = onSnapshot\(doc\(db, 'settings', 'store_status'\).*?}\);\n",
    "",
    content,
    flags=re.DOTALL
)
content = content.replace("unsubStoreStatus();", "")

with open('src/components/customer/CustomerChat.tsx', 'w') as f:
    f.write(content)
