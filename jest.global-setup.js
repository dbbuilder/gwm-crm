module.exports = async () => {
  // Global setup for tests
  console.log('Setting up Jest test environment...')
  
  // Set timezone to UTC for consistent test results
  process.env.TZ = 'UTC'
  
  // Mock external services for testing
  process.env.SKIP_ENV_VALIDATION = 'true'
  
  // Any other global setup can go here
}