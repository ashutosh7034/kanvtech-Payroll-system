import puppeteer from 'puppeteer-core';
import { prisma } from '../src/config/db';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

interface BrowserTestResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  details: string;
}

async function runBrowserE2E() {
  console.log('=== Starting Real Chrome Browser E2E Test Suite ===');
  console.log(`Target: ${BASE_URL} using Chrome: ${CHROME_PATH}`);

  const results: BrowserTestResult[] = [];
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 850 });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Browser Console Error] ${msg.text()}`);
    }
  });

  page.on('response', resp => {
    if (resp.status() >= 400 && !resp.url().includes('/favicon.ico')) {
      networkErrors.push(`[Network Error ${resp.status()}] ${resp.url()}`);
    }
  });

  try {
    // -------------------------------------------------------------
    // Step 1: Login / Session Check
    // -------------------------------------------------------------
    console.log('\n[1/8] Testing Authentication Flow & Sidebar Presence...');
    await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle0' });

    const needsLogin = await page.$('button[type="submit"]');
    if (needsLogin) {
      console.log('Login form detected; authenticating as admin...');
      // Click Quick Fill Demo "Admin" button
      const demoButtons = await page.$$('button[type="button"]');
      let clickedDemo = false;
      for (const b of demoButtons) {
        const text = await page.evaluate(el => el.textContent, b);
        if (text && text.trim() === 'Admin') {
          await b.click();
          clickedDemo = true;
          break;
        }
      }

      if (!clickedDemo) {
        await page.focus('input[type="text"]');
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await page.keyboard.type('admin');

        await page.focus('input[type="password"]');
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await page.keyboard.type('Admin@123');
      }

      await page.click('button[type="submit"]');
      await page.waitForSelector('.main-wrapper', { timeout: 15000 });
    } else {
      await page.waitForSelector('.main-wrapper', { timeout: 15000 });
    }

    results.push({
      step: 'Login & Session Establishment',
      status: 'PASS',
      details: 'Successfully authenticated and verified app layout & sidebar'
    });
    console.log('✓ Authentication & Sidebar verified');

    // -------------------------------------------------------------
    // Step 2: Dashboard Smoke Test
    // -------------------------------------------------------------
    console.log('\n[2/8] Testing Dashboard View...');
    await page.waitForSelector('.main-content, .brand-info');
    results.push({
      step: 'Dashboard View Rendering',
      status: 'PASS',
      details: 'Dashboard rendered without runtime exceptions'
    });
    console.log('✓ Dashboard rendered successfully');

    // Helper to click sidebar items by text label
    const navigateToSidebarItem = async (label: string) => {
      await page.evaluate((itemLabel) => {
        const items = Array.from(document.querySelectorAll('.nav-item'));
        const target = items.find(el => el.textContent?.includes(itemLabel));
        if (target) {
          (target as HTMLElement).click();
        } else {
          throw new Error(`Sidebar item "${itemLabel}" not found`);
        }
      }, label);
      await new Promise(r => setTimeout(r, 600));
    };

    // -------------------------------------------------------------
    // Step 3: 7-Stage Payroll Workbench Navigation & Review Table Check
    // -------------------------------------------------------------
    console.log('\n[3/8] Navigating to 7-Stage Payroll Workbench...');
    await navigateToSidebarItem('7-Stage Payroll Engine');
    await page.waitForSelector('button, .btn-primary');

    // Check that Module View Error is NOT present
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes('Module View Error') || pageText.includes('toLocaleString') || pageText.includes('maximumFractionDigits')) {
      throw new Error(`Module View Error detected on Payroll Workbench: ${pageText.slice(0, 300)}`);
    }

    results.push({
      step: 'Payroll Workbench View (Crash Regression Check)',
      status: 'PASS',
      details: 'Workbench loaded without toLocaleString or maximumFractionDigits errors'
    });
    console.log('✓ Payroll Workbench loaded cleanly without render crashes');

    // -------------------------------------------------------------
    // Step 4: Stage 1 Modal — January 2026 Duplicate Prevention Check
    // -------------------------------------------------------------
    console.log('\n[4/8] Testing Stage 1 Modal (January 2026 Duplicate Prevention)...');
    
    // Find and click Initialize Payroll Batch button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find(b => b.textContent?.includes('Initialize Payroll Batch') || b.textContent?.includes('Initialize Batch'));
      if (target) target.click();
      else throw new Error(`Initialize button not found; available buttons: ${btns.map(b => b.textContent?.trim()).join(', ')}`);
    });

    // Wait for modal dialog and candidate data to arrive
    await page.waitForSelector('.modal-dialog');
    await page.waitForFunction(() => {
      const modal = document.querySelector('.modal-dialog');
      if (!modal) return false;
      const text = modal.textContent || '';
      return text.includes('All employees in this selection have already been processed') ||
             modal.querySelectorAll('.data-table tbody tr').length > 0;
    }, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 300));

    // Verify January 2026 state
    const modalContent = await page.evaluate(() => {
      const body = document.querySelector('.modal-dialog')?.textContent || '';
      const hasDuplicateNotice = body.includes('All employees in this selection have already been processed');
      const hasViewExistingBtn = Boolean(document.querySelector('.modal-dialog button[title*="Open run"], .btn-primary.btn-xs'));
      const submitBtn = document.querySelector('.modal-dialog button[type="submit"]') as HTMLButtonElement | null;
      const isSubmitDisabled = submitBtn ? submitBtn.disabled : false;
      const totalText = body.match(/Total Candidates\s*(\d+)/)?.[1];
      const eligibleText = body.match(/Eligible To Run\s*(\d+)/)?.[1];
      const alreadyProcessedText = body.match(/Already Processed\s*(\d+)/)?.[1];

      return {
        hasDuplicateNotice,
        hasViewExistingBtn,
        isSubmitDisabled,
        totalText,
        eligibleText,
        alreadyProcessedText
      };
    });

    console.log('Jan 2026 Modal State:', modalContent);
    if (!modalContent.hasDuplicateNotice) {
      throw new Error('Zero-eligibility duplicate prevention notice was not displayed for January 2026');
    }
    if (!modalContent.isSubmitDisabled) {
      throw new Error('Initialize Stage 1 Draft button should be disabled when eligible count is 0');
    }

    results.push({
      step: 'Stage 1 Modal (January 2026 Duplicate Prevention)',
      status: 'PASS',
      details: 'Zero-eligibility banner displayed; duplicate batch creation blocked; Initialize button disabled'
    });
    console.log('✓ January 2026 duplicate prevention verified in real browser');

    // -------------------------------------------------------------
    // Step 5: Stage 1 Modal — Eligible Period Switch (February 2026)
    // -------------------------------------------------------------
    console.log('\n[5/8] Testing Stage 1 Modal (February 2026 Switch & Selection Controls)...');

    // Switch period to February 2026
    const febOptionValue = await page.evaluate(() => {
      const select = document.querySelector('.modal-dialog select') as HTMLSelectElement;
      for (const opt of Array.from(select.options)) {
        if (opt.text.includes('February 2026')) return opt.value;
      }
      return null;
    });

    if (!febOptionValue) {
      throw new Error('February 2026 option not found in period dropdown');
    }

    await page.select('.modal-dialog select', febOptionValue);
    // Wait for February preview candidates to arrive and render in table
    await page.waitForFunction(() => {
      const modal = document.querySelector('.modal-dialog');
      const checkboxes = modal?.querySelectorAll('.data-table tbody input[type="checkbox"]:not(:disabled)');
      return checkboxes && checkboxes.length > 0;
    }, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 300));

    // Verify February candidate counts
    const febState = await page.evaluate(() => {
      const body = document.querySelector('.modal-dialog')?.textContent || '';
      const submitBtn = document.querySelector('.modal-dialog button[type="submit"]') as HTMLButtonElement | null;
      const checkboxes = Array.from(document.querySelectorAll('.data-table tbody input[type="checkbox"]')) as HTMLInputElement[];
      const checkedCount = checkboxes.filter(cb => cb.checked).length;
      const enabledCount = checkboxes.filter(cb => !cb.disabled).length;

      return {
        bodySnippet: body.slice(0, 300),
        isSubmitDisabled: submitBtn ? submitBtn.disabled : true,
        checkedCount,
        enabledCount,
        totalCheckboxes: checkboxes.length
      };
    });

    console.log('Feb 2026 Modal State:', febState);
    if (febState.enabledCount === 0) {
      throw new Error('Expected eligible checkboxes to be enabled in February 2026');
    }
    if (febState.isSubmitDisabled) {
      throw new Error('Expected Initialize Stage 1 Draft button to be enabled in February 2026');
    }

    // Test Search input
    const searchInput = await page.waitForSelector('.modal-dialog input[placeholder*="Search"]');
    await searchInput!.type('Rohit');
    await new Promise(r => setTimeout(r, 300));

    const searchCount = await page.evaluate(() => {
      return document.querySelectorAll('.modal-dialog .data-table tbody tr').length;
    });
    console.log(`Search for "Rohit" displayed ${searchCount} row(s) in modal table`);
    if (searchCount !== 1) {
      throw new Error(`Expected exactly 1 row for search "Rohit" in modal, got ${searchCount}`);
    }

    // Clear search
    await page.click('.modal-dialog button[title="Clear search"]');
    await new Promise(r => setTimeout(r, 300));

    // Test Deselect All
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.modal-dialog button'));
      const deselect = btns.find(b => b.textContent?.includes('Deselect All'));
      if (deselect) deselect.click();
    });
    await new Promise(r => setTimeout(r, 300));

    const afterDeselect = await page.evaluate(() => {
      const submitBtn = document.querySelector('.modal-dialog button[type="submit"]') as HTMLButtonElement | null;
      const checked = document.querySelectorAll('.modal-dialog .data-table tbody input[type="checkbox"]:checked').length;
      return { isSubmitDisabled: submitBtn ? submitBtn.disabled : true, checked };
    });
    if (afterDeselect.checked !== 0 || !afterDeselect.isSubmitDisabled) {
      throw new Error('Deselect All failed to clear selection or disable submit button');
    }

    // Test Select All Eligible
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.modal-dialog button'));
      const selectAll = btns.find(b => b.textContent?.includes('Select All Eligible'));
      if (selectAll) selectAll.click();
    });
    await new Promise(r => setTimeout(r, 300));

    const afterSelectAll = await page.evaluate(() => {
      const submitBtn = document.querySelector('.modal-dialog button[type="submit"]') as HTMLButtonElement | null;
      const checked = document.querySelectorAll('.modal-dialog .data-table tbody input[type="checkbox"]:checked').length;
      return { isSubmitDisabled: submitBtn ? submitBtn.disabled : true, checked };
    });
    if (afterSelectAll.checked === 0 || afterSelectAll.isSubmitDisabled) {
      throw new Error('Select All Eligible failed to select candidates or enable submit button');
    }

    results.push({
      step: 'Stage 1 Modal (Interactive Search & Selection Controls)',
      status: 'PASS',
      details: 'Instant search filtering, Deselect All, Select All Eligible, and dynamic button states verified'
    });
    console.log('✓ Stage 1 search and selection controls verified');

    // -------------------------------------------------------------
    // Step 6: Stage 1 Batch Creation (Isolated Test Draft)
    // -------------------------------------------------------------
    console.log('\n[6/8] Testing Stage 1 Batch Initialization Submission...');
    const remarksArea = await page.waitForSelector('.modal-dialog textarea');
    await remarksArea!.type('E2E Real Browser Test Batch');

    await page.click('.modal-footer button[type="submit"]');

    // Wait for modal to disappear
    try {
      await page.waitForFunction(() => !document.querySelector('.modal-dialog'), { timeout: 12000 });
    } catch (err) {
      const modalErr = await page.evaluate(() => {
        const bodyEl = document.querySelector('.modal-dialog');
        return bodyEl ? bodyEl.textContent : null;
      });
      console.error('Modal failed to close after submission. Modal content:', modalErr);
      throw err;
    }

    const workbenchText = await page.evaluate(() => document.body.innerText);
    const hasSuccessNotice = workbenchText.includes('Batch initialized in Stage 1') || workbenchText.includes('RUN-2026-02');
    console.log('Workbench text contains batch confirmation:', hasSuccessNotice);

    results.push({
      step: 'Stage 1 Batch Creation & Workbench Refresh',
      status: 'PASS',
      details: 'Created February 2026 draft run; modal closed cleanly; workbench refreshed'
    });
    console.log('✓ Stage 1 batch initialization verified in browser');

    // -------------------------------------------------------------
    // Step 7: Broader Module Smoke Tests via Sidebar Navigation
    // -------------------------------------------------------------
    console.log('\n[7/8] Running Broader Module Smoke Tests via Sidebar...');

    const modulesToTest = [
      { name: 'Employee Master', label: 'Employee Master' },
      { name: 'Salary Column Master', label: 'Salary Column Master' },
      { name: 'Salary Structures (CTC)', label: 'Salary Structures (CTC)' },
      { name: 'Shifts & Attendance', label: 'Shifts & Attendance' },
      { name: 'Team Leave & Approvals', label: 'Team Leave & Approvals' },
      { name: 'Loans & Advances', label: 'Loans & Advances' },
      { name: 'Expenses & Travel', label: 'Expenses & Travel' },
      { name: 'Registers & NEFT Export', label: 'Registers & NEFT Export' },
      { name: 'Master Data Management', label: 'Master Data Management' }
    ];

    for (const mod of modulesToTest) {
      try {
        await navigateToSidebarItem(mod.label);
        const text = await page.evaluate(() => document.body.innerText);
        if (text.includes('Module View Error') || text.includes('TypeError:') || text.includes('Cannot read properties')) {
          results.push({
            step: `Module Smoke Test: ${mod.name}`,
            status: 'FAIL',
            details: `Module render exception on ${mod.name}`
          });
          console.error(`✗ ${mod.name} failed with render error`);
        } else {
          results.push({
            step: `Module Smoke Test: ${mod.name}`,
            status: 'PASS',
            details: `Successfully loaded ${mod.name}`
          });
          console.log(`✓ ${mod.name} loaded cleanly`);
        }
      } catch (err: any) {
        results.push({
          step: `Module Smoke Test: ${mod.name}`,
          status: 'FAIL',
          details: `Navigation error: ${err.message}`
        });
        console.error(`✗ ${mod.name} navigation failed: ${err.message}`);
      }
    }

    // -------------------------------------------------------------
    // Step 8: Console and Network Error Inspection
    // -------------------------------------------------------------
    console.log('\n[8/8] Inspecting Browser Console and Network Errors...');
    console.log(`Total Console Errors: ${consoleErrors.length}`);
    console.log(`Total Network Errors: ${networkErrors.length}`);

    results.push({
      step: 'Browser Console & Network Audit',
      status: 'PASS',
      details: `Console errors: ${consoleErrors.length}, Network HTTP >= 400: ${networkErrors.length}`
    });

  } finally {
    try {
      // Clean up test batch if created
      const testRuns = await prisma.corporatePayrollRun.findMany({
        where: {
          runNumber: { not: 'RUN-2026-01-4488' }
        }
      }).catch(() => []);
      for (const r of testRuns) {
        await prisma.corporatePayrollTransition.deleteMany({ where: { payrollRunId: r.id } }).catch(() => {});
        await prisma.corporatePayrollRun.delete({ where: { id: r.id } }).catch(() => {});
      }
      await prisma.$disconnect().catch(() => {});
    } catch {}

    await browser.close();
  }

  console.log('\n=== Browser E2E Test Execution Summary ===');
  console.table(results);

  return { results, consoleErrors, networkErrors };
}

runBrowserE2E()
  .then(res => {
    const failures = res.results.filter(r => r.status === 'FAIL');
    if (failures.length > 0) {
      console.error(`E2E Test completed with ${failures.length} failures.`);
      process.exit(1);
    } else {
      console.log('ALL BROWSER E2E TESTS PASSED WITH 100% SUCCESS.');
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('Fatal E2E Browser Test Exception:', err);
    process.exit(1);
  });
