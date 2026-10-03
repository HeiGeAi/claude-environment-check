export const SCHEMA_VERSION = '1.0.0';
export const STATUSES = new Set(['PASS', 'FAIL', 'WARN', 'UNKNOWN', 'SKIPPED']);
export const EVIDENCE = new Set(['configuration', 'runtime', 'normal_probe', 'isolated_path_test', 'system_fault_drill']);
export const MAX_REPORT_BYTES = 1024 * 1024;

export function aggregate(checks) {
  if (checks.some(c => c.status === 'FAIL')) return 'ISSUES_FOUND';
  if (checks.some(c => c.required && c.status !== 'PASS')) return 'INCOMPLETE';
  if (checks.some(c => c.status === 'WARN')) return 'ISSUES_FOUND';
  return checks.some(c => c.required) ? 'VERIFIED_IN_SCOPE' : 'INCOMPLETE';
}

function string(value, name, maximum = 2048) {
  if (typeof value !== 'string' || value.length > maximum) throw new Error(`${name} 必须是长度受限的文本。`);
  return value;
}
function data(value, depth = 0) {
  if (depth > 6) throw new Error('报告的数据层级过深。');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return string(value, '数据字段', 8192);
  if (Array.isArray(value)) {
    if (value.length > 150) throw new Error('报告数组过长。');
    return value.map(item => data(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length > 80) throw new Error('报告字段过多。');
    const result = Object.create(null);
    for (const [key, item] of entries) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('报告包含不支持的字段名。');
      result[string(key, '字段名', 100)] = data(item, depth + 1);
    }
    return result;
  }
  throw new Error('报告包含不支持的数据类型。');
}
function timestamp(value, name) {
  string(value, name, 80);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`${name} 不是有效时间。`);
  return value;
}

export function validateReport(input) {
  const serialized = typeof input === 'string' ? input : JSON.stringify(input);
  if (!serialized || new TextEncoder().encode(serialized).length > MAX_REPORT_BYTES) throw new Error('报告必须小于 1 MiB。');
  const report = typeof input === 'string' ? JSON.parse(input) : input;
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('请选择 JSON 格式的体检报告。');
  if (report.schema_version !== SCHEMA_VERSION) throw new Error(`仅支持 schema_version ${SCHEMA_VERSION}。`);
  if (!Array.isArray(report.checks) || report.checks.length > 150) throw new Error('报告检查项必须是数组，最多 150 项。');
  const ids = new Set();
  const checks = report.checks.map(check => {
    if (!check || typeof check !== 'object' || Array.isArray(check)) throw new Error('检查项格式不正确。');
    const id = string(check.id, '检查项 ID', 120);
    if (!/^[a-zA-Z0-9_.-]+$/.test(id) || ids.has(id)) throw new Error('检查项 ID 无效或重复。');
    ids.add(id);
    if (!STATUSES.has(check.status) || !EVIDENCE.has(check.evidence_level)) throw new Error('检查项状态或证据级别不受支持。');
    if (typeof check.required !== 'boolean') throw new Error('required 必须为布尔值。');
    if (!Object.hasOwn(check, 'observed')) throw new Error('检查项缺少 observed。');
    return {
      id, status: check.status, required: check.required,
      observed_at: timestamp(check.observed_at, '观察时间'),
      source: string(check.source, '证据来源', 1000),
      evidence_level: check.evidence_level, observed: data(check.observed),
      message: string(check.message, '检查说明', 4096), remediation: string(check.remediation, '处理建议', 4096)
    };
  });
  if (!['unknown', 'local_mac', 'ssh', 'container', 'cloud', 'browser'].includes(report.run_location)) throw new Error('执行位置声明不受支持。');
  for (const name of ['scope', 'platform']) {
    if (!Object.hasOwn(report, name)) throw new Error(`报告缺少 ${name}。`);
    if (!report[name] || typeof report[name] !== 'object' || Array.isArray(report[name])) throw new Error(`${name} 格式不正确。`);
  }
  if (!Array.isArray(report.limitations) || report.limitations.length > 100) throw new Error('limitations 必须是数组。');
  return {
    schema_version: SCHEMA_VERSION, tool_version: string(report.tool_version, '工具版本', 100),
    checked_at: timestamp(report.checked_at, '检查时间'), run_location: data(report.run_location),
    scope: data(report.scope), platform: data(report.platform), overall: aggregate(checks), checks,
    limitations: report.limitations.map(item => string(item, '限制说明', 4096))
  };
}

