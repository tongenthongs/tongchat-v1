import re

with open('src/context/AppContext.tsx', 'r') as f:
    content = f.read()

# We will add an explicit listener for settings/whatsapp and merge it into adminWhatsappNumber
# Also we update updatePaymentSettings to write to settings/whatsapp

# 1. Write logic
content = re.sub(
    r'const whatsappVal = fields\.adminWhatsappNumber \|\| fields\.adminWhatsapp;\n      if \(whatsappVal !== undefined\) \{',
    "const whatsappVal = fields.adminWhatsappNumber || fields.adminWhatsapp;\n      if (whatsappVal !== undefined) {\n        // NEW: Save to settings/whatsapp as requested\n        await setDoc(doc(db, 'settings', 'whatsapp'), {\n          giftAdminNumber: whatsappVal,\n          updatedAt: new Date().toISOString()\n        }, { merge: true });\n",
    content
)

# 2. Listener logic
# Let's add it right after unsubPayment
listener_logic = """
    // Explicit WA listener as requested
    const unsubWhatsapp = onSnapshot(doc(db, 'settings', 'whatsapp'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().giftAdminNumber) {
        setAdminWhatsappNumber(docSnap.data().giftAdminNumber);
      }
    });
"""

content = re.sub(
    r'const unsubPayment = onSnapshot\(doc\(db, \'settings\', \'payment\'\), \(docSnap\) => \{',
    listener_logic + "\n    const unsubPayment = onSnapshot(doc(db, 'settings', 'payment'), (docSnap) => {",
    content
)

# Also ensure it unsubscribes
content = re.sub(
    r'unsubPayment\(\);\n      unsubDedicatedStore\(\);',
    "unsubWhatsapp();\n      unsubPayment();\n      unsubDedicatedStore();",
    content
)

with open('src/context/AppContext.tsx', 'w') as f:
    f.write(content)
