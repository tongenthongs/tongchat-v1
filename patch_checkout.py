import re

with open('src/components/checkout/CheckoutModal.tsx', 'r') as f:
    content = f.read()

# Add step state
content = re.sub(
    r'const \[otherPaymentSubtype, setOtherPaymentSubtype\] = useState<\'QRIS\' \| \'DANA\'>\(\'QRIS\'\);',
    "const [otherPaymentSubtype, setOtherPaymentSubtype] = useState<'QRIS' | 'DANA'>('QRIS');\n  const [step, setStep] = useState<'INFO' | 'PAYMENT'>('INFO');",
    content
)

# Replace everything from {/* GAME ID & ACCOUNT FORM (ROBLOX MANUAL INPUT) */} to the end of the form
# We will manually replace the return statement to implement the step logic.

# Let's just create a completely new rendering for CheckoutModal using the step logic.
