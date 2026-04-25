/**
 * Reproduction for Chromium issue 499572770:
 * [146 regression] scrollIntoView, element.click, and W3C Actions pointerMove
 * are 100-300x slower than Chrome 145.
 *
 * https://issues.chromium.org/issues/499572770
 *
 * This test measures moveTo (W3C Actions pointerMove) and click durations
 * across multiple visible table cells. On Chrome 145, both average <10ms.
 * On Chrome 146+, moveTo averages 1000-1500ms and click averages 500-1000ms.
 */

const { Builder, By, until } = require('selenium-webdriver');
const { expect } = require('expect');
const chrome = require('selenium-webdriver/chrome');

// Thresholds: Chrome 145 baseline is < 10ms for both commands.
// 30ms allows for CI runner variance while still catching the regression.
const MOVE_TO_THRESHOLD_MS = 30;
const CLICK_THRESHOLD_MS = 30;
const ELEMENT_COUNT = 15;

describe('Chromium Issue 499572770 — WebDriver Performance Regression', function () {
  let driver;
  this.timeout(5 * 60 * 1000);

  beforeEach(async function () {
    const options = new chrome.Options();
    options.addArguments('--headless');
    options.addArguments('--no-sandbox');
    options.addArguments('--window-size=1920,1080');

    // Run against stable (146+) to reproduce; change to '145' to see baseline
    options.setBrowserVersion('stable');

    const service = new chrome.ServiceBuilder()
      .loggingTo('chromedriver.log')
      .enableVerboseLogging();

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .setChromeService(service)
      .build();
  });

  afterEach(async function () {
    await driver.quit();
  });

  it('should be able to navigate to a page', async function () {
    await driver.get('https://www.google.com');
    const title = await driver.getTitle();
    expect(title).toBe('Google');
  });

  it('PERF BUG: moveTo (pointerMove) should average < 30ms per element', async function () {
    // Use a page with a large visible table — no hidden skip-nav links
    await driver.get('https://the-internet.herokuapp.com/large');
    await driver.wait(until.elementLocated(By.css('td')), 10000);

    const cells = await driver.findElements(By.css('td'));
    const count = Math.min(cells.length, ELEMENT_COUNT);
    const times = [];

    console.log(`\n  moveTo timing over ${count} visible <td> elements:`);
    for (let i = 0; i < count; i++) {
      const t0 = performance.now();
      await driver.actions({ bridge: false }).move({ origin: cells[i] }).perform();
      const elapsed = performance.now() - t0;
      times.push(elapsed);
      console.log(`    cell[${i}]: ${elapsed.toFixed(0)} ms`);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`\n  moveTo average: ${avg.toFixed(0)} ms (threshold: ${MOVE_TO_THRESHOLD_MS} ms)`);
    console.log(`  Chrome 145 baseline: < 10 ms`);

    if (avg > MOVE_TO_THRESHOLD_MS) {
      console.error(`\n  ❌ BUG CONFIRMED: moveTo avg ${avg.toFixed(0)}ms is ${(avg / 10).toFixed(0)}x slower than baseline`);
    }

    expect(avg).toBeLessThan(MOVE_TO_THRESHOLD_MS);
  });

  it('PERF BUG: element.click should average < 30ms per element', async function () {
    // Use a page with many clickable elements (checkboxes)
    await driver.get('https://the-internet.herokuapp.com/checkboxes');
    await driver.wait(until.elementLocated(By.css('input[type="checkbox"]')), 10000);

    // We'll re-navigate to get fresh checkboxes for each iteration
    const iterations = 10;
    const times = [];

    console.log(`\n  click timing over ${iterations} iterations:`);
    for (let i = 0; i < iterations; i++) {
      await driver.get('https://the-internet.herokuapp.com/checkboxes');
      await driver.wait(until.elementLocated(By.css('input[type="checkbox"]')), 10000);
      const checkboxes = await driver.findElements(By.css('input[type="checkbox"]'));

      const t0 = performance.now();
      await checkboxes[0].click();
      const elapsed = performance.now() - t0;
      times.push(elapsed);
      console.log(`    iteration[${i}]: ${elapsed.toFixed(0)} ms`);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`\n  click average: ${avg.toFixed(0)} ms (threshold: ${CLICK_THRESHOLD_MS} ms)`);
    console.log(`  Chrome 145 baseline: < 10 ms`);

    if (avg > CLICK_THRESHOLD_MS) {
      console.error(`\n  ❌ BUG CONFIRMED: click avg ${avg.toFixed(0)}ms is ${(avg / 10).toFixed(0)}x slower than baseline`);
    }

    expect(avg).toBeLessThan(CLICK_THRESHOLD_MS);
  });

  it('PERF BUG: JS scrollIntoView via executeScript should be fast (control)', async function () {
    // This test demonstrates that JS-level scrollIntoView is NOT affected —
    // only WebDriver-level commands (moveTo, click) are slow.
    // If this test passes but the above two fail, the regression is in
    // Chrome's WebDriver endpoint handler, not in the rendering pipeline.
    await driver.get('https://the-internet.herokuapp.com/large');
    await driver.wait(until.elementLocated(By.css('td')), 10000);

    const cells = await driver.findElements(By.css('td'));
    const count = Math.min(cells.length, ELEMENT_COUNT);
    const times = [];

    console.log(`\n  JS scrollIntoView timing over ${count} elements:`);
    for (let i = 0; i < count; i++) {
      const t0 = performance.now();
      await driver.executeScript('arguments[0].scrollIntoView({block:"center"})', cells[i]);
      const elapsed = performance.now() - t0;
      times.push(elapsed);
      console.log(`    cell[${i}]: ${elapsed.toFixed(0)} ms`);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`\n  JS scrollIntoView average: ${avg.toFixed(0)} ms (expected: < 50ms on all versions)`);

    // This should pass on all Chrome versions — it's the control
    expect(avg).toBeLessThan(100);
  });
});
