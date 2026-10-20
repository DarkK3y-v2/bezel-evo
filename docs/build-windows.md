# Build Bezel Evo on Windows

For a normal installation, use the [Windows releases](https://github.com/jripper77/bezel-evo/releases)
and [installation guide](../packaging/windows/README.md).

## Product builds

Use Rust 1.98 or newer, Microsoft C++ build tools and Edge WebView2.
Node.js/npm are needed for UI checks and packaging. The headless sensor helper
also needs the Windows .NET Framework compiler.

From the repository root:

```powershell
.\scripts\windows\build-evo.ps1
```

This builds CLI and Studio together and increments the patch number in `VERSION`.
Use `-Version X.Y.Z` for a feature release or to retry a failed build under the
same version. Build before replacing executables, and save and close Studio
first so unsaved documents are preserved. Verify the installed executable hashes
after copying. Reuse the existing installation directory.

For the Setup executable, portable ZIP, checksums and source archive:

```powershell
.\scripts\windows\package-evo.ps1 -Version X.Y.Z
```

The [packaging guide](../packaging/windows/README.md#maintainer-build) covers
requirements, payloads and `-SkipBuild`. There is no continuous integration:
the manual [windows-evo-package.yml](../.github/workflows/windows-evo-package.yml)
workflow builds the same packages on GitHub and uploads them as artifacts,
without publishing a release. Bezel Evo is built and supported on Windows only.

## Development builds and manual setup

Build with Rust 1.98 or newer, Microsoft C++ build tools and Edge WebView2:

```powershell
git clone https://github.com/jripper77/bezel-evo.git
cd bezel-evo
cargo build --release --locked -p bezel -p bezel-studio
```

Place `target/release/bezel.exe` and `target/release/bezel-studio.exe` together
in your installation folder, with the scripts from [scripts/windows](../scripts/windows/).
Open Studio, save a theme and select the screens to run.

The integrated sensor helper has a separate build using the Windows .NET
Framework compiler and LibreHardwareMonitorLib. Follow the
[helper build and setup instructions](../apps/bezel-sensors-helper/README.md).
Cargo alone does not bundle the helper or its dependencies.

Run `configure-startup.cmd` as administrator with your normal Windows account
for login setup. Only the hardware reader runs elevated. See the
[Windows launcher guide](../scripts/windows/README.md) for startup, logs and rollback.
If you move the installation folder, update the startup configuration.
If Windows changes a display's COM port, select its current port in Studio.
