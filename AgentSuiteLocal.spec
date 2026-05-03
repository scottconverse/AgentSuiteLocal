# -*- mode: python ; coding: utf-8 -*-
#
# PyInstaller spec for AgentSuiteLocal.
#
# Build:
#   Windows:  pyinstaller AgentSuiteLocal.spec
#   macOS:    pyinstaller AgentSuiteLocal.spec
#
# Output: dist/AgentSuiteLocal/  (one-dir, faster cold start than one-file)
#
# The frontend must be built before running PyInstaller:
#   cd web && npm ci && npm run build
#
# --windowed / --noconsole suppresses the terminal on Windows and macOS.
# On macOS this also creates a proper .app bundle in dist/.

import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_all

ROOT = Path(SPECPATH)
WEB_DIST = ROOT / "web" / "dist"

block_cipher = None

# Collect all agentsuite code + data (jinja2 prompts, md templates, etc.)
_as_datas, _as_binaries, _as_hiddenimports = collect_all("agentsuite")

a = Analysis(
    [str(ROOT / "launcher.py")],
    pathex=[str(ROOT)],
    binaries=_as_binaries,
    datas=[
        # Bundle the pre-built frontend; accessible at sys._MEIPASS/web/dist at runtime.
        (str(WEB_DIST), "web/dist"),
    ] + _as_datas,
    hiddenimports=_as_hiddenimports + [
        # uvicorn internals not always auto-detected
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.protocols.websockets.websockets_impl",
        "uvicorn.protocols.websockets.wsproto_impl",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.logging",
        # FastAPI / Starlette internals
        "starlette.routing",
        "starlette.middleware.cors",
        "starlette.staticfiles",
        "starlette.responses",
        # SSE
        "sse_starlette",
        "sse_starlette.sse",
        # psutil platform modules
        "psutil._pslinux",
        "psutil._pswindows",
        "psutil._psosx",
        # httpx transport
        "httpx._transports.default",
        "httpx._transports.asgi",
        # email / multipart (FastAPI dependency)
        "email.mime.multipart",
        "email.mime.text",
        "multipart",
        "python_multipart",
        # pydantic v2
        "pydantic.deprecated.class_validators",
        "pydantic_core",
        # agentsuitelocal dynamic imports
        "agentsuite.pipeline.orchestrator",
        "agentsuite.pipeline.schema",
        "agentsuite.kernel.base_agent",
        "agentsuite.llm.ollama",
        "agentsuite.llm.resolver",
        # Jinja2 (agentsuite prompt templates)
        "jinja2",
        "jinja2.ext",
        "jinja2.loaders",
        "markupsafe",
        # agentsuite runtime deps
        "tenacity",
        "anthropic",
        "ollama",
        "openai",
        "mcp",
        # S-2: keyring — OS keychain for API key storage
        "keyring",
        "keyring.backends",
        "keyring.backends.Windows",
        "keyring.backends.macOS",
        "keyring.backends.SecretService",
        "keyring.backends.null",
        # weasyprint — optional PDF export (requires pango/cairo on the system)
        "weasyprint",
        "weasyprint.css",
        "weasyprint.document",
        "weasyprint.html",
        "weasyprint.text",
        "weasyprint.images",
        "weasyprint.formatting_structure",
        "tinycss2",
        "cssselect2",
        "cairocffi",
        "cffi",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Keep the bundle lean — test frameworks not needed at runtime
        "pytest",
        "pytest_asyncio",
        "playwright",
        "IPython",
        "jupyter",
        "notebook",
        "tkinter",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="AgentSuiteLocal",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(ROOT / "agentsuitelocal" / "assets" / "icon.ico"),
    # N-2: Per-Monitor DPI v2 awareness manifest — crisp on HiDPI / multi-monitor.
    # The manifest also declares Windows 10/11 compatibility and long-path support.
    manifest=str(ROOT / "agentsuitelocal" / "assets" / "AgentSuiteLocal.manifest")
    if sys.platform == "win32" else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="AgentSuiteLocal",
)

# macOS: wrap in a .app bundle
if sys.platform == "darwin":
    # M-6: macOS requires .icns (not .ico). Generate icon.icns from brand assets
    # on macOS using: python scripts/generate_icns.py  (requires Pillow + iconutil)
    _mac_icon = ROOT / "agentsuitelocal" / "assets" / "icon.icns"
    if not _mac_icon.exists():
        _mac_icon = ROOT / "agentsuitelocal" / "assets" / "icon.ico"  # fallback for CI
    # m-4: derive version from __version__.py instead of hardcoding
    import sys as _sys
    _sys.path.insert(0, str(ROOT))
    try:
        from agentsuitelocal.__version__ import __version__ as _APP_VERSION
    except ImportError:
        _APP_VERSION = "0.7.0"
    app = BUNDLE(
        coll,
        name="AgentSuiteLocal.app",
        icon=str(_mac_icon),
        bundle_identifier="com.scottconverse.agentsuitelocal",
        info_plist={
            "CFBundleShortVersionString": _APP_VERSION,
            "CFBundleName": "AgentSuiteLocal",
            "NSHighResolutionCapable": True,
            "LSUIElement": False,           # Show in Dock
        },
    )
