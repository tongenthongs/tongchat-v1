import re

with open('src/components/auth/AuthModal.tsx', 'r') as f:
    content = f.read()

# Make sure we redirect staff to admin portal on successful login by removing strict path restrictions or forcing reload
content = re.sub(
    r'if \(userData\) \{\n        localStorage.setItem\("entong_active_user", JSON.stringify\(userData\)\);\n        if \(typeof setCurrentUser === "function"\) setCurrentUser\(userData as UserProfile\);\n      \}',
    '''if (userData) {
        localStorage.setItem("entong_active_user", JSON.stringify(userData));
        if (typeof setCurrentUser === "function") setCurrentUser(userData as UserProfile);
        
        // Cek Role dan Redirect
        const isStaff = userData.isStaff === true || 
                       ['STAFF', 'ADMIN', 'OWNER', 'WORKER', 'OPERATOR'].includes((userData.role || '').toString().toUpperCase());
        if (isStaff) {
            window.location.href = '/';
        }
      }''',
    content
)

with open('src/components/auth/AuthModal.tsx', 'w') as f:
    f.write(content)
