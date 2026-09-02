import re

with open('src/components/checkout/CheckoutModal.tsx', 'r') as f:
    text = f.read()

# Try replacing RULES AGREEMENT POPUP MODAL to see if the error is there.
text = re.sub(
    r'\{/\* RULES AGREEMENT POPUP MODAL \*/\}.*?\{/\* OFF-HOURS GIFT CONFIRMATION MODAL \*/\}',
    '{/* OFF-HOURS GIFT CONFIRMATION MODAL */}',
    text,
    flags=re.DOTALL
)

with open('src/components/checkout/CheckoutModal.tsx', 'w') as f:
    f.write(text)
