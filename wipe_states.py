import re

with open('src/components/customer/CustomerChat.tsx', 'r') as f:
    content = f.read()

# Replace all those states and the useEffect with empty string
to_remove = r"""  // --- GUEST CHAT FORM STATES & PERSISTENCE ---
  const \[guestName, setGuestName\] = useState\(''\);
  const \[guestRoblox, setGuestRoblox\] = useState\(''\);
  const \[guestPhone, setGuestPhone\] = useState\(''\);
  const \[guestFormError, setGuestFormError\] = useState\(''\);
  const \[isSubmittingGuest, setIsSubmittingGuest\] = useState\(false\);

  // Roblox Checker States
  const \[robloxAvatarUrl, setRobloxAvatarUrl\] = useState<string \| null>\(null\);
  const \[isCheckingRoblox, setIsCheckingRoblox\] = useState\(false\);
  const \[isRobloxValid, setIsRobloxValid\] = useState<boolean \| null>\(null\);

  // 800ms Debounce Roblox Profile Checker
  useEffect\(\(\) => \{
    const cleanUser = guestRoblox\.trim\(\)\.replace\(\/\^@\/, ''\);
    if \(\!cleanUser \|\| cleanUser\.length < 3\) \{
      setRobloxAvatarUrl\(null\);
      setIsRobloxValid\(null\);
      setIsCheckingRoblox\(false\);
      return;
    \}

    setIsCheckingRoblox\(true\);
    const timer = setTimeout\(async \(\) => \{
      try \{
        const profile = await fetchRobloxProfile\(cleanUser\);
        if \(profile && profile\.avatarUrl\) \{
          setRobloxAvatarUrl\(profile\.avatarUrl\);
          setIsRobloxValid\(true\);
        \} else \{
          setRobloxAvatarUrl\(null\);
          setIsRobloxValid\(false\);
        \}
      \} catch \(err\) \{
        setRobloxAvatarUrl\(null\);
        setIsRobloxValid\(false\);
      \} finally \{
        setIsCheckingRoblox\(false\);
      \}
    \}, 800\);

    return \(\) => clearTimeout\(timer\);
  \}, \[guestRoblox\]\);"""

content = re.sub(to_remove, '', content, flags=re.DOTALL)

with open('src/components/customer/CustomerChat.tsx', 'w') as f:
    f.write(content)

