#!/usr/bin/env python3
"""Read-only macOS observations; standard library only. Python 3.10+."""
from __future__ import annotations

import argparse
import datetime as dt
import ipaddress
import json
import os
from pathlib import Path
import platform
import re
import secrets
import selectors
import signal
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlparse

SCHEMA_VERSION = "1.0.0"
TOOL_VERSION = "0.1.3"
MAX_OUTPUT = 65536
STATUSES = {"PASS", "FAIL", "WARN", "UNKNOWN", "SKIPPED"}
ENV_NAMES = ("ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY",
             "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
             "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy")
LIMITATIONS = [
    "本工具只报告本次选定范围；不能认证整台机器安全，也不能预测账户限制。",
    "执行位置由使用人声明；无法从 Agent 宿主自动证明受检对象是本人电脑。",
    "干净 CLI 环境不加载用户 shell 初始化文件；日常 login shell 的自定义仍需单独确认。",
    "默认不执行网络探针；已安装 CLI 查询可能有自身行为，本工具没有对官方进程进行网络隔离。",
    "未读取账户秘密、浏览器历史、完整代理配置、代理订阅或模型会话。",
    "DNS 与路由观察不能证明没有泄漏；浏览器 WebRTC、Desktop 登录和系统断线阻断未验证。",
]


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def run(argv, *, env=None, timeout=4, max_output=MAX_OUTPUT):
    """Fixed argv, no shell; capped stdout, stderr discarded, bounded wall time."""
    started = time.monotonic()
    proc = None
    try:
        proc = subprocess.Popen(argv, shell=False, env=env, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, start_new_session=True)
        data = bytearray()
        with selectors.DefaultSelector() as selector:
            selector.register(proc.stdout, selectors.EVENT_READ)
            while selector.get_map():
                remaining = timeout - (time.monotonic() - started)
                if remaining <= 0:
                    os.killpg(proc.pid, signal.SIGKILL)
                    proc.wait(timeout=2)
                    return {"code": None, "error": "timeout", "stdout": ""}
                for key, _ in selector.select(min(remaining, 0.2)):
                    block = os.read(key.fileobj.fileno(), 8192)
                    if not block:
                        selector.unregister(key.fileobj)
                    else:
                        data.extend(block)
                        if len(data) > max_output:
                            os.killpg(proc.pid, signal.SIGKILL)
                            proc.wait(timeout=2)
                            return {"code": None, "error": "output_limit", "stdout": ""}
            remaining = timeout - (time.monotonic() - started)
            code = proc.wait(timeout=max(0.01, remaining))
        return {"code": code, "error": None, "stdout": data.decode("utf-8", "replace")}
    except KeyboardInterrupt:
        if proc is not None and proc.poll() is None:
            os.killpg(proc.pid, signal.SIGKILL)
            proc.wait(timeout=2)
        raise
    except (OSError, subprocess.SubprocessError):
        if proc is not None and proc.poll() is None:
            os.killpg(proc.pid, signal.SIGKILL)
            proc.wait(timeout=2)
        return {"code": None, "error": "command_unavailable", "stdout": ""}
    finally:
        if proc is not None and proc.stdout:
            proc.stdout.close()


def clean_env():
    result = {"PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
              "LANG": "en_US.UTF-8", "DISABLE_AUTOUPDATER": "1",
              "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"}
    # HOME is needed for the official auth status lookup, but never exported.
    for name in ("HOME", "USER", "LOGNAME", "TMPDIR"):
        if name in os.environ:
            result[name] = os.environ[name]
    return result


def flags(env):
    return {name: bool(env.get(name)) for name in ENV_NAMES}


def check(check_id, status, observed=None, message="", remediation="", *, required=False,
          source="local_detector", evidence="runtime"):
    assert status in STATUSES
    return {"id": check_id, "status": status, "required": required, "observed_at": now(),
            "source": source, "evidence_level": evidence, "observed": observed or {},
            "message": message, "remediation": remediation}


