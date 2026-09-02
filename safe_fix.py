import re

# 1. Fix CustomerChat.tsx Activity Flags
with open('src/components/customer/CustomerChat.tsx', 'r') as f:
    chat_content = f.read()

chat_content = re.sub(
    r'  const isGuestUser = Boolean\(currentUser\?\.isGuest \|\| currentUser\?\.id\?\.startsWith\(\'guest_\'\)\);\n  const hasValidGuestProfile = .*?;\n  const isAuthenticated = Boolean\(currentUser && \!isGuestUser\);\n  const isChatActive = isAuthenticated \|\| hasValidGuestProfile;',
    '  const isGuestUser = false;\n  const hasValidGuestProfile = false;\n  const isAuthenticated = Boolean(currentUser);\n  const isChatActive = Boolean(currentUser);',
    chat_content,
    flags=re.DOTALL
)

# And remove the guest form block entirely (or just let it be blocked by isChatActive, but prompt wants it removed)
# Since !isChatActive now means !currentUser, and if !currentUser it will show the form, let's replace the form with a simple message.
old_form = r"""        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 bg-\[\#0B0F19\]">
          \{/\* AREA FORM GUEST \*/\}
          <div className="max-w-md mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">.*?          </div>
        </div>"""

new_form = r"""        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 bg-[#0B0F19] flex items-center justify-center">
          <div className="text-center text-slate-400">
            <p>Silakan login untuk memulai obrolan.</p>
          </div>
        </div>"""

chat_content = re.sub(old_form, new_form, chat_content, flags=re.DOTALL)

with open('src/components/customer/CustomerChat.tsx', 'w') as f:
    f.write(chat_content)

# 2. Fix AppContext.tsx
with open('src/context/AppContext.tsx', 'r') as f:
    app_content = f.read()

fallback = r"""    const guestId = localStorage\.getItem\('entong_guest_room_id'\) \|\| `guest_$\{Date\.now\(\)\}`;
    const fallbackGuest = \{
      id: guestId,
      name: `Guest_$\{guestId\.slice\(-6\)\}`,
      phone: '00000000000',
      username: `guest_$\{guestId\.slice\(-6\)\}`,
      role: 'CUSTOMER' as const,
      isGuest: true
    \};
    setCurrentUser\(fallbackGuest\);"""

app_content = re.sub(fallback, "    setCurrentUser(null);", app_content)

with open('src/context/AppContext.tsx', 'w') as f:
    f.write(app_content)

