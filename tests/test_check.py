"""Synthetic fixtures only; no developer machine snapshot or live network lookup.

Versions, ports and dates below are invented fixtures. Public resolver addresses
are synthetic response inputs needed by the public-address validation tests.
These tests verify semantics, not whole-machine network protection.
"""
import argparse
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "skills/claude-environment-check/scripts/check.py"
spec = importlib.util.spec_from_file_location("local_check", SCRIPT)
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)


def result(text="", code=0, error=None):
    return {"stdout": text, "code": code, "error": error}


class AuthTests(unittest.TestCase):
    def test_not_logged_in_is_cli_failure(self):
        state, observed, _ = core.parse_auth(result(json.dumps({"loggedIn": False, "authMethod": "none",
                                               "apiProvider": "firstParty", "token": "synthetic-secret"}), 1))
        self.assertEqual(state, "FAIL")
        self.assertNotIn("token", observed)
        self.assertEqual(observed["apiProvider"], "firstParty")

    def test_whitelist_never_echoes_injected_value(self):
        state, observed, _ = core.parse_auth(result(json.dumps({"loggedIn": True,
                                               "authMethod": "https://secret.example/token", "email": "test@example.com"})))
        self.assertEqual(state, "PASS")
        self.assertEqual(observed["authMethod"], "unrecognized")
        self.assertNotIn("email", observed)

    def test_malformed_and_boolean_string_unknown(self):
        for value in ("bad-json", "[]", '{"loggedIn":"false"}', "{}"): 
            self.assertEqual(core.parse_auth(result(value))[0], "UNKNOWN")

    def test_conflicting_exit_is_unknown(self):
        self.assertEqual(core.parse_auth(result('{"loggedIn":true}', 1))[0], "UNKNOWN")

    def test_subprocess_failure_unknown(self):
        self.assertEqual(core.parse_auth(result(error="timeout"))[0], "UNKNOWN")


class DoctorTests(unittest.TestCase):
    def test_zero_exit_does_not_override_warning(self):
        state, observed, _ = core.parse_doctor(result("Multiple installations found. Last update failed install_failed. No installation issues found."))
        self.assertEqual(state, "WARN")
        self.assertTrue(observed["multiple_installations"])
        self.assertTrue(observed["last_update_failed"])

    def test_empty_success_unknown(self):
        self.assertEqual(core.parse_doctor(result())[0], "UNKNOWN")

    def test_generic_or_problem_output_does_not_pass(self):
        for text in ("claude installation", "Claude permissions denied", "Claude network error", "warning could not verify", "No installation issues found. Managed settings not fetched."):
            self.assertEqual(core.parse_doctor(result(text))[0], "UNKNOWN")
        self.assertEqual(core.parse_doctor(result("No installation issues found."))[0], "PASS")


class NetworkTests(unittest.TestCase):
    def test_dual_stack_not_drift(self):
        aliases = {}
        s4, o4, _ = core.parse_probe(result("8.8.8.8\nCHECK_HTTP_STATUS:200"), "ipv4", aliases)
        s6, o6, _ = core.parse_probe(result("2606:4700:4700::1111\nCHECK_HTTP_STATUS:200"), "ipv6", aliases)
        sc, oc, _ = core.parse_probe(result("ip=2606:4700:4700::1111\nloc=US\nCHECK_HTTP_STATUS:200"), "cloudflare", aliases)
        items = [core.check("v4", s4, o4), core.check("v6", s6, o6), core.check("cf", sc, oc)]
        summary = core.compare_addresses(items)
        self.assertEqual(summary["status"], "PASS")
        self.assertFalse(summary["observed"]["same_family_multiple_addresses"])
        self.assertEqual(o6["address_alias"], oc["address_alias"])
        self.assertNotIn("8.8.8.8", json.dumps(items))
        self.assertNotIn("2606:4700", json.dumps(items))

    def test_same_family_difference_warns(self):
        aliases = {}
        items = []
        for ip in ("8.8.8.8", "1.1.1.1"):
            state, observed, message = core.parse_probe(result(ip + "\nCHECK_HTTP_STATUS:200"), "ipv4", aliases)
            items.append(core.check("probe", state, observed, message))
        self.assertEqual(core.compare_addresses(items)["status"], "WARN")

    def test_single_observation_is_not_consistency(self):
        state, observed, _ = core.parse_probe(result("8.8.8.8\nCHECK_HTTP_STATUS:200"), "ipv4", {})
        self.assertEqual(core.compare_addresses([core.check("probe", state, observed)])["status"], "UNKNOWN")

    def test_challenge_and_timeout_not_ban(self):
        for response in (result("challenge\nCHECK_HTTP_STATUS:403"), result("limit\nCHECK_HTTP_STATUS:429"), result(code=28)):
            self.assertEqual(core.parse_probe(response, "ipv4", {})[0], "UNKNOWN")

    def test_unreachable_selected_path_fails(self):
        self.assertEqual(core.parse_probe(result(code=7), "ipv4", {})[0], "FAIL")

    def test_never_direct_fallback_or_inherited_proxy(self):
        args = argparse.Namespace(network=True, proxy="http://127.0.0.1:1", path=None)
        with patch.object(core, "run", return_value=result(code=7)) as mocked:
            items = core.collect_network(args)
        self.assertEqual(mocked.call_count, 3)
        for call in mocked.call_args_list:
            argv = call.args[0]
            self.assertEqual(argv[argv.index("--proxy") + 1], args.proxy)
            self.assertEqual(argv[argv.index("--noproxy") + 1], "")
            self.assertNotIn("--insecure", argv)
            self.assertNotIn("--location", argv)
            self.assertTrue(all("PROXY" not in key.upper() for key in call.kwargs["env"]))
        self.assertTrue(all(item["status"] == "FAIL" for item in items[:3]))

    def test_proxy_rejects_auth_remote_and_invalid_ports(self):
        for proxy in ("socks5://127.0.0.1:1080", "http://user:pass@127.0.0.1:1080", "http://example.com:8080",
                      "http://127.0.0.1", "http://127.0.0.1:99999", "http://127.0.0.1:8?q=secret"):
            with self.assertRaises(argparse.ArgumentTypeError):
                core.validate_proxy(proxy)
        self.assertEqual(core.validate_proxy("http://127.0.0.1:45678"), "http://127.0.0.1:45678")


