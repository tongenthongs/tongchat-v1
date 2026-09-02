import re

with open('src/components/customer/CustomerPortal.tsx', 'r') as f:
    content = f.read()

# Add customerEmail state
content = re.sub(
    r'const \[customerPhone, setCustomerPhone\] = useState\(currentUser\?\.phone \|\| currentUser\?\.whatsappNumber \|\| \'\'\);',
    "const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || currentUser?.whatsappNumber || '');\n  const [customerEmail, setCustomerEmail] = useState(currentUser?.email || '');",
    content
)

# Add customerEmail to created order
content = re.sub(
    r'whatsapp: normalizePhone\(customerPhone\.trim\(\)\),',
    "whatsapp: normalizePhone(customerPhone.trim()),\n        customerEmail: customerEmail.trim(),",
    content
)

# Add customerEmail to CheckoutModal props
content = re.sub(
    r'customerPhone=\{customerPhone\}\n          setCustomerPhone=\{setCustomerPhone\}',
    "customerPhone={customerPhone}\n          setCustomerPhone={setCustomerPhone}\n          customerEmail={customerEmail}\n          setCustomerEmail={setCustomerEmail}",
    content
)

with open('src/components/customer/CustomerPortal.tsx', 'w') as f:
    f.write(content)
