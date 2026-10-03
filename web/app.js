import { SCHEMA_VERSION, MAX_REPORT_BYTES, normalizeIP, compareAddresses, createRedactor, validateReport, safeExport, STATUS_LABELS, OVERALL_LABELS } from './report.js';
import { createScene } from './scene.js';
const scene = createScene();

const legacyChapters = new Set(['hero', 'truth', 'words', 'journey', 'modes', 'layers', 'domains', 'fingerprint', 'report', 'build', 'gatekeeper', 'drill', 'fix', 'privacy', 'myths', 'appeal', 'checklist', 'sources']);
function preserveLegacyLink() {
  if (legacyChapters.has(location.hash.slice(1))) location.replace(`../${location.hash}`);
}
preserveLegacyLink();
window.addEventListener('hashchange', preserveLegacyLink);

const $ = id => document.getElementById(id);
const state = { epoch: 0, controller: null, report: null, redactor: null, origin: null };
const ENDPOINTS = [
  { id: 'browser.ipv4', url: 'https://api.ipify.org?format=json', kind: 'json', family: 'IPv4' },
  { id: 'browser.ipv6', url: 'https://api6.ipify.org?format=json', kind: 'json', family: 'IPv6' },
  { id: 'browser.connection', url: 'https://www.cloudflare.com/cdn-cgi/trace', kind: 'trace' }
];
const TITLES = {
  'browser.context': '浏览器上下文', 'browser.ipv4': 'IPv4 出口', 'browser.ipv6': 'IPv6 出口',
  'browser.connection': '当前连接与地区', 'browser.consistency': '同协议出口比较',
  'browser.webrtc': 'WebRTC 候选地址', 'browser.run_completion': '本轮完成状态', 'scope.cli': '本机 Claude CLI 与登录',
  'scope.dns': 'DNS 解析路径', 'scope.proxy': '代理规则与系统路由',
  'scope.guard': '故障时的出站阻断', 'scope.account': 'Claude 账号状态'
};
const LEVELS = { configuration: '配置记录', runtime: '运行状态', normal_probe: '正常网络探测', isolated_path_test: '隔离路径测试', system_fault_drill: '系统故障演练' };
const LIMITATIONS = [
  '这是当前浏览器的观察结果。浏览器、Desktop 和 CLI 可能使用不同的网络路径。',
  '服务返回的地区代码只描述该次请求，不能证明账号使用资格、实际所在地区或 IP 信誉。',
  'IPv4 与 IPv6 地址本来可以不同。只有同一地址族的结果才进行比较。',
  '超时、CORS 限制、服务拒绝与没有候选地址，都不能当作未泄漏或账号异常的证据。',
  '未执行网络抓包、DNS 路径验证、代理故障演练和 Claude 登录测试。'
];

function check(id, status, observed, message, remediation = '', required = false, source = '浏览器 API', level = 'runtime') {
  return { id, status, required, observed_at: new Date().toISOString(), source, evidence_level: level, observed, message, remediation };
}
function setProgress(index, label) {
  scene.update(index === 3 ? label === '已停止' ? 'stopped' : 'complete' : 'running', index);
  $('step-index').textContent = `${String(Math.min(index + 1, 4)).padStart(2, '0')} / 04`;
  $('run-label').textContent = label;
  for (const item of $('progress').children) {
    const n = Number(item.dataset.step);
    item.classList.toggle('current', n === index);
    item.classList.toggle('complete', n < index);
  }
}
function busy(value) {
  if (value) scene.update('running', 0);
  $('start').disabled = value;
  $('cancel').hidden = !value;
  $('webrtc-optin').disabled = value;
}
function clearErrors() {
  for (const id of ['error', 'import-error']) { $(id).hidden = true; $(id).textContent = ''; }
}
function appendText(parent, tag, content, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = content;
  parent.append(element);
  return element;
}
function printable(value) { return typeof value === 'string' ? value : JSON.stringify(value, null, 2); }

