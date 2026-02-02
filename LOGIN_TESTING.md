# HealthSync Login System - Testing Guide

## Overview
This document provides a comprehensive guide for testing the enhanced authentication system for HealthSync.

## Prerequisites

1. **Backend Setup:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   npm install
   ```

2. **Frontend Setup:**
   ```bash
   cd react
   # .env file already created for local development
   npm install
   ```

3. **Environment Variables:**
   - Backend (`.env`):
     - `JWT_SECRET` (required)
     - `MONGODB_URI` (optional, uses memory if not set)
     - `PORT` (optional, defaults to 4000)
   - Frontend (`.env`):
     - `VITE_API_URL=http://localhost:4000` (for local dev)

## Testing Checklist

### ✅ 1. Backend Startup

**Test:** Start the backend server
```bash
cd backend
npm run dev
```

**Expected Results:**
- [ ] Server starts on port 4000 (or specified PORT)
- [ ] Environment validation passes
- [ ] JWT_SECRET is validated
- [ ] MongoDB connection established (or fallback warning shown)
- [ ] CORS configuration loaded
- [ ] Log message: "HealthSync backend listening on port 4000"

**Debug Commands:**
```bash
# Check if port is in use
lsof -i :4000

# Test health endpoint
curl http://localhost:4000/health
```

---

### ✅ 2. Frontend Startup

**Test:** Start the frontend development server
```bash
cd react
npm run dev
```

**Expected Results:**
- [ ] Vite dev server starts (usually on port 5173)
- [ ] No TypeScript errors in auth.tsx
- [ ] Environment variable VITE_API_URL is loaded
- [ ] Browser console shows no auth-related errors

**Debug Commands:**
```bash
# Check environment variables
grep VITE_API_URL .env

# Check TypeScript compilation (in another terminal)
npm run build
```

---

### ✅ 3. Signup Flow Testing

**Test Steps:**
1. Navigate to http://localhost:5173/signup
2. Fill in all required fields:
   - **For Doctor:**
     - Full name: Dr. Test User
     - Email: test@example.com
     - Password: Test@1234 (must meet requirements)
     - Confirm: Test@1234
     - Organization: Select from dropdown
   - **For Organization:**
     - Organization name: Test Hospital
     - Admin name: Admin User
     - Email: admin@example.com
     - Password: Test@1234
     - Confirm: Test@1234

3. Click "Create account"

**Expected Results:**
- [ ] Form validation works (shows errors for empty/invalid fields)
- [ ] Password strength indicator works
- [ ] Organizations load from backend (no dropdown errors)
- [ ] Loading spinner appears during submit
- [ ] Request completes in < 5 seconds
- [ ] Success: User created and redirected to /dashboard
- [ ] Token stored in localStorage (key: hs_token)
- [ ] No console errors during the process

**Debug & Verify:**
```javascript
// In browser console:
// 1. Check localStorage
localStorage.getItem('hs_token')

// 2. Check network requests
// Open DevTools > Network, filter for /api/auth/signup
// Should see: 201 Created

// 3. Check user data
const authData = JSON.parse(localStorage.getItem('hs_auth') || '{}')
console.log('User:', authData.user)
```

**Error Scenarios to Test:**
- [ ] Try with existing email → Should show "already exists" error
- [ ] Try with mismatched passwords → Should show validation error
- [ ] Try with weak password → Should show password requirements
- [ ] Try with invalid email → Should show email validation error
- [ ] Leave required fields empty → Should show field-specific errors

---

### ✅ 4. Login Flow Testing

**Test Steps:**
1. Navigate to http://localhost:5173/login (or logout first)
2. Enter credentials:
   - Email: test@example.com
   - Password: Test@1234
3. Click "Login"

**Expected Results:**
- [ ] Form accepts credentials
- [ ] "Remember me" checkbox works
- [ ] Loading state shows during login
- [ ] Login completes in < 5 seconds
- [ ] Success: Redirected to /dashboard
- [ ] User data fetched and stored
- [ ] Token in localStorage or sessionStorage (based on "Remember me")
- [ ] No console errors