class SafetyTests(unittest.TestCase):
    def test_redaction(self):
        payload = {"token": "synthetic-hidden", "message": "https://example.com/sub?token=synthetic /Users/example/private 192.168.1.5 2606:4700::1111 sk-ant-test123 Bearer test.token password=abc test@example.com",
                   "version": "9.8.765", "aliases": ["IPv4-aabbccdd"], "present": {"ANTHROPIC_AUTH_TOKEN": True}}
        exported = json.dumps(core.redact(payload))
        for secret in ("synthetic-hidden", "example.com", "/Users/example", "192.168.1.5", "2606:4700", "sk-ant-test123", "test.token", "password=abc"):
            self.assertNotIn(secret, exported)
        self.assertIn("9.8.765", exported)
        self.assertIn("IPv4-aabbccdd", exported)
        self.assertIn("ANTHROPIC_AUTH_TOKEN", exported)

    def test_timestamps_are_preserved_exactly(self):
        stamp = "2001-02-03T04:12:23.234+00:00"
        self.assertEqual(core.redact({"checked_at": stamp, "observed_at": stamp}), {"checked_at": stamp, "observed_at": stamp})

    def test_subprocess_bounds_and_unavailable(self):
        self.assertEqual(core.run(["/path/does/not/exist"])["error"], "command_unavailable")
        flooding = core.run([sys.executable, "-c", "print('a'*100000)"], max_output=1024)
        self.assertEqual(flooding["error"], "output_limit")
        self.assertEqual(flooding["stdout"], "")
        timeout = core.run([sys.executable, "-c", "import time;time.sleep(2)"], timeout=0.1)
        self.assertEqual(timeout["error"], "timeout")

    def test_reports_atomic_private(self):
        report = {"checked_at": core.now(), "run_location": "local_mac", "overall": "INCOMPLETE",
                  "checks": [core.check("test", "UNKNOWN", message="未完成")], "limitations": []}
        with tempfile.TemporaryDirectory() as directory:
            output = core.save(report, directory)
            self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o700)
            for name in ("report.json", "report.md"):
                self.assertEqual(stat.S_IMODE((output / name).stat().st_mode), 0o600)
            self.assertEqual(json.loads((output / "report.json").read_text())["overall"], "INCOMPLETE")
            self.assertEqual(len(list(output.iterdir())), 2)

    def test_aggregate_unknown_does_not_pass(self):
        self.assertEqual(core.aggregate([core.check("required", "UNKNOWN", required=True)]), ("INCOMPLETE", 3))
        self.assertEqual(core.aggregate([core.check("required", "SKIPPED", required=True)]), ("INCOMPLETE", 3))
        self.assertEqual(core.aggregate([core.check("required", "PASS", required=True), core.check("optional", "UNKNOWN")]), ("VERIFIED_IN_SCOPE", 0))
        self.assertEqual(core.aggregate([core.check("issue", "FAIL")]), ("ISSUES_FOUND", 1))

    def test_scope_requires_explicit_location(self):
        args = argparse.Namespace(run_location="cloud", doctor=False)
        with patch.object(core.platform, "system", return_value="Linux"):
            checks, _ = core.collect_local(args)
        self.assertEqual(checks[0]["status"], "UNKNOWN")
        self.assertEqual(core.aggregate(checks), ("INCOMPLETE", 3))

    def test_interruption_retains_partial_and_marks_incomplete(self):
        def interrupted(args, checks):
            checks.append(core.check("already_observed", "PASS"))
            raise KeyboardInterrupt()
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(core, "collect_local", side_effect=interrupted), contextlib.redirect_stdout(io.StringIO()):
                exit_code = core.main(["--run-location", "local_mac", "--out-dir", directory])
            saved = json.loads(next(Path(directory).glob("check-*/report.json")).read_text())
            self.assertEqual(exit_code, 2)
            self.assertEqual(saved["overall"], "INCOMPLETE")
            self.assertEqual([item["id"] for item in saved["checks"]], ["already_observed", "runner_interrupted"])


if __name__ == "__main__":
    unittest.main()
