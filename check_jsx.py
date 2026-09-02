import re
with open('src/components/checkout/CheckoutModal.tsx', 'r') as f:
    text = f.read()

def check(s):
    open_p = s.count('(')
    close_p = s.count(')')
    open_c = s.count('{')
    close_c = s.count('}')
    print(f"Parentheses: {open_p} {close_p}")
    print(f"Curly: {open_c} {close_c}")

check(text)