**Debug & Verify:**
```javascript
// In browser console:
// 1. Check auth context
const authContext = document.querySelector('[data-auth]') || 'Check React DevTools'

// 2. Check user data is loaded
// Navigate to dashboard and check:
window.location.pathname === '/dashboard'

// 3. Check network tab for:
// - POST /api/auth/login → 200 OK
// - GET /api/auth/me → 200 OK
```

**Error Scenarios to Test:**
- [ ] Wrong password → Should show "Invalid credentials" error
- [ ] Wrong email → Should show "Invalid credentials" error (generic message for security)
- [ ] Empty fields → Should show validation errors
- [ ] Try with server offline → Should show network error message

---

### ✅ 5. Session Persistence Testing

**Test Steps:**
1. Login with "Remember me" checked
2. Check token in localStorage
3. Refresh the page
4. Check token still present
5. Navigate to dashboard directly: http://localhost:5173/dashboard

**Expected Results:**
- [ ] Token persists after page refresh
- [ ] User stays logged in after refresh
- [ ] Direct navigation to /dashboard works
- [ ] No duplicate /me requests
- [ ] Token is sent with subsequent API calls

**Debug & Verify:**
```javascript
// Check token storage
localStorage.getItem('hs_token') // Should exist
sessionStorage.getItem('hs_token') // Should be null (remember me checked)

// With "Remember me" unchecked, sessionStorage should be used
```

---

### ✅ 6. Logout Flow Testing

**Test Steps:**
1. Login successfully
2. Navigate to dashboard
3. Click logout button/link

**Expected Results:**
- [ ] Token cleared from storage
- [ ] User state reset in context
- [ ] Redirected to /login
- [ ] Cannot navigate back to dashboard without login
- [ ] No console errors

**Debug & Verify:**
```javascript
// After logout:
localStorage.getItem('hs_token') // Should be null
console.log(authContext.user) // Should be null in React DevTools
```

---

### ✅ 7. API Request Testing

**Test authenticated endpoints:**

1. **Organizations List:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/organizations
```
Expected: 200 OK with organizations array

2. **Get Current User:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/auth/me
```
Expected: 200 OK with user object

3. **Without Token:**
```bash
curl http://localhost:4000/api/auth/me
```
Expected: 401 Unauthorized

4. **With Invalid Token:**
```bash
curl -H "Authorization: Bearer invalid-token" \
  http://localhost:5173/api/auth/me
```
Expected: 401 Unauthorized

---

### ✅ 8. CORS Testing

**Test from different origins:**

```javascript
// In browser console on a different origin (e.g., example.com):
fetch('http://localhost:4000/api/health')
  .then(r => r.json())
  .then(console.log)
```

Expected:
- [ ] Requests from localhost:5173 succeed
- [ ] Requests from localhost:3000 succeed
- [ ] Requests from healthsync-react.vercel.app succeed
- [ ] Requests from other origins fail with CORS error

---

### ✅ 9. Error Recovery Testing

**Test retry logic:**

1. **Network Interruption:**
   - Start signup/login
   - Temporarily disable network
   - Re-enable network

   Expected: System retries and completes successfully

2. **Server Restart:**
   - Login to frontend
   - Restart backend server
   - Try to fetch organizations

   Expected: Frontend recovers and fetches data after server comes back

3. **Timeout Handling:**
   - Simulate slow network (DevTools > Network > Throttling)
   - Try login

   Expected: Appropriate timeout error message shown

---

### ✅ 10. Performance Testing

**Measure response times:**

1. **Cold Start Test:**
   - Restart backend
   - Time first login request
   Expected: < 5 seconds (including Render wake-up)

2. **Warm Request Test:**
   - Perform second login after first completes
   Expected: < 2 seconds

3. **Concurrent Requests:**
   - Try multiple simultaneous logins
   Expected: All complete successfully, no race conditions

---

### ✅ 11. Security Testing

**Verify security measures:**

