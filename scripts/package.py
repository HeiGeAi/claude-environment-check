#!/usr/bin/env python3
"""Bundle only the portable skill files; no local reports or generated cache."""
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
output = root / 'dist/downloads'
output.mkdir(parents=True, exist_ok=True)
name = 'claude-environment-check'
with zipfile.ZipFile(output / (name + '.skill'), 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
    for relative in ['SKILL.md', 'scripts/check.py']:
        bundle.write(root / 'skills' / name / relative, name + '/' + relative)
    bundle.write(root / 'LICENSE', name + '/LICENSE')
shutil.copyfile(output / (name + '.skill'), output / (name + '.zip'))
