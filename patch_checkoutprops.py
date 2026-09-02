import re

with open('src/components/checkout/CheckoutModal.tsx', 'r') as f:
    content = f.read()

content = re.sub(
    r'customerPhone\?: string;\n  setCustomerPhone\?: \(val: string\) => void;',
    "customerPhone?: string;\n  setCustomerPhone?: (val: string) => void;\n  customerEmail?: string;\n  setCustomerEmail?: (val: string) => void;",
    content
)

content = re.sub(
    r'customerPhone = \'\',\n  setCustomerPhone = \(\) => \{\},',
    "customerPhone = '',\n  setCustomerPhone = () => {},\n  customerEmail = '',\n  setCustomerEmail = () => {},",
    content
)

with open('src/components/checkout/CheckoutModal.tsx', 'w') as f:
    f.write(content)