def parse_auth(result):
    if result["error"]:
        return "UNKNOWN", {"collection_error": result["error"]}, "CLI 认证状态采集失败。"
    try:
        value = json.loads(result["stdout"])
    except (ValueError, TypeError):
        return "UNKNOWN", {}, "CLI 认证状态格式不受支持。"
    if not isinstance(value, dict) or not isinstance(value.get("loggedIn"), bool):
        return "UNKNOWN", {}, "CLI 未提供可验证的 loggedIn 字段。"
    observed = {"loggedIn": value["loggedIn"], "exit_code": result["code"]}
    for field, allowed in {"authMethod": {"none", "oauth_token", "api_key", "claude_ai", "console", "oauth"},
                           "apiProvider": {"firstParty", "bedrock", "vertex", "foundry"}}.items():
        if value.get(field) in allowed:
            observed[field] = value[field]
        elif field in value:
            observed[field] = "unrecognized"
    if not value["loggedIn"]:
        return "FAIL", observed, "本次受控干净 CLI 环境没有可用认证；不代表 Desktop 账户状态。"
    if result["code"] != 0:
        return "UNKNOWN", observed, "认证字段与退出状态不一致，需要本人复查。"
    return "PASS", observed, "本次受控干净 CLI 环境报告已登录；尚未验证模型调用或额度。"


def parse_doctor(result):
    text = result["stdout"].lower()
    findings = {"multiple_installations": bool(re.search(r"multiple install|multiple.*installation", text)),
                "last_update_failed": bool(re.search(r"install_failed|last.*update.*fail|update.*failed", text)),
                "credentials_unavailable": bool(re.search(r"no usable credentials|no subscription|not logged in", text))}
    if result["error"]:
        return "UNKNOWN", {"collection_error": result["error"]}, "doctor 未完成。"
    if any(findings.values()):
        return "WARN", findings, "doctor 发现需要复查的线索；退出码成功不能覆盖这些发现。"
    if re.search(r"warning|\berror\b|permission.*denied|could not|unable to|failed|not fetched", text):
        return "UNKNOWN", {"unclassified_diagnostic": True}, "doctor 含未分类告警或采集缺口，不能判为通过。"
    if result["code"] != 0:
        return "UNKNOWN", {"exit_code": result["code"]}, "doctor 未成功完成。"
    if not re.search(r"no installation issues found", text):
        return "UNKNOWN", {}, "doctor 输出格式尚未识别。"
    return "PASS", {"exit_code": 0}, "doctor 完成且未识别已知告警；不能代替网络或账户实测。"


def interface_name(text):
    match = re.search(r"^\s*interface:\s*((?:en|utun|lo|bridge|ppp|awdl|llw)\d+)\s*$", text, re.M)
    return match.group(1) if match else None


def safe_version(text):
    match = re.search(r"\b(\d{1,3}\.\d{1,5}(?:\.\d{1,5}){0,2})\b", text)
    return match.group(1) if match else None


