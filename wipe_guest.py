import re

with open('src/components/customer/CustomerChat.tsx', 'r') as f:
    content = f.read()

# Remove the guest states
content = re.sub(r'  // --- GUEST CHAT FORM STATES & PERSISTENCE ---.*?// 800ms Debounce Roblox Profile Checker', '', content, flags=re.DOTALL)
content = re.sub(r'  // 800ms Debounce Roblox Profile Checker\n  useEffect\(\(\) => \{.*?\}, 800\);\n    return \(\) => clearTimeout\(timer\);\n  \}, \[guestRoblox\]\);\n', '', content, flags=re.DOTALL)

# Remove the restore guest from localstorage block
content = re.sub(r'  // Restore guest from localStorage on mount if no currentUser, or auto-generate instantly\n  useEffect\(\(\) => \{.*?  \}, \[currentUser, setCurrentUser\]\);\n', '', content, flags=re.DOTALL)

# Remove handleGuestSubmit completely
content = re.sub(r'  const handleGuestSubmit = async \(e: React\.FormEvent\) => \{.*?\n  \};\n\n  useEffect\(\(\) => \{', '  useEffect(() => {', content, flags=re.DOTALL)

with open('src/components/customer/CustomerChat.tsx', 'w') as f:
    f.write(content)

