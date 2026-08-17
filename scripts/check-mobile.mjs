const targets = await fetch('http://127.0.0.1:9223/json').then((response) => response.json());
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('Chrome page target not found');
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();
const events = new Map();
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); }
  if (message.method && events.has(message.method)) { events.get(message.method)(); events.delete(message.method); }
};
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 380, height: 800, deviceScaleFactor: 1, mobile: true });
const loaded = new Promise((resolve) => events.set('Page.loadEventFired', resolve));
await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
await loaded;
await new Promise((resolve) => setTimeout(resolve, 250));
const title = await send('Runtime.evaluate', { expression: `document.querySelector('button')?.click(); true`, returnByValue: true });
await new Promise((resolve) => setTimeout(resolve, 100));
const result = await send('Runtime.evaluate', { expression: `(() => ({
  title: document.title,
  innerWidth: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  bodyScrollWidth: document.body.scrollWidth,
  svgViewBox: document.querySelector('svg')?.getAttribute('viewBox'),
  buttons: [...document.querySelectorAll('button')].map((button) => ({ text: button.textContent, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
  text: document.body.innerText.slice(0, 500)
}))()`, returnByValue: true });
console.log(JSON.stringify(result.result.value, null, 2));
if (result.result.value.scrollWidth > 380 || result.result.value.bodyScrollWidth > 380) throw new Error('380px horizontal overflow');
if (result.result.value.buttons.some((button) => button.height < 44)) throw new Error('touch target below 44px');
if (result.result.value.svgViewBox !== '0 0 340 340') throw new Error('board viewBox mismatch');
await send('Runtime.evaluate', { expression: `document.querySelector('[data-hit="0-0"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); true`, returnByValue: true });
await new Promise((resolve) => setTimeout(resolve, 800));
const interaction = await send('Runtime.evaluate', { expression: `(() => ({
  blackStones: document.querySelectorAll('.stone-b').length,
  whiteStones: document.querySelectorAll('.stone-w').length,
  status: document.querySelector('.status-line')?.textContent,
  hitRadius: document.querySelector('.hit')?.getAttribute('r')
}))()`, returnByValue: true });
console.log(JSON.stringify(interaction.result.value, null, 2));
if (interaction.result.value.blackStones < 2 || interaction.result.value.whiteStones < 2) throw new Error('touch move or delayed AI move did not execute');
if (interaction.result.value.hitRadius !== '25') throw new Error('intersection hit target radius mismatch');
socket.close();
