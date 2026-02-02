#!/usr/bin/env node

/**
 * HealthSync Authentication System Test Script
 * This script verifies that the backend and frontend are configured correctly
 */

const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

console.log('🚀 HealthSync Auth System Test\n')

// Test configuration
const config = {
  backendUrl: process.env.API_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  timeout: 5000
}

// Helper to make HTTP requests
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const isHttps = options.protocol === 'https:'
    const client = isHttps ? https : http
    
    const req = client.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        })
      })
    })
    
    req.on('error', reject)
    req.setTimeout(config.timeout, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
    
    if (postData) {
      req.write(postData)
    }
    
    req.end()
  })
}

// Test runner
async function runTests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  }
  
  function test(name, fn) {
    return async () => {
      try {
        console.log(`\n📋 Testing: ${name}`)
        await fn()
        console.log(`   ✅ PASS`)
        results.passed++
        results.tests.push({ name, status: 'pass' })
      } catch (error) {
        console.log(`   ❌ FAIL: ${error.message}`)
        results.failed++
        results.tests.push({ name, status: 'fail', error: error.message })
      }
    }
  }
  
  // Test 1: Backend Health Check
  await test('Backend health endpoint', async () => {
    const response = await makeRequest({
      hostname: new URL(config.backendUrl).hostname,
      port: new URL(config.backendUrl).port || 80,
      path: '/health',
      method: 'GET',
      protocol: new URL(config.backendUrl).protocol
    })
    
    if (response.statusCode !== 200) {
      throw new Error(`Expected 200, got ${response.statusCode}`)
    }
    
    const data = JSON.parse(response.body)
    if (!data.ok || data.status !== 'healthy') {
      throw new Error('Health check failed')
    }
    
    console.log('   ✓ Backend is healthy')
  })()
  
  // Test 2: Backend CORS Headers
  await test('Backend CORS configuration', async () => {
    const response = await makeRequest({
      hostname: new URL(config.backendUrl).hostname,
      port: new URL(config.backendUrl).port || 80,
      path: '/health',
      method: 'GET',
      protocol: new URL(config.backendUrl).protocol
    })
    
    const corsHeader = response.headers['access-control-allow-origin']
    console.log('   ℹ CORS Header:', corsHeader || 'not set (may be using dynamic CORS)')
  })()
  
  // Test 3: Environment Files
  await test('Frontend environment configuration', async () => {
    const envPath = path.join(__dirname, 'react', '.env')
    const envProdPath = path.join(__dirname, 'react', '.env.production')
    
    if (!fs.existsSync(envPath)) {
      throw new Error('.env file not found in react/ directory')
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8')
    if (!envContent.includes('VITE_API_URL')) {
      throw new Error('VITE_API_URL not found in .env file')
    }
    
    console.log('   ✓ .env file exists and contains VITE_API_URL')
    
    if (!fs.existsSync(envProdPath)) {
      console.log('   ⚠ .env.production not found (optional for production)')
    }
  })()
  
  // Test 4: TypeScript Configuration
  await test('TypeScript environment types', async () => {
    const viteEnvPath = path.join(__dirname, 'react', 'vite-env.d.ts')
    
    if (!fs.existsSync(viteEnvPath)) {
      throw new Error('vite-env.d.ts not found')
    }
    
    const envContent = fs.readFileSync(viteEnvPath, 'utf8')
    if (!envContent.includes('ImportMetaEnv')) {
      throw new Error('ImportMetaEnv type not defined')
    }
    
    console.log('   ✓ vite-env.d.ts properly configured')
  })()
  
  // Test 5: Auth Route Files
  await test('Backend auth routes', async () => {
    const authPath = path.join(__dirname, 'backend', 'routes', 'auth.js')
    
    if (!fs.existsSync(authPath)) {
      throw new Error('auth.js routes file not found')
    }
    
    const authContent = fs.readFileSync(authPath, 'utf8')
    
    if (!authContent.includes('router.post(\'/login\'')) {
      throw new Error('Login route not found')
    }
    
    if (!authContent.includes('router.post(\'/signup\'')) {
      throw new Error('Signup route not found')
    }
    
    if (!authContent.includes('router.get(\'/me\'')) {
      throw new Error('Me route not found')
    }
    
    console.log('   ✓ All auth routes defined')
  })()
  
  // Test 6: Frontend Auth Context
  await test('Frontend auth context', async () => {
    const authPath = path.join(__dirname, 'react', 'src', 'lib', 'auth.tsx')
    
    if (!fs.existsSync(authPath)) {
      throw new Error('auth.tsx not found')
    }
    
    const authContent = fs.readFileSync(authPath, 'utf8')
    
    if (!authContent.includes('import.meta.env.VITE_API_URL')) {
      throw new Error('Not using VITE_API_URL environment variable')
    }
    
    if (!authContent.includes('fetchWithRetry')) {
      console.log('   ℹ fetchWithRetry not found (enhanced version may not be present)')
    } else {
      console.log('   ✓ Enhanced fetch with retry logic detected')
    }
    
    if (!authContent.includes('console.debug')) {
      console.log('   ℹ Debug logging not found (optional)')
    } else {
      console.log('   ✓ Debug logging present')
    }
    
    console.log('   ✓ Auth context properly configured')
  })()
  
  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 Test Results:')
  console.log(`   ✅ Passed: ${results.passed}`)
  console.log(`   ❌ Failed: ${results.failed}`)
  console.log('='.repeat(50))
  
  if (results.failed > 0) {
    console.log('\nFailed tests:')
    results.tests
      .filter(t => t.status === 'fail')
      .forEach(t => console.log(`   - ${t.name}: ${t.error}`))
    
    process.exit(1)
  } else {
    console.log('\n🎉 All tests passed! Auth system is ready.')
    console.log('\nNext steps:')
    console.log('1. Start backend: cd backend && npm run dev')
    console.log('2. Start frontend: cd react && npm run dev')
    console.log('3. Open http://localhost:5173 and test the login flow')
    console.log('4. See LOGIN_TESTING.md for comprehensive testing guide')
    process.exit(0)
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n🚨 Fatal error running tests:', error.message)
  process.exit(1)
})
