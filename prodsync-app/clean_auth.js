const fs = require('fs')
let content = fs.readFileSync('src/modules/auth/views/AuthPage.tsx', 'utf8')

// Remove signup steps
content = content.replace(/signupStep === 'department' \? \([\s\S]*?\) : signupStep === 'role' \? \([\s\S]*?\) : signupStep === 'permissions' \? \([\s\S]*?\) : \(/, '(')

// Remove functions at the bottom
content = content.replace(/function ChecklistItem[\s\S]*?\}$/, '')

fs.writeFileSync('src/modules/auth/views/AuthPage.tsx', content)
