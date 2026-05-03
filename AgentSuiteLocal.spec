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
    app = BUNDLE(
        coll,
        name="AgentSuiteLocal.app",
        icon=str(ROOT / "agentsuitelocal" / "assets" / "icon.ico"),
        bundle_identifier="com.scottconverse.agentsuitelocal",
        info_plist={
            "CFBundleShortVersionString": "0.7.0",
            "CFBundleName": "AgentSuiteLocal",
            "NSHighResolutionCapable": True,
            "LSUIElement": False,           # Show in Dock
        },
    )