function renderReport(focus = true) {
  if (!state.report) return;
  $('export').disabled = false;
  const report = $('reveal').checked ? state.report : state.redactor.redact(state.report);
  $('results-section').hidden = false;
  $('reset').hidden = false;
  if (state.origin === 'import') scene.update('import');
  $('result-origin').textContent = state.origin === 'import' ? 'LOCAL REPORT / READ ONLY' : 'BROWSER / CURRENT RUN';
  $('results-title').textContent = state.origin === 'import' ? '本机报告记录' : '浏览器检查结果';
  const counts = Object.fromEntries(['PASS', 'FAIL', 'WARN', 'UNKNOWN', 'SKIPPED'].map(status => [status, report.checks.filter(item => item.status === status).length]));
  $('result-summary').textContent = `${OVERALL_LABELS[report.overall]}。已验证 ${counts.PASS} 项，需关注或有问题 ${counts.FAIL + counts.WARN} 项，未验证 ${counts.UNKNOWN} 项，未执行 ${counts.SKIPPED} 项。`;
  const checkedTime = new Date(report.checked_at);
  $('report-meta').textContent = `${checkedTime.toLocaleString()} · ${report.tool_version} · ${report.schema_version}`;
  $('import-notice').hidden = state.origin !== 'import';
  if (state.origin === 'import') {
    const hours = Math.floor((Date.now() - checkedTime.getTime()) / 3600000);
    const age = hours < 0 ? '报告时间晚于当前设备时间，请核对生成时间。' : hours >= 24 ? `这份记录约为 ${Math.floor(hours / 24)} 天前生成，环境可能已经变化。` : '这是生成时的检查记录，请按需要重新运行本机工具。';
    $('import-notice').textContent = `${age} 总体结论已根据检查项重新计算。执行位置：${printable(report.run_location)}。范围：${printable(report.scope)}。`;
  }
  $('checks').replaceChildren();
  for (const item of report.checks) {
    const row = document.createElement('article'); row.className = 'check';
    const status = document.createElement('div'); status.className = 'check-status'; status.dataset.status = item.status;
    appendText(status, 'strong', STATUS_LABELS[item.status]); appendText(status, 'span', item.status);
    row.append(status);
    const body = document.createElement('div'); body.className = 'check-body';
    appendText(body, 'h3', TITLES[item.id] || item.id);
    appendText(body, 'p', item.message);
    if (item.remediation) appendText(body, 'p', item.remediation, 'remediation');
    const details = document.createElement('details');
    appendText(details, 'summary', `查看证据 · ${LEVELS[item.evidence_level]}${item.required ? ' · 范围内必检' : ''}`);
    appendText(details, 'pre', printable({ source: item.source, observed_at: item.observed_at, observed: item.observed }));
    body.append(details); row.append(body); $('checks').append(row);
  }
  $('limitations').replaceChildren();
  for (const limitation of report.limitations) appendText($('limitations'), 'li', limitation);
  if (focus) $('results-title').focus({ preventScroll: true });
}