def collect_local(args, checks=None):
    checks = checks if checks is not None else []
    is_mac = platform.system() == "Darwin"
    declared_local = args.run_location == "local_mac" and is_mac
    checks.append(check("execution_scope", "PASS" if declared_local else "UNKNOWN",
                        {"declared": args.run_location, "declaration_verified": False},
                        "受检位置按使用人声明记录。" if declared_local else "受检位置未确认为本地 Mac。",
                        "在待检机器本地执行并确认执行位置。", required=True))
    if not is_mac:
        checks.append(check("macos_supported", "UNKNOWN", {"supported_platform": False},
                            "首版只适配 macOS，此系统未采集。", required=True))
        return checks, {"os": "unsupported"}
    os_result = run(["/usr/bin/sw_vers", "-productVersion"])
    version = safe_version(os_result["stdout"])
    major = int(version.split(".")[0]) if version else 0
    checks.append(check("macos_supported", "PASS" if major >= 13 else "FAIL" if major else "UNKNOWN",
                        {"version": version, "minimum_major": 13}, "读取 macOS 版本要求。", required=True,
                        source="sw_vers"))
    memory = run(["/usr/sbin/sysctl", "-n", "hw.memsize"])
    memory_gib = round(int(memory["stdout"].strip()) / (1024 ** 3), 1) if memory["stdout"].strip().isdigit() else None
    checks.append(check("memory", "PASS" if memory_gib is not None and memory_gib >= 4 else "FAIL" if memory_gib is not None else "UNKNOWN",
                        {"gib": memory_gib, "minimum_gib": 4}, "读取物理内存容量。", required=True, source="sysctl"))
    try:
        free_gib = round(shutil.disk_usage(Path.home()).free / (1024 ** 3), 1)
        checks.append(check("disk", "WARN" if free_gib < 2 else "PASS", {"free_gib": free_gib},
                            "可用磁盘容量为安装维护线索。", source="disk_usage"))
    except OSError:
        checks.append(check("disk", "UNKNOWN", message="无法读取可用磁盘容量。"))
    inherited = flags(os.environ)
    checks.append(check("inherited_environment", "WARN" if inherited["ANTHROPIC_BASE_URL"] or inherited["ANTHROPIC_AUTH_TOKEN"] else "PASS",
                        {"present": inherited, "values_exported": False},
                        "当前进程提供商与代理变量仅记录存在性；第三方入口不等于官方 CLI 入口。",
                        "确认当前 Agent 的启动变量与预期提供商一致。", source="allowlisted_environment"))
    config = Path.home() / ".claude" / "settings.json"
    try:
        if config.exists() and config.stat().st_size <= 524288:
            value = json.loads(config.read_text(encoding="utf-8"))
            env = value.get("env", {}) if isinstance(value, dict) else None
            if not isinstance(env, dict):
                raise ValueError()
            present = flags(env)
            checks.append(check("persistent_environment", "WARN" if present["ANTHROPIC_BASE_URL"] else "PASS",
                                {"present": present}, "仅检查用户级 Claude settings 的选定 env 字段。",
                                source="claude_user_settings_allowlist", evidence="configuration"))
        elif config.exists():
            checks.append(check("persistent_environment", "UNKNOWN", message="用户级 settings 超出支持读取大小。"))
        else:
            checks.append(check("persistent_environment", "SKIPPED", message="用户级 settings 文件不存在；未检查项目级配置。"))
    except (OSError, ValueError, TypeError):
        checks.append(check("persistent_environment", "UNKNOWN", message="用户级 settings 格式或权限不受支持。"))
    candidates = [("homebrew", Path("/opt/homebrew/bin/claude")),
                  ("usr_local", Path("/usr/local/bin/claude")),
                  ("user_local", Path.home() / ".local/bin/claude")]
    found = [{"entry": label, "executable": os.access(path, os.X_OK)} for label, path in candidates if path.exists()]
    usable = next((path for _, path in candidates if path.exists() and os.access(path, os.X_OK)), None)
    checks.append(check("cli_installation", "FAIL" if not usable else "WARN" if len(found) > 1 else "PASS",
                        {"known_entries": found, "selected_entry": next((label for label, path in candidates if path == usable), None)},
                        "只检查固定安装入口；多入口可能存在版本或权限差异。", "确认日常启动使用同一受检入口。",
                        required=True, source="known_cli_paths"))
    if usable:
        version_result = run([str(usable), "--version"], env=clean_env(), timeout=5)
        cli_version = safe_version(version_result["stdout"])
        checks.append(check("cli_version", "PASS" if cli_version and version_result["code"] == 0 else "UNKNOWN",
                            {"version": cli_version}, "记录选定 CLI 版本；不自动升级。", source="claude_version"))
        state, observed, message = parse_auth(run([str(usable), "auth", "status", "--json"], env=clean_env(), timeout=6))
        checks.append(check("cli_auth", state, observed, message, "本人在预期终端入口确认或完成登录。",
                            required=True, source="claude_auth_status"))
        if args.doctor:
            state, observed, message = parse_doctor(run([str(usable), "doctor"], env=clean_env(), timeout=10))
            checks.append(check("cli_doctor", state, observed, message, source="claude_doctor"))
        else:
            checks.append(check("cli_doctor", "SKIPPED", message="未选择 doctor；其官方诊断可能请求网络。"))
    else:
        checks.append(check("cli_auth", "UNKNOWN", message="固定入口中没有可执行 CLI。", required=True))
        checks.append(check("cli_doctor", "SKIPPED", message="没有可用 CLI。"))
    desktop_paths = [Path("/Applications/Claude.app"), Path.home() / "Applications/Claude.app"]
    desktop = next((path for path in desktop_paths if path.exists()), None)
    desktop_version = None
    if desktop:
        import plistlib
        try:
            plist_path = desktop / "Contents/Info.plist"
            if plist_path.stat().st_size <= 524288:
                with plist_path.open("rb") as handle:
                    desktop_version = safe_version(str(plistlib.load(handle).get("CFBundleShortVersionString", "")))
        except (OSError, ValueError, TypeError, plistlib.InvalidFileException):
            pass
    checks.append(check("desktop_installation", "PASS" if desktop else "SKIPPED",
                        {"installed": bool(desktop), "version": desktop_version},
                        "读取固定位置的 Desktop 安装元数据。" if desktop else "未发现固定位置 Desktop 安装。",
                        source="desktop_bundle_metadata", evidence="configuration"))
    checks.append(check("desktop_auth", "UNKNOWN", message="未读取 Desktop 私有凭据，登录状态需本人确认。"))
    proxy = run(["/usr/sbin/scutil", "--proxy"])
    proxy_info = {}
    for field in ("HTTPEnable", "HTTPSEnable", "SOCKSEnable", "ProxyAutoConfigEnable", "HTTPPort", "HTTPSPort"):
        match = re.search(r"^\s*" + field + r"\s*:\s*(\d{1,5})\s*$", proxy["stdout"], re.M)
        if match:
            proxy_info[field] = int(match.group(1))
    checks.append(check("system_proxy", "PASS" if proxy["code"] == 0 and proxy_info else "UNKNOWN",
                        proxy_info, "只记录系统代理开关与端口；未记录主机、PAC URL 或例外地址。",
                        source="scutil_proxy"))
    dns = run(["/usr/sbin/scutil", "--dns"])
    resolvers = len(re.findall(r"^resolver #\d+", dns["stdout"], re.M))
    checks.append(check("dns_configuration", "PASS" if dns["code"] == 0 and resolvers else "UNKNOWN",
                        {"resolver_count": resolvers, "scoped_resolvers": "Scoped" in dns["stdout"]},
                        "只读取解析器数量；无法由配置证明查询路径或泄漏情况。", source="scutil_dns", evidence="configuration"))
    for family, argv in (("ipv4", ["/sbin/route", "-n", "get", "default"]),
                         ("ipv6", ["/sbin/route", "-n", "get", "-inet6", "default"])):
        result = run(argv)
        interface = interface_name(result["stdout"])
        checks.append(check("route_" + family, "PASS" if interface else "UNKNOWN",
                            {"interface": interface, "default_observed": bool(interface)},
                            "默认路由观察；不能证明全部应用都经过该接口。", source="route_get"))
    pf = run(["/sbin/pfctl", "-s", "info"])
    enabled = re.search(r"^Status:\s+(Enabled|Disabled)\b", pf["stdout"], re.M)
    checks.append(check("pf_runtime", "WARN" if enabled and enabled.group(1) == "Disabled" else "PASS" if enabled else "UNKNOWN",
                        {"enabled": enabled.group(1) == "Enabled"} if enabled else {"permission_or_format_unverified": True},
                        "PF 运行开关可见；尚未证明出站规则。" if enabled else "非管理员未能验证 PF 运行状态；不能据此判断 PF 不存在。",
                        source="pfctl_info"))
    checks.append(check("fault_protection", "UNKNOWN", message="没有执行整机断线、代理退出或重启故障演练。",
                        remediation="在本人确认的维护窗口单独验证。", evidence="system_fault_drill"))
    checks.append(check("browser_webrtc", "UNKNOWN", message="本地核心没有控制用户的日常浏览器；请使用网页检测并核对浏览器资料。"))
    return checks, {"os": "macOS", "version": version, "architecture": platform.machine() if platform.machine() in {"arm64", "x86_64"} else "unrecognized"}


