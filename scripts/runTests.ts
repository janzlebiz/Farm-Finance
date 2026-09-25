import { runAllIntegrationTests } from '../src/tests/authoritativeTests';

async function main() {
  console.log('====================================================');
  console.log('  RUNNING AUTHORITATIVE INTEGRATION & BACKUP TESTS  ');
  console.log('====================================================\n');

  const report = await runAllIntegrationTests();

  for (const r of report.results) {
    const icon = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [${r.suite}] ${r.name} (${r.durationMs}ms)`);
    if (!r.passed) {
      console.error(`      Error: ${r.error}`);
    }
  }

  console.log('\n----------------------------------------------------');
  console.log(`TOTAL: ${report.total} | PASSED: ${report.passed} | FAILED: ${report.failed}`);
  console.log('----------------------------------------------------');

  if (report.failed > 0) {
    process.exit(1);
  } else {
    console.log('\nALL INTEGRATION AND LIFECYCLE TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
