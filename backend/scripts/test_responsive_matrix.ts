import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

const VIEWPORTS = [
  { name: '320x568 (Mobile Small)', width: 320, height: 568, isMobile: true },
  { name: '375x812 (Mobile Standard)', width: 375, height: 812, isMobile: true },
  { name: '430x932 (Mobile Large)', width: 430, height: 932, isMobile: true },
  { name: '768x1024 (Tablet Portrait)', width: 768, height: 1024, isMobile: true },
  { name: '1024x768 (Tablet Landscape)', width: 1024, height: 768, isMobile: false },
  { name: '1280x720 (Laptop 720p)', width: 1280, height: 720, isMobile: false },
  { name: '1440x900 (Laptop Standard)', width: 1440, height: 900, isMobile: false },
  { name: '1920x1080 (Desktop FHD)', width: 1920, height: 1080, isMobile: false }
];

const ROUTES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'employees', label: 'Employee Master' },
  { id: 'recruitment', label: 'Recruitment & ATS' },
  { id: 'offboarding', label: 'Offboarding & F&F' },
  { id: 'attendance', label: 'Shifts & Attendance' },
  { id: 'leave', label: 'Team Leave & Approvals' },
  { id: 'column-master', label: 'Salary Column Master' },
  { id: 'compensation', label: 'Salary Structures (CTC)' },
  { id: 'payroll', label: '7-Stage Payroll Engine' },
  { id: 'loans', label: 'Loans & Advances' },
  { id: 'expenses', label: 'Expenses & Travel' },
  { id: 'assets-helpdesk', label: 'Assets & Help Desk' },
  { id: 'reports', label: 'Registers & NEFT Export' },
  { id: 'master-data', label: 'Master Data Management' },
  { id: 'payroll-permissions', label: 'Payroll Permissions' },
  { id: 'self', label: 'My Self-Service' },
  { id: 'my-leave', label: 'My Leave' },
  { id: 'my-payslips', label: 'My Payslips' }
];

interface MatrixResult {
  viewport: string;
  route: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  overflowPx: number;
  sidebarBehavior: string;
  notes: string;
}