def validate_proxy(value):
    parsed = urlparse(value)
    if (parsed.scheme != "http" or parsed.hostname != "127.0.0.1" or
            parsed.username or parsed.password or parsed.path not in {"", "/"} or parsed.query or parsed.fragment):
        raise argparse.ArgumentTypeError("代理只支持无凭据的本地 HTTP 地址，格式 http://127.0.0.1:端口")
    try:
        port = parsed.port
    except ValueError as exc:
        raise argparse.ArgumentTypeError("代理端口无效") from exc
    if not port or not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("必须显式指定本地代理端口")
    return f"http://127.0.0.1:{port}"


def curl_command(url, proxy=None):
    argv = ["/usr/bin/curl", "-q", "--silent", "--show-error", "--connect-timeout", "3",
            "--max-time", "6", "--max-filesize", "8192", "--proto", "=https", "--tlsv1.2"]
    if proxy:
        argv += ["--proxy", proxy, "--noproxy", ""]
    argv += ["--write-out", "\nCHECK_HTTP_STATUS:%{http_code}", url]
    return argv


def parse_probe(result, kind, aliases):
    if result["error"]:
        return "UNKNOWN", {"collection_error": result["error"]}, "探针采集未完成；未更换路径重试。"
    if result["code"] != 0:
        status = "FAIL" if result["code"] == 7 else "UNKNOWN"
        return status, {"curl_exit_code": result["code"]}, "所选路径无法完成探针；不推断账户封禁。"
    parts = result["stdout"].rsplit("\nCHECK_HTTP_STATUS:", 1)
    if len(parts) != 2 or not re.fullmatch(r"\d{3}", parts[1].strip()):
        return "UNKNOWN", {}, "探针响应格式未识别。"
    status_code = int(parts[1].strip())
    if status_code != 200:
        return "UNKNOWN", {"http_status": status_code}, "端点拒绝、限流或挑战不等于账户封禁。"
    body = parts[0].strip()
    if kind == "cloudflare":
        fields = dict(line.split("=", 1) for line in body.splitlines() if "=" in line)
        raw = fields.get("ip", "")
    else:
        fields, raw = {}, body
    try:
        address = ipaddress.ip_address(raw)
    except ValueError:
        return "UNKNOWN", {"http_status": status_code}, "响应未提供可验证的 IP 地址。"
    if not address.is_global:
        return "UNKNOWN", {}, "响应不是可验证的公网地址。"
    key = str(address)
    if key not in aliases:
        aliases[key] = f"IPv{address.version}-{secrets.token_hex(4)}"
    observed = {"http_status": status_code, "family": "IPv" + str(address.version), "address_alias": aliases[key]}
    if re.fullmatch(r"[A-Z]{2}", fields.get("loc", "")):
        observed["endpoint_reported_country"] = fields["loc"]
    return "PASS", observed, "本次选定路径得到公网出口响应；地区字段只是端点的 IP 归属观察。"


