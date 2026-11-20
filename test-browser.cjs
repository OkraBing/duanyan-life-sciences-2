const fs = require('node:fs');
const path = require('node:path');
const playwright = require('playwright');

// Use the installed Chrome on macOS; other systems use Playwright's Chromium.
// An explicit browser passed by a test always takes precedence.
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromium = new Proxy(playwright.chromium, {
  get(target, property) {
    if (property === 'launch') return (options = {}) => {
      const selected = { ...options };
      if (!selected.executablePath && !selected.channel) {
        if (process.env.DUANYAN_TEST_BROWSER) selected.executablePath = process.env.DUANYAN_TEST_BROWSER;
        else if (process.platform === 'darwin' && fs.existsSync(chrome)) selected.executablePath = chrome;
      }
      return target.launch(selected);
    };
    const value = Reflect.get(target, property);
    return typeof value === 'function' ? value.bind(target) : value;
  }
});

function testOutput(name) {
  const directory = path.resolve(process.env.DUANYAN_TEST_OUTPUT || path.join(__dirname, 'work', 'qa'));
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, name);
}

module.exports = { ...playwright, chromium, testOutput };
