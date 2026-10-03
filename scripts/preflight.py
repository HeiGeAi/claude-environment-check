#!/usr/bin/env python3
"""Deterministic public source scan. Prints locations, never matched secrets."""
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
PATTERNS = {
    "private_key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "github_token": re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,})\b"),
    "model_secret": re.compile(r"\b(?:sk-ant-[A-Za-z0-9_-]{25,}|sk-[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,})\b"),
    "personal_email": re.compile(r"\b[A-Za-z0-9._%+-]+@(?!example\.(?:com|test)\b|users\.noreply\.github\.com\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "private_machine_path": re.compile(r"/Users/(?!YOU\b|example\b|alice\b)[\w.-]+/"),
}
def main():
    files = subprocess.run(['git', '-C', str(ROOT), 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], capture_output=True, text=True, check=True).stdout.strip('\0').split('\0')
    problems = []
    for name in files:
        file = ROOT / name
        parts = Path(name).parts
        if 'claude-check-reports' in parts or file.name in {'report.json', 'report.md', 'browser-qa.json'} or file.suffix in {'.bundle', '.skill', '.zip'}:
            problems.append((name, 0, 'private_runtime_or_archive'))
            continue
        if file.suffix.lower() in {'.woff2', '.webp', '.png', '.jpg', '.zip'}:
            continue
        if file.stat().st_size > 2 * 1024 * 1024:
            problems.append((name, 0, 'unexpected_large_source'))
            continue
        for number, line in enumerate(file.read_text(encoding='utf-8', errors='replace').splitlines(), 1):
            for label, pattern in PATTERNS.items():
                if pattern.search(line):
                    problems.append((name, number, label))
    skill = ROOT / 'skills/claude-environment-check/SKILL.md'
    text = skill.read_text()
    frontmatter = re.match(r'^---\n(.*?)\n---', text, re.S)
    if not frontmatter or not re.search(r'^name: claude-environment-check$', frontmatter.group(1), re.M) or not re.search(r'^description: .+', frontmatter.group(1), re.M):
        problems.append((str(skill.relative_to(ROOT)), 1, 'skill_frontmatter'))
    if not (skill.parent / 'scripts/check.py').is_file():
        problems.append((str(skill.relative_to(ROOT)), 0, 'missing_bundled_core'))
    for filename, line, label in problems:
        print(f'FAIL {filename}:{line} {label}')
    print(f'Public source preflight: {len(files)} files, {len(problems)} findings.')
    return 1 if problems else 0

if __name__ == '__main__':
    sys.exit(main())