def compare_addresses(checks):
    groups = {}
    counts = {}
    for item in checks:
        observed = item["observed"]
        if item["status"] == "PASS" and "address_alias" in observed:
            groups.setdefault(observed["family"], set()).add(observed["address_alias"])
            counts[observed["family"]] = counts.get(observed["family"], 0) + 1
    drift = any(len(values) > 1 for values in groups.values())
    verified = sorted(family for family, count in counts.items() if count >= 2)
    return check("network_consistency", "WARN" if drift else "PASS" if verified else "UNKNOWN",
                 {"families_observed": sorted(groups), "same_family_multiple_addresses": drift,
                  "samples_per_family": counts, "families_compared": verified},
                 "同族探针出现多个地址，可能由出口或端点路由差异引起，需复测。" if drift else
                 "仅对有两个以上样本的地址族比较；其余不足以判断稳定性。IPv4 与 IPv6 地址不同不判定分流异常。",
                 evidence="normal_probe")


def collect_network(args):
    if not args.network:
        return [check("network_probe", "SKIPPED", message="未选择主动联网；没有测量公网出口。", evidence="normal_probe")]
    env = {key: value for key, value in clean_env().items() if "PROXY" not in key.upper()}
    aliases = {}
    items = []
    for kind, url in (("ipv4", "https://api.ipify.org"), ("ipv6", "https://api6.ipify.org"),
                      ("cloudflare", "https://www.cloudflare.com/cdn-cgi/trace")):
        result = run(curl_command(url, args.proxy), env=env, timeout=7, max_output=16384)
        state, observed, message = parse_probe(result, kind, aliases)
        if kind in {"ipv4", "ipv6"} and state == "PASS" and observed["family"] != {"ipv4": "IPv4", "ipv6": "IPv6"}[kind]:
            state, message = "UNKNOWN", "专用端点返回的地址族与预期不符。"
        items.append(check("network_" + kind, state, observed, message,
                           "确认选定代理或当前系统路径；工具不执行直连兜底。", required=kind == "ipv4",
                           source="https_anonymous_" + kind, evidence="normal_probe"))
    items.append(compare_addresses(items))
    return items


def aggregate(checks):
    if any(item["status"] == "FAIL" for item in checks):
        return "ISSUES_FOUND", 1
    if any(item["required"] and item["status"] != "PASS" for item in checks):
        return "INCOMPLETE", 3
    if any(item["status"] == "WARN" for item in checks):
        return "ISSUES_FOUND", 1
    return "VERIFIED_IN_SCOPE", 0


def redact(value):
    """Defense in depth. Structured observations should already contain no secrets."""
    if isinstance(value, dict):
        return {key: ("[REDACTED]" if re.search(r"(?i)^(password|token|secret|cookie|authorization|api_key|email|username)$", key) else redact(item)) for key, item in value.items()}
    if isinstance(value, list):
        return [redact(item) for item in value]
    if not isinstance(value, str):
        return value
    value = re.sub(r"https?://[^\s<>\"']+", "[URL_REDACTED]", value)
    value = re.sub(r"(?:/Users/|/home/)[^\s<>\"']+", "[PATH_REDACTED]", value)
    value = re.sub(r"\b(?:sk-|sk_ant_|sk-ant-)[A-Za-z0-9_-]+", "[SECRET_REDACTED]", value)
    value = re.sub(r"(?i)\bBearer\s+[A-Za-z0-9._~+/-]+=*", "[SECRET_REDACTED]", value)
    value = re.sub(r"(?i)\b(?:password|token|secret|api_key|authorization)\s*[:=]\s*[^\s,;]+", "[SECRET_REDACTED]", value)
    value = re.sub(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", "[EMAIL_REDACTED]", value)
    # Tokenize candidate IPs; do not mistake a three-component version for IPv4.
    value = re.sub(r"(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])", "[IP_REDACTED]", value)
    def redact_ipv6(match):
        try:
            address = ipaddress.ip_address(match.group(0))
        except ValueError:
            return match.group(0)
        return "[IP_REDACTED]" if address.version == 6 else match.group(0)
    value = re.sub(r"(?<![\w])(?:[0-9A-Fa-f]{0,4}:){2,}[0-9A-Fa-f:.%]+(?![\w])", redact_ipv6, value)
    return value


def atomic_write(path, content):
    fd, name = tempfile.mkstemp(prefix=".report-", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def markdown(report):
    lines = ["# Claude 环境检查", "", f"检查时间：{report['checked_at']}。", "",
             f"结果：{report['overall']}。执行位置声明：{report['run_location']}。", "",
             "结果只针对所列范围。UNKNOWN 与 SKIPPED 均不表示通过。", "",
             "| 检查项 | 状态 | 必检 | 发现 | 下一步 |", "| :--- | :--- | :--- | :--- | :--- |"]
    for item in report["checks"]:
        cells = [item["id"], item["status"], "是" if item["required"] else "否", item["message"], item["remediation"]]
        lines.append("| " + " | ".join(str(cell).replace("|", "／").replace("\n", " ") for cell in cells) + " |")
    lines += ["", "## 覆盖限制", ""] + ["* " + entry for entry in report["limitations"]]
    lines += ["", "安全字段、证据来源及证据级别见同目录 JSON。", ""]
    return "\n".join(lines)


def save(report, outdir):
    # Each run has an isolated private directory; never chmod an existing shared directory.
    root = Path(outdir).expanduser()
    root.mkdir(parents=True, exist_ok=True)
    private = root / ("check-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + secrets.token_hex(3))
    private.mkdir(mode=0o700)
    clean = redact(report)
    atomic_write(private / "report.json", json.dumps(clean, ensure_ascii=False, indent=2) + "\n")
    atomic_write(private / "report.md", markdown(clean))
    return private


def main(argv=None):
    parser = argparse.ArgumentParser(description="Claude 环境只读检查；默认不执行网络探针。不导出凭据，不修复配置。")
    parser.add_argument("--run-location", choices=("unknown", "local_mac", "ssh", "container", "cloud"), default="unknown")
    parser.add_argument("--out-dir", default="./claude-check-reports")
    parser.add_argument("--network", action="store_true", help="请求三个固定匿名 HTTPS 出口端点，可能暴露当前出口给端点")
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--proxy", type=validate_proxy)
    selection.add_argument("--path", choices=("system",), help="当前 curl/TUN 路径，不表示 curl 自动采用 macOS HTTP 代理设置")
    parser.add_argument("--doctor", action="store_true", help="执行官方 doctor；可能请求官方网络，禁止自动更新")
    args = parser.parse_args(argv)
    if args.network and not (args.proxy or args.path):
        parser.error("主动联网必须显式选择 --proxy 或 --path system")
    if not args.network and (args.proxy or args.path):
        parser.error("网络路径只用于显式 --network 模式")
    report = {"schema_version": SCHEMA_VERSION, "tool_version": TOOL_VERSION, "checked_at": now(),
              "run_location": args.run_location, "scope": {"local": True, "network": args.network, "doctor": args.doctor,
              "network_path": "explicit_local_http_proxy" if args.proxy else "current_curl_system_path" if args.path else "not_tested",
              "destinations": ["api.ipify.org", "api6.ipify.org", "www.cloudflare.com"] if args.network else []},
              "platform": {}, "overall": "INCOMPLETE", "checks": [], "limitations": list(LIMITATIONS)}
    code = 2
    try:
        report["checks"], report["platform"] = collect_local(args, report["checks"])
        report["checks"].extend(collect_network(args))
        report["overall"], code = aggregate(report["checks"])
    except KeyboardInterrupt:
        report["checks"].append(check("runner_interrupted", "UNKNOWN", message="任务中断，未完成采集不能视为通过。", required=True))
        report["overall"] = "INCOMPLETE"
        code = 2
    except Exception:
        report["checks"].append(check("runner_failure", "UNKNOWN", message="运行器失败；不导出异常原文以避免泄露本机数据。", required=True))
        report["overall"] = "INCOMPLETE"
        code = 2
    try:
        private = save(report, args.out_dir)
    except OSError:
        print("无法写入私有报告目录。", file=sys.stderr)
        return 2
    print(f"{report['overall']}，退出码 {code}。报告目录：{private}")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