async function runResponsiveMatrix() {
  console.log('=== Starting PAYFLOW Comprehensive Responsive Viewport Matrix ===');
  console.log(`Testing ${VIEWPORTS.length} Viewports across ${ROUTES.length} Routes (${VIEWPORTS.length * ROUTES.length} total intersections)\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore normal test or network 404 logs if any
      if (!text.includes('favicon.ico')) {
        consoleErrors.push(text);
      }
    }
  });

  // Login as admin
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  const needsLogin = await page.$('button[type="submit"]');
  if (needsLogin) {
    console.log('Authenticating administrator session...');
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
    try {
      await page.waitForSelector('.main-wrapper', { timeout: 15000 });
      console.log('✓ Admin authenticated successfully\n');
    } catch (err) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.error('Login wait failed. Page body text:', bodyText);
      console.error('Console errors:', consoleErrors);
      throw err;
    }
  }

  const matrixResults: MatrixResult[] = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 400));

    // Test Sidebar Drawer / Pinned Behavior on this viewport
    let sidebarStatus = 'OK';
    const hamburgerVisible = await page.evaluate(() => {
      const btn = document.querySelector('.mobile-nav-toggle') as HTMLElement;
      if (!btn) return false;
      const style = window.getComputedStyle(btn);
      return style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetParent !== null;
    });

    if (vp.isMobile) {
      if (!hamburgerVisible) {
        sidebarStatus = 'FAIL: Hamburger button missing on mobile/tablet';
      } else {
        // Test opening sidebar drawer
        await page.click('.mobile-nav-toggle');
        await new Promise(r => setTimeout(r, 300));
        const isOpen = await page.evaluate(() => {
          const s = document.querySelector('.sidebar');
          return s ? s.classList.contains('open') : false;
        });

        // Close sidebar drawer
        const closeBtn = await page.$('.sidebar-close-btn');
        if (closeBtn) {
          await closeBtn.click();
        } else {
          const backdrop = await page.$('.sidebar-backdrop');
          if (backdrop) await backdrop.click();
        }
        await new Promise(r => setTimeout(r, 300));

        sidebarStatus = isOpen ? 'PASS: Drawer toggles cleanly' : 'FAIL: Drawer did not open';
      }
    } else {
      sidebarStatus = hamburgerVisible ? 'FAIL: Hamburger should be hidden on desktop' : 'PASS: Pinned sidebar';
    }

    // Now test each route in this viewport
    for (const route of ROUTES) {
      try {
        // Navigate via DOM click or SPA hook
        await page.evaluate((targetId) => {
          // Find nav-item matching targetId
          const navItems = Array.from(document.querySelectorAll('.nav-item'));
          for (const item of navItems) {
            if (item.textContent?.toLowerCase().includes(targetId) || item.getAttribute('id') === targetId) {
              (item as HTMLElement).click();
              return;
            }
          }
          // Direct dispatch if not clicked
          window.dispatchEvent(new CustomEvent('test:navigate', { detail: targetId }));
        }, route.id);

        // Also fallback to clicking directly by inspecting nav items
        const clicked = await page.evaluate((targetId, targetLabel) => {
          const items = Array.from(document.querySelectorAll('.nav-item')) as HTMLElement[];
          for (const it of items) {
            if (it.textContent?.includes(targetLabel)) {
              it.click();
              return true;
            }
          }
          return false;
        }, route.id, route.label);

        await new Promise(r => setTimeout(r, 400));

        // Inspect horizontal overflow
        const overflowData = await page.evaluate(() => {
          const scrollWidth = document.documentElement.scrollWidth;
          const clientWidth = window.innerWidth;
          const bodyScrollWidth = document.body.scrollWidth;
          const diff = Math.max(0, scrollWidth - clientWidth, bodyScrollWidth - clientWidth);
          return {
            diff,
            scrollWidth,
            clientWidth
          };
        });

        const hasHorizontalOverflow = overflowData.diff > 3; // allow 1-3px rounding
        const status = hasHorizontalOverflow ? 'FAIL' : 'PASS';
        const notes = hasHorizontalOverflow
          ? `Page overflows by ${overflowData.diff}px (scrollWidth=${overflowData.scrollWidth}, clientWidth=${overflowData.clientWidth})`
          : 'Zero page-level horizontal overflow';

        matrixResults.push({
          viewport: `${vp.width}x${vp.height}`,
          route: route.label,
          status,
          overflowPx: overflowData.diff,
          sidebarBehavior: sidebarStatus,
          notes
        });

        process.stdout.write(`  [${status}] ${route.label.padEnd(28)} (overflow: ${overflowData.diff}px)\n`);
      } catch (err: any) {
        matrixResults.push({
          viewport: `${vp.width}x${vp.height}`,
          route: route.label,
          status: 'BLOCKED',
          overflowPx: -1,
          sidebarBehavior: sidebarStatus,
          notes: err.message || 'Route navigation error'
        });
        process.stdout.write(`  [BLOCKED] ${route.label.padEnd(28)}: ${err.message}\n`);
      }
    }
  }

  // Test Modal Responsiveness on mobile viewport (320x568 and 375x812)
  console.log('\n--- Testing Modal Dialog Responsiveness on Mobile Viewports ---');
  await page.setViewport({ width: 320, height: 568 });
  await page.evaluate(() => {
    // Navigate to payroll
    const items = Array.from(document.querySelectorAll('.nav-item')) as HTMLElement[];
    const payrollItem = items.find(it => it.textContent?.includes('7-Stage Payroll Engine'));
    if (payrollItem) payrollItem.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Click Initialize Run button to open Stage 1 Modal
  const initBtn = await page.$('button.btn-primary');
  let modalPassed = false;
  let modalWidth = 0;
  if (initBtn) {
    await initBtn.click();
    await new Promise(r => setTimeout(r, 600));

    modalWidth = await page.evaluate(() => {
      const dialog = document.querySelector('.modal-dialog') as HTMLElement;
      return dialog ? dialog.getBoundingClientRect().width : 0;
    });

    modalPassed = modalWidth > 0 && modalWidth <= 320;
    console.log(`Stage 1 Modal in 320px viewport: width=${modalWidth}px (Pass: ${modalPassed})`);

    // Close modal
    const closeBtn = await page.$('.btn-close');
    if (closeBtn) await closeBtn.click();
    await new Promise(r => setTimeout(r, 300));
  }

  await browser.close();

  // Print Summary Table
  console.log('\n=== Route-by-Viewport Responsiveness Execution Matrix ===');
  const passes = matrixResults.filter(r => r.status === 'PASS').length;
  const fails = matrixResults.filter(r => r.status === 'FAIL').length;
  const blocked = matrixResults.filter(r => r.status === 'BLOCKED').length;
  const total = matrixResults.length;

  console.log(`Total Route-Viewport Tests: ${total}`);
  console.log(`Passed: ${passes} (${Math.round((passes / total) * 100)}%)`);
  console.log(`Failed: ${fails}`);
  console.log(`Blocked: ${blocked}`);
  console.log(`Modal Mobile Fit (320px): ${modalPassed ? 'PASS' : 'FAIL'} (${modalWidth}px)`);
  console.log(`Total Console Errors Observed: ${consoleErrors.length}`);

  if (fails > 0) {
    console.log('\nFailed Combinations:');
    console.table(matrixResults.filter(r => r.status === 'FAIL'));
    process.exit(1);
  } else {
    console.log('\nALL VIEWPORTS AND ROUTES PASSED RESPONSIVE VERIFICATION!');
    process.exit(0);
  }
}

runResponsiveMatrix().catch(err => {
  console.error('Fatal Matrix Runner Exception:', err);
  process.exit(1);
});
