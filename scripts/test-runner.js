#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 ChefsPlan MVP Test Suite');
console.log('===========================\n');

// Test configuration
const testConfig = {
  timeout: 60000,
  gasReporter: true,
  coverage: false
};

// Parse command line arguments
const args = process.argv.slice(2);
if (args.includes('--coverage')) {
  testConfig.coverage = true;
}
if (args.includes('--quick')) {
  testConfig.timeout = 30000;
  testConfig.gasReporter = false;
}

// Test suites to run
const testSuites = [
  {
    name: 'Contract Deployment',
    file: 'test/deployment.test.js',
    description: 'Tests contract deployment and initialization'
  },
  {
    name: 'Reputation Contract',
    file: 'test/Reputation.test.js',
    description: 'Tests reputation system functionality'
  },
  {
    name: 'Escrow Contract',
    file: 'test/Escrow.test.js',
    description: 'Tests escrow payment system'
  },
  {
    name: 'ShiftManager Contract',
    file: 'test/ShiftManager.test.js',
    description: 'Tests core shift management functionality'
  },
  {
    name: 'Full Integration',
    file: 'test/integration/full-workflow.test.js',
    description: 'Tests complete user workflows and system integration'
  }
];

// Results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  suites: []
};

console.log('Configuration:');
console.log(`- Timeout: ${testConfig.timeout}ms`);
console.log(`- Gas Reporter: ${testConfig.gasReporter}`);
console.log(`- Coverage: ${testConfig.coverage}`);
console.log('');

async function runTestSuite(suite) {
  console.log(`\n📋 Running: ${suite.name}`);
  console.log(`   ${suite.description}`);
  console.log(`   File: ${suite.file}`);
  
  try {
    const env = {
      ...process.env,
      REPORT_GAS: testConfig.gasReporter ? 'true' : 'false'
    };

    let command;
    if (testConfig.coverage) {
      command = `npx hardhat coverage --testfiles "${suite.file}"`;
    } else {
      command = `npx hardhat test "${suite.file}" --timeout ${testConfig.timeout}`;
    }

    const output = execSync(command, { 
      encoding: 'utf8',
      env: env,
      stdio: 'pipe'
    });

    // Parse test results from output
    const passingMatch = output.match(/(\d+) passing/);
    const failingMatch = output.match(/(\d+) failing/);
    
    const passing = passingMatch ? parseInt(passingMatch[1]) : 0;
    const failing = failingMatch ? parseInt(failingMatch[1]) : 0;

    results.total += passing + failing;
    results.passed += passing;
    results.failed += failing;

    const suiteResult = {
      name: suite.name,
      passing: passing,
      failing: failing,
      status: failing === 0 ? 'PASSED' : 'FAILED'
    };

    results.suites.push(suiteResult);

    console.log(`   ✅ ${suiteResult.status}: ${passing} passing, ${failing} failing`);

    // Show gas usage if available
    const gasMatch = output.match(/gas used:\s*(\d+)/g);
    if (gasMatch && testConfig.gasReporter) {
      console.log(`   ⛽ Gas usage data collected`);
    }

    return { success: failing === 0, output };

  } catch (error) {
    console.log(`   ❌ FAILED: Test suite execution failed`);
    console.log(`   Error: ${error.message}`);
    
    results.suites.push({
      name: suite.name,
      passing: 0,
      failing: 1,
      status: 'ERROR'
    });
    
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('Starting test execution...\n');
  
  const startTime = Date.now();
  
  for (const suite of testSuites) {
    await runTestSuite(suite);
  }

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\nOverall Results:`);
  console.log(`- Total Tests: ${results.total}`);
  console.log(`- Passed: ${results.passed}`);
  console.log(`- Failed: ${results.failed}`);
  console.log(`- Success Rate: ${results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0}%`);
  console.log(`- Duration: ${duration.toFixed(2)}s`);

  console.log(`\nSuite Breakdown:`);
  results.suites.forEach(suite => {
    const icon = suite.status === 'PASSED' ? '✅' : 
                 suite.status === 'FAILED' ? '❌' : '⚠️';
    console.log(`${icon} ${suite.name}: ${suite.passing}/${suite.passing + suite.failing}`);
  });

  // Save results to file
  const reportData = {
    timestamp: new Date().toISOString(),
    config: testConfig,
    results: results,
    duration: duration
  };

  fs.writeFileSync('./test-results.json', JSON.stringify(reportData, null, 2));
  console.log(`\n📄 Detailed results saved to test-results.json`);

  // Generate coverage report if requested
  if (testConfig.coverage) {
    console.log(`\n📈 Coverage report generated in coverage/ directory`);
  }

  // Exit with appropriate code
  const allPassed = results.failed === 0 && results.suites.every(s => s.status !== 'ERROR');
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! MVP is ready for deployment.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review and fix issues before deployment.');
  }

  process.exit(allPassed ? 0 : 1);
}

// Handle interruption gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test execution interrupted by user');
  process.exit(130);
});

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: npm run test:all [options]');
  console.log('');
  console.log('Options:');
  console.log('  --coverage    Generate code coverage report');
  console.log('  --quick       Run tests with reduced timeout and no gas reporting');
  console.log('  --help, -h    Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  npm run test:all');
  console.log('  npm run test:all -- --coverage');
  console.log('  npm run test:all -- --quick');
  process.exit(0);
}

// Run the tests
runAllTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});