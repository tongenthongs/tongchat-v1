import re

with open('src/components/customer/CustomerChat.tsx', 'r') as f:
    content = f.read()

# Match from `const handleGuestSubmit` up to the next `useEffect(() => {`
content = re.sub(r'  const handleGuestSubmit = async \(e: React\.FormEvent\) => \{.*?\n  \};\n\n  useEffect\(\(\) => \{', '  useEffect(() => {', content, flags=re.DOTALL)

with open('src/components/customer/CustomerChat.tsx', 'w') as f:
    f.write(content)