export function normalizeIP(input) {
  if (typeof input !== 'string' || input.length > 80) return null;
  const value = input.trim().toLowerCase();
  const v4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(value) ? value.split('.').map(Number) : null;
  if (v4 && v4.every(n => n >= 0 && n <= 255)) return { family: 'IPv4', address: v4.join('.') };
  if (!value.includes(':') || value.includes('%') || /[^0-9a-f:.]/.test(value)) return null;
  let expanded = value;
  if (value.includes('.')) {
    const tail = value.slice(value.lastIndexOf(':') + 1);
    const parsed = normalizeIP(tail);
    if (!parsed || parsed.family !== 'IPv4') return null;
    const bytes = parsed.address.split('.').map(Number);
    expanded = value.slice(0, value.lastIndexOf(':') + 1) + ((bytes[0] << 8) + bytes[1]).toString(16) + ':' + ((bytes[2] << 8) + bytes[3]).toString(16);
  }
  if ((expanded.match(/::/g) || []).length > 1) return null;
  const halves = expanded.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  let parts = halves.length === 2 ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  if (parts.length !== 8 || (halves.length === 2 && left.length + right.length >= 8) || parts.some(p => !/^[0-9a-f]{1,4}$/.test(p))) return null;
  return { family: 'IPv6', address: parts.map(p => parseInt(p, 16).toString(16)).join(':') };
}

export function compareAddresses(a, b) {
  const first = normalizeIP(a), second = normalizeIP(b);
  if (!first || !second) return 'UNKNOWN';
  if (first.family !== second.family) return 'DIFFERENT_FAMILY';
  return first.address === second.address ? 'SAME' : 'DIFFERENT';
}

export function createRedactor() {
  const aliases = new Map();
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  const nonce = [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
  function alias(value) {
    const parsed = normalizeIP(value);
    if (!parsed) return value;
    const key = `${parsed.family}:${parsed.address}`;
    if (!aliases.has(key)) aliases.set(key, `${parsed.family}-地址-${nonce}-${aliases.size + 1}`);
    return aliases.get(key);
  }
  function redactString(value) {
    const whole = normalizeIP(value);
    if (whole) return alias(value);
    return value
      .replace(/https?:\/\/[^\s<>"']+/gi, token => {
        try {
          const url = new URL(token);
          url.username = ''; url.password = '';
          if (url.search) url.search = '?redacted';
          url.hash = '';
          return url.toString();
        } catch { return '[链接已隐藏]'; }
      })
      .replace(/\b(?:Bearer|Basic)\s+[a-zA-Z0-9_./+=-]+/gi, '[认证值已隐藏]')
      .replace(/\b(?:authorization|api[_-]?key|token|password|secret|cookie|credential)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '[敏感文本已隐藏]')
      .replace(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[邮箱已隐藏]')
      .replace(/\/(?:Users|home)\/[^/\s]+/g, '[用户目录]')
      .replace(/(?:\d{1,3}\.){3}\d{1,3}/g, token => normalizeIP(token) ? alias(token) : token)
      .replace(/[0-9a-fA-F]*:[0-9a-fA-F:.]+/g, token => {
        const candidate = token.replace(/\.+$/, '');
        return normalizeIP(candidate) ? alias(candidate) + token.slice(candidate.length) : token;
      })
      .replace(/(?:sk-ant-|sk-)[a-zA-Z0-9_-]{12,}/g, '[凭据已隐藏]');
  }
  function walk(value, key = '') {
    if (/(?:token|password|secret|authorization|api[_-]?key|credential)/i.test(key)) return '[敏感字段已隐藏]';
    if (typeof value === 'string') return redactString(value);
    if (Array.isArray(value)) return value.map(item => walk(item));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
    return value;
  }
  return { alias, redact: walk };
}

export function safeExport(report) {
  return createRedactor().redact(validateReport(report));
}

export const STATUS_LABELS = { PASS: '已验证', FAIL: '发现问题', WARN: '需关注', UNKNOWN: '未验证', SKIPPED: '未执行' };
export const OVERALL_LABELS = { INCOMPLETE: '检查范围尚未完整', ISSUES_FOUND: '发现需要处理的问题', VERIFIED_IN_SCOPE: '声明范围内已验证' };
