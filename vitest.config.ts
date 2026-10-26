import {defineConfig} from 'vitest/config';

// Release archives and browser verification copies can contain source tests.
// Run only the live project's suites, so copies cannot inflate the result.
export default defineConfig({test:{include:['src/**/*.test.ts','server/**/*.test.ts']}});