1. **Password Storage:**
   Check MongoDB/in-memory:
   - Passwords are hashed (not plain text)
   - Use bcrypt with salt

2. **Token Security:**
   - JWT signed with secret
   - Token stored in httpOnly storage (localStorage/sessionStorage is fine for SPA)
   - Token sent via Authorization header

3. **Input Validation:**
   - Try SQL injection in email field: `test' OR '1'='1`
   - Try XSS in name field: `<script>alert('xss')</script>`
   Expected: Both are sanitized/escaped

4. **Rate Limiting:**
   - Try 10+ rapid failed logins
   Expected: Should be rate limited (if implemented)

---

## Automated Testing Commands

### Run Backend Tests
```bash
cd backend
npm test
```

### Run Frontend Tests
```bash
cd react
npm test
```

### Build and Type Check
```bash
# Frontend
cd react
npm run build
npm run type-check

# Backend
cd backend
npm run lint
```

---

## Troubleshooting Guide

### Problem: CORS errors in browser console
**Solution:**
- Check backend logs for CORS warnings
- Verify FRONTEND_URL environment variable
- Ensure origin is in CORS whitelist
- Check that backend is running

### Problem: "Invalid server response" error
**Solution:**
- Check backend is running: `curl http://localhost:4000/health`
- Verify VITE_API_URL points to correct backend URL
- Check network tab for detailed error
- Ensure JSON is being returned, not HTML

### Problem: Token not stored after login
**Solution:**
- Check browser privacy settings (third-party cookies)
- Verify localStorage is not disabled in browser
- Check for "QuotaExceededError" in console (storage full)

### Problem: "Login failed" with no details
**Solution:**
- Check backend logs (should have detailed errors)
- Verify JWT_SECRET is set correctly
- Check MongoDB connection (or in-memory fallback messages)
- Look for error logs in browser console

### Problem: Organizations not loading in dropdown
**Solution:**
- Check backend /api/organizations endpoint directly
- Verify database has organizations documents
- Check network tab for failed requests
- Look for CORS errors

### Problem: Very slow response times (>5s)
**Solution:**
- Check if using Render free tier (cold starts expected)
- First request after deploy will be slow
- Subsequent requests should be fast
- Check for network issues

---

## Success Criteria Verification

- [ ] Frontend successfully connects to backend without CORS errors
- [ ] Login returns correct user data and JWT token
- [ ] Signup creates new user and logs in automatically
- [ ] Token is stored and sent with all authenticated requests
- [ ] Logout clears token and user session
- [ ] All error cases show user-friendly error messages
- [ ] No console errors or warnings during normal flow
- [ ] API responds within reasonable time (< 5 seconds)
- [ ] Network requests show correct headers and payloads
- [ ] User can navigate to protected pages after login

---

## Continuous Integration

For automated testing in CI/CD:

```bash
# Backend CI test script
cd backend
npm install
npm run test
npm run lint

# Frontend CI test script
cd react
npm install
npm run build
npm run test
```

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/auth/login | Login user | No |
| POST | /api/auth/signup | Register user | No |
| GET | /api/auth/me | Get current user | Yes |
| PUT | /api/auth/me | Update profile | Yes |
| POST | /api/auth/logout | Logout | Yes |
| POST | /api/auth/google | Google OAuth | No |
| POST | /api/auth/forgot-password | Request reset OTP | No |
| POST | /api/auth/reset-password | Reset with OTP | No |

### Response Formats

**Success:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "role": "doctor",
    "profile": {}
  }
}
```

**Error:**
```json
{
  "error": "User-friendly error message",
  "debug": { "message": "...", "stack": "..." } // Only in development
}
```

---

## Support

If you encounter issues not covered in this guide:

1. Check browser console for frontend errors
2. Check backend terminal for server errors
3. Review network tab for failed requests
4. Verify all environment variables are set
5. Ensure ports are not blocked by firewall
6. Check that MongoDB is running (if using local)

For additional help, enable debug logging:

```bash
# Backend
DEBUG=* npm run dev

# Frontend
# Open browser console and look for [Auth] and [Signup] logs
```
