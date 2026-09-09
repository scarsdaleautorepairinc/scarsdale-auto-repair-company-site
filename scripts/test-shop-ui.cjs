// Run only against the isolated local QA servers, never production customer data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = 'data/ui-qa';
  fs.mkdirSync(output, { recursive: true });
  try {
    await page.goto('http://127.0.0.1:5178/customer-service');
    await page.getByRole('tab', { name: 'New Visit', exact: true }).click();
    await page.getByRole('textbox', { name: 'Customer name', exact: true }).fill('Browser QA Only');
    await page.getByRole('textbox', { name: 'Phone', exact: true }).fill('2025550100');
    await page.getByRole('textbox', { name: 'Plate', exact: true }).fill('BROWSERQA');
    await page.getByRole('textbox', { name: 'Customer complaint / concern', exact: true }).fill('Coolant loss and brake noise');
    await page.getByRole('textbox', { name: 'Authorized by', exact: true }).fill('Browser QA Only');
    await page.getByRole('button', { name: 'Save Authorization', exact: true }).click();
    await page.getByRole('button', { name: 'Save Finding', exact: true }).waitFor();
    for (const part of ['Coolant reservoir', 'Left front caliper']) {
      await page.getByRole('textbox', { name: 'Finding', exact: true }).fill(`${part} requires replacement`);
      await page.getByRole('textbox', { name: 'Part / area', exact: true }).fill(part);
      await page.getByRole('textbox', { name: 'Recommended work', exact: true }).fill(`Replace ${part} and verify`);
      const response = page.waitForResponse(r => r.url().endsWith('/inspection') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Save Finding', exact: true }).click();
      assert.equal((await response).status(), 200);
      await page.getByRole('button', { name: 'Save Finding', exact: true }).isEnabled();
    }
    await page.getByText('Left front caliper requires replacement', { exact: false }).waitFor();
    assert.equal(await page.locator('.finding-entry').count(), 2);
    const upload = page.locator('.finding-entry input[type=file]').first();
    const uploaded = page.waitForResponse(r => r.url().endsWith('/upload'));
    await upload.setInputFiles({ name: 'qa-part.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
    assert.equal((await uploaded).status(), 200);
    await page.locator('.finding-photo img').waitFor();
    await page.locator('.finding-photo img').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('.finding-photo img')].every(i => i.complete && i.naturalWidth > 0));
    await page.getByRole('tab', { name: 'Estimate & Approval', exact: true }).click();
    for (const [name, type, qty, price] of [['Coolant reservoir','part','1','100'], ['Installation','labor','1.5','100']]) {
      await page.getByRole('textbox', { name: 'Description', exact: true }).fill(name);
      await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption(type);
      await page.getByRole('spinbutton', { name: 'Quantity / Hours', exact: true }).fill(qty);
      await page.getByRole('spinbutton', { name: 'Unit Price / Hourly Rate', exact: true }).fill(price);
      const response = page.waitForResponse(r => r.url().endsWith('/lines') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Add Line', exact: true }).click();
      assert.equal((await response).status(), 200);
      await page.getByRole('checkbox', { name: `Select ${name}`, exact: true }).check();
    }
    await page.getByRole('textbox', { name: 'Approval evidence / conversation note', exact: true }).fill('QA customer approved $250 in person.');
    await page.getByRole('button', { name: 'Record Decision (2)', exact: true }).click();
    await page.getByRole('button', { name: 'Record Decision (0)', exact: true }).waitFor();
    await page.screenshot({ path: `${output}/desktop-estimate.png`, fullPage: true });
    await page.getByRole('tablist', { name: 'Selected work order' }).getByRole('tab', { name: 'Inspection', exact: true }).click();
    await page.getByRole('button', { name: 'Vehicle Ready', exact: true }).click();
    await page.getByRole('tab', { name: 'Checkout', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'qa-invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nQA placeholder invoice\n%%EOF') });
    await page.getByRole('spinbutton', { name: 'Total on uploaded invoice', exact: true }).fill('250');
    await page.getByRole('textbox', { name: 'Verification note', exact: true }).fill('QA fixture total is 250.');
    await page.getByRole('button', { name: 'Verify Invoice Total', exact: true }).click();
    await page.getByRole('button', { name: 'Record Payment', exact: true }).click();
    await page.getByText('Visit paid and ready', { exact: true }).waitFor();
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download', exact: true }).click();
    assert.equal((await download).suggestedFilename(), 'qa-invoice.pdf');
    await page.screenshot({ path: `${output}/desktop-checkout.png`, fullPage: true });
    for (const tab of ['Work Orders','New Visit','Inspection','Estimate / Checkout','Vehicle History','Reports','Backups']) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('tablist', { name: 'Customer service workflow' }).getByRole('tab', { name: tab, exact: true }).click();
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      await page.screenshot({ path: `${output}/mobile-${tab.replaceAll(/[^a-z]/gi,'-')}.png`, fullPage: true });
      if (overflow) console.log(await page.evaluate(() => [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth).map(e => [e.tagName,e.className,e.getBoundingClientRect().width]).slice(0,15)));
      assert.equal(overflow, false, `${tab} must not overflow mobile viewport`);
      for (const table of await page.locator('.report-table').all()) {
        assert.ok((await table.boundingBox()).width >= 700, 'Tables must retain readable column widths');
      }
      await page.screenshot({ path: `${output}/mobile-${tab.replaceAll(/[^a-z]/gi,'-')}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: 'Create Verified Backup', exact: true }).click();
    await page.getByRole('link', { name: /shop-.*zip/ }).first().waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: browser intake, findings/photo, parts/labor, approval, ready, invoice, payment, download, backup, and 7 mobile views; no page errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
