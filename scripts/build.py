"""Create a deterministic install ZIP from an explicit runtime allowlist."""
from pathlib import Path
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / "extension"
manifest = json.loads((EXT / "manifest.json").read_text(encoding="utf-8-sig"))
version = manifest["version"]
assert re.fullmatch(r"\d+\.\d+\.\d+", version)
for a, b in [("shared.js", "page-core.js"), ("project.js", "project-core.js")]:
    assert (EXT / a).read_bytes() == (EXT / b).read_bytes(), f"Mirror mismatch: {a}, {b}"
files = sorted(p for p in EXT.iterdir() if p.is_file() and (p.suffix in {".js", ".html", ".css"} or p.name == "manifest.json"))
for directory in ["icons", "_locales"]:
    files.extend(sorted(p for p in (EXT / directory).rglob("*") if p.is_file()))
for script in manifest["content_scripts"]:
    assert all((EXT / name).is_file() for name in script["js"])
entries = [(p, "crh-monitor/" + p.relative_to(EXT).as_posix()) for p in files]
entries.extend((ROOT / name, "crh-monitor/" + name) for name in ["README.md", "README.ru.md", "LICENSE"])
assert len({name for _, name in entries}) == len(entries)
for file, name in entries:
    assert not any(x in name.lower() for x in [".har", "snapshots", "tests/", "node_modules"]), name
    if file.suffix in {".js", ".json", ".html", ".md"}:
        text = file.read_text(encoding="utf-8-sig")
        if file.name == "shared.js":
            assert 'const DEFAULT_WALLET = "";' in text, "Do not ship a preset personal wallet"
out = ROOT / "dist"
out.mkdir(exist_ok=True)
archive = out / f"crh-monitor-v{version}.zip"
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for file, name in sorted(entries, key=lambda item: item[1]):
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, file.read_bytes())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert "crh-monitor/manifest.json" in z.namelist()
print(f"Built {archive.name}: {len(entries)} files, {archive.stat().st_size:,} bytes")