async function probe(endpoint, parentSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal.addEventListener('abort', abort, { once: true });
  if (parentSignal.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 8000);
  try {
    const response = await fetch(endpoint.url, { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal });
    if (!response.ok) throw new Error(`服务返回 HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 65536) throw new Error('服务响应超过允许大小');
    const result = endpoint.kind === 'json' ? JSON.parse(text) : Object.fromEntries(text.trim().split('\n').map(line => {
      const separator = line.indexOf('='); return [line.slice(0, separator), line.slice(separator + 1)];
    }).filter(pair => pair[0]));
    const ip = normalizeIP(result.ip);
    if (!ip || (endpoint.family && endpoint.family !== ip.family)) throw new Error('服务未返回预期协议的有效 IP');
    const observed = { ip: ip.address, address_family: ip.family };
    if (endpoint.kind === 'trace') {
      if (/^[A-Z]{2}$/.test(result.loc || '')) observed.region_code = result.loc;
      for (const key of ['tls', 'http']) if (typeof result[key] === 'string' && result[key].length < 80) observed[key] = result[key];
    }
    return check(endpoint.id, 'PASS', observed, endpoint.kind === 'trace' ? '已取得当前浏览器请求的出口与连接记录。' : `已取得 ${ip.family} 请求的出口地址。`, '该结果只代表这次请求，不能证明所有软件使用相同路径。', true, endpoint.url, 'normal_probe');
  } catch (error) {
    const cancelled = parentSignal.aborted;
    const reason = cancelled ? '用户停止了本轮检测。' : timedOut ? '请求在 8 秒内未完成。' : '请求不可读取。可能涉及网络、CORS、服务限制或响应格式。';
    return check(endpoint.id, cancelled ? 'SKIPPED' : 'UNKNOWN', { completed: false, reason: cancelled ? 'cancelled' : timedOut ? 'timeout' : 'unavailable' }, `${reason}${endpoint.family === 'IPv6' ? ' 不能据此判断本机没有 IPv6 或没有泄漏。' : ''}`, '确认网络条件后可重新检查。不要通过关闭 TLS 校验或绕过浏览器安全限制来制造成功结果。', true, endpoint.url, 'normal_probe');
  } finally {
    clearTimeout(timeout); parentSignal.removeEventListener('abort', abort);
  }
}

async function webrtcProbe(signal) {
  const source = 'RTCPeerConnection · stun.cloudflare.com:3478';
  if (!globalThis.RTCPeerConnection) return check('browser.webrtc', 'UNKNOWN', null, '此浏览器未提供 WebRTC API。', '', false, source);
  let connection;
  try {
    connection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });
    const candidates = [];
    await new Promise((resolve, reject) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true; clearTimeout(timeout); signal.removeEventListener('abort', done); resolve();
      };
      const timeout = setTimeout(done, 8000);
      signal.addEventListener('abort', done, { once: true });
      connection.onicecandidate = event => {
        if (!event.candidate) { done(); return; }
        const parts = event.candidate.candidate.split(' ');
        const candidateAddress = event.candidate.address || parts[4] || '';
        const ip = normalizeIP(candidateAddress);
        const type = ['host', 'srflx', 'relay', 'prflx'].includes(event.candidate.type || parts[7]) ? (event.candidate.type || parts[7]) : 'unknown';
        const item = ip ? { address: ip.address, address_family: ip.family, type } : { address: '[浏览器隐藏或非 IP 候选]', type };
        if (!candidates.some(c => JSON.stringify(c) === JSON.stringify(item))) candidates.push(item);
      };
      if (signal.aborted) { done(); return; }
      connection.createDataChannel('environment-check');
      connection.createOffer().then(offer => signal.aborted ? undefined : connection.setLocalDescription(offer)).catch(error => { done(); reject(error); });
    });
    if (signal.aborted) return check('browser.webrtc', 'SKIPPED', null, '用户停止了 WebRTC 检查。', '', false, source);
    return check('browser.webrtc', candidates.some(c => c.address_family) ? 'PASS' : 'UNKNOWN', { candidates }, candidates.some(c => c.address_family) ? '已观察到 WebRTC 候选地址。它们可能与 HTTP 请求使用不同路径，需要结合具体协议核对。' : '未取得可核对的 IP 候选。浏览器隐藏地址、网络限制或测试时限都可能造成此结果。', '候选存在与不存在，都不能单独证明泄漏或无泄漏。此项没有请求摄像头或麦克风。', false, source, 'normal_probe');
  } catch (error) {
    return check('browser.webrtc', signal.aborted ? 'SKIPPED' : 'UNKNOWN', null, 'WebRTC 检查未完成。不能推断是否存在泄漏。', '', false, source, 'normal_probe');
  } finally { connection?.close(); }
}

function gaps() {
  return [
    check('scope.cli', 'UNKNOWN', null, '网页无法读取本机 CLI 安装、启动变量和登录状态。', '使用本机 Skill，并分别核对 CLI 与 Desktop 登录。'),
    check('scope.dns', 'UNKNOWN', null, '未验证 DNS 查询实际经过的解析器与网络路径。', '使用本机检查及必要的独立路径测试。'),
    check('scope.proxy', 'UNKNOWN', null, '网页无法读取代理客户端规则、TUN 配置与系统路由。', '使用本机工具采集配置与运行状态。'),
    check('scope.guard', 'UNKNOWN', null, '未执行代理故障、网络切换或全系统出站阻断测试。', '需要明确授权的本机故障演练才能形成对应证据。'),
    check('scope.account', 'UNKNOWN', null, '未检查 Claude 登录、额度、账号资格或风险状态。', '在官方产品内核对账号信息。环境报告不预测封号概率。')
  ];
}

async function start() {
  const epoch = ++state.epoch;
  state.controller?.abort(); state.controller = new AbortController();
  const signal = state.controller.signal;
  clearErrors(); busy(true); $('reveal').checked = false;
  state.report = null; state.origin = null; state.redactor = null;
  $('export').disabled = true; $('reset').hidden = true;
  $('checks').replaceChildren(); $('limitations').replaceChildren();
  $('results-section').hidden = true;
  $('live-status').textContent = '正在读取浏览器上下文。';
  setProgress(0, '正在读取');
  const checkedAt = new Date().toISOString();
  const checks = [check('browser.context', 'PASS', {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    language: navigator.language || 'unknown', online_hint: navigator.onLine,
    secure_context: globalThis.isSecureContext
  }, '已读取此浏览器的上下文。这些字段是描述信息，不能证明连接正常或身份一致。', '保持真实、稳定的设置；不需要为得到好看的结果而伪装时区与语言。', true)];
  const optedWebRTC = $('webrtc-optin').checked;
  try {
    setProgress(1, '等待网络响应'); $('live-status').textContent = '正在联系已列出的测试服务。每个请求最多等待 8 秒。';
    const results = await Promise.all([...ENDPOINTS.map(endpoint => probe(endpoint, signal)), ...(optedWebRTC ? [webrtcProbe(signal)] : [])]);
    if (epoch !== state.epoch) return;
    for (const result of results) if (result.id === 'browser.webrtc' && optedWebRTC) result.required = true;
    checks.push(...results);
    if (signal.aborted) checks.push(check('browser.run_completion', 'SKIPPED', { completed: false }, '用户停止了所选检查，本轮范围尚未完成。', '按需要重新执行。', true));
    setProgress(2, '核对地址族');
    const cf = results.find(c => c.id === 'browser.connection');
    const sameFamily = cf?.status === 'PASS' ? results.find(c => c.observed?.address_family === cf.observed.address_family && c.id !== cf.id) : null;
    const comparison = sameFamily?.status === 'PASS' ? compareAddresses(sameFamily.observed.ip, cf.observed.ip) : 'UNKNOWN';
    checks.push(check('browser.consistency', signal.aborted ? 'SKIPPED' : comparison === 'SAME' ? 'PASS' : comparison === 'DIFFERENT' ? 'WARN' : 'UNKNOWN', {
      comparison, address_family: cf?.observed?.address_family || null,
      compared_sources: sameFamily ? [sameFamily.source, cf.source] : []
    }, signal.aborted ? '检测已停止，未完成出口一致性核对。' : comparison === 'SAME' ? '两个服务观察到同一地址族的出口一致。IPv4 与 IPv6 之间不进行相等性比较。' : comparison === 'DIFFERENT' ? '两个服务观察到同一地址族的不同出口。可能与分流、出口轮换或请求路径有关。' : '同一地址族的可比较证据不足。', comparison === 'DIFFERENT' ? '使用本机工具进一步核对分流和出口；此结果本身不能判定泄漏。' : '', false, '同地址族的服务响应比较', 'normal_probe'));
    if (!optedWebRTC) checks.push(check('browser.webrtc', 'SKIPPED', null, '没有启用额外的 WebRTC／STUN 检查。', '按需勾选后重新运行。', false, '用户未启用'));
    checks.push(...gaps());
    setProgress(3, signal.aborted ? '已停止' : '检测完成');
    state.report = validateReport({ schema_version: SCHEMA_VERSION, tool_version: 'web-0.1.2', checked_at: checkedAt,
      run_location: 'browser', scope: { kind: 'browser', network: true, webrtc: optedWebRTC, description: '当前浏览器上下文与显式启用的匿名网络探测' },
      platform: { kind: 'browser' }, checks, limitations: signal.aborted ? ['用户停止了本轮检测，报告保留已取得的证据。', ...LIMITATIONS] : LIMITATIONS });
    state.origin = 'browser'; state.redactor = createRedactor(); renderReport();
    $('live-status').textContent = signal.aborted ? '本轮已停止。结果中标明未完成的项目。' : '本轮完成。查看每项证据与未验证的范围。';
  } catch (error) {
    if (epoch === state.epoch) { scene.update('error'); $('error').textContent = '检测未完成，请重试。已有结果不代表本轮状态。'; $('error').hidden = false; }
  } finally { if (epoch === state.epoch) { busy(false); state.controller = null; } }
}

$('start').addEventListener('click', start);
$('cancel').addEventListener('click', () => { scene.update('stopped'); state.controller?.abort(); });
$('reveal').addEventListener('change', () => renderReport(false));
$('export').addEventListener('click', () => {
  if (!state.report) return;
  const blob = new Blob([JSON.stringify(safeExport(state.report), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'claude-environment-report.json';
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('live-status').textContent = '已导出脱敏报告。IP 使用本次导出独立的随机别名，常见凭据字段已隐藏。自由文本仍需在分享前人工检查。';
});
$('report-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const epoch = ++state.epoch;
  state.controller?.abort(); state.controller = null; busy(false); clearErrors();
  try {
    if (file.size > MAX_REPORT_BYTES) throw new Error('文件超过 1 MiB，请选择本机工具导出的 JSON。');
    const report = validateReport(await file.text());
    if (epoch !== state.epoch) return;
    state.report = report; state.origin = 'import'; state.redactor = createRedactor(); $('reveal').checked = false;
    renderReport(); $('live-status').textContent = '已在此浏览器解析报告，文件没有上传。';
  } catch (error) {
    if (epoch !== state.epoch) return;
    $('import-error').textContent = `报告未导入：${error instanceof SyntaxError ? '文件不是有效 JSON。' : error.message}`;
    $('import-error').hidden = false;
  } finally { if (epoch === state.epoch) $('report-file').value = ''; }
});
$('reset').addEventListener('click', () => {
  ++state.epoch; state.controller?.abort(); state.controller = null; state.report = null; state.redactor = null; state.origin = null;
  busy(false); clearErrors(); $('results-section').hidden = true; $('checks').replaceChildren(); $('limitations').replaceChildren();
  $('reset').hidden = true; $('reveal').checked = false; $('report-file').value = ''; $('live-status').textContent = '当前报告已清除。';
  $('step-index').textContent = '00 / 04'; $('run-label').textContent = '等待开始';
  scene.update('ready');
  for (const item of $('progress').children) item.classList.remove('current', 'complete');
  $('report-file').focus();
});

// 静态内容可以先显示，交互在所有事件绑定完成后才开放。
$('report-file').disabled = false;
$('start').disabled = false;
$('live-status').textContent = '组件已就绪，检测由您点击后开始。';
