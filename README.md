# Reproduction: Chromium Issue 499572770

**[146 regression] scrollIntoView, element.click, and W3C Actions pointerMove 100-300x slower than Chrome 145**

Bug: https://issues.chromium.org/issues/499572770

## What this reproduces

On Chrome 146+, WebDriver element-interaction commands are 100-300x slower than Chrome 145:

| Command | Chrome 145 | Chrome 146+ |
|---------|-----------|-------------|
| `moveTo` (W3C Actions pointerMove) | < 10 ms | 1000-1500 ms |
| `element.click()` | < 10 ms | 500-1000 ms |
| `scrollIntoView` (WebDriver) | < 10 ms | 1000-1500 ms |

JavaScript `executeScript('scrollIntoView(...)')` is **NOT** affected — it stays < 10 ms on all versions. This confirms the regression is in Chrome's WebDriver endpoint handler, not the rendering pipeline itself.

## Test structure

The test suite (`selenium-mochajs/test.js`) contains 4 tests:

1. **Setup verification** — navigates to google.com (sanity check)
2. **moveTo regression** — measures `driver.actions().move()` across 15 visible table cells
3. **click regression** — measures `element.click()` across 10 iterations on checkboxes
4. **JS scrollIntoView control** — measures `executeScript('scrollIntoView()')` to prove JS-level commands are not affected

Tests 2 and 3 assert that average duration is < 200 ms. On Chrome 145, they average < 10 ms. On Chrome 146+, they fail with averages of 1000+ ms.

Test 4 should **pass on all Chrome versions** — it's the control that proves the issue is in WebDriver endpoints, not JS execution.

## Running locally

```bash
cd selenium-mochajs
npm install
npm test
```

By default, tests use the latest stable Chrome. To test against Chrome 145 (baseline):
- Edit `test.js` line with `setBrowserVersion('stable')` → change to `setBrowserVersion('145')`

## Expected results

### Chrome 145 (all pass):
```
✓ should be able to navigate to a page
✓ PERF BUG: moveTo (pointerMove) should average < 200ms per element  (avg ~5ms)
✓ PERF BUG: element.click should average < 200ms per element  (avg ~3ms)
✓ PERF BUG: JS scrollIntoView via executeScript should be fast (control)  (avg ~5ms)
```

### Chrome 146+ (tests 2 and 3 fail):
```
✓ should be able to navigate to a page
✗ PERF BUG: moveTo (pointerMove) should average < 200ms per element  (avg ~1200ms)
✗ PERF BUG: element.click should average < 200ms per element  (avg ~800ms)
✓ PERF BUG: JS scrollIntoView via executeScript should be fast (control)  (avg ~5ms)
```

## Environment

- Originally reported on Windows 10/11 and Windows Server 2022
- Affects both headless and non-headless modes
- Framework-agnostic: affects Selenium, WDIO, Playwright equally
- This repro uses Selenium WebDriver + Mocha to match the template format
