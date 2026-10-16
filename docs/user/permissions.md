# Let Bezel open the screen

[Português (Brasil)](pt-BR/permissions.md)

Studio and Light never ask for administrator rights and never install drivers.
Most screens work as soon as they are plugged in; a few need a driver once.

- **Serial screens** (Turing rev A and rev C, XuanFang, Kipye, WeAct): Windows'
  own driver (usbser) handles them; they appear as COM ports. Nothing to install.
- **Turing USB generation (USB id `1CBE:xxxx`) and WCH panels (`43A8:xxxx`):**
  they need the WinUSB driver. If Studio's screen selector (or `bezel devices`)
  does not list the screen and Device Manager shows it without a driver:
  1. Download Zadig from [zadig.akeo.ie](https://zadig.akeo.ie).
  2. In Zadig, choose **Options → List All Devices**, then pick the screen in the
     list (check that the USB ID starts with `1CBE` or `43A8`).
  3. Select **WinUSB** as the driver and click **Install Driver** (or
     **Replace Driver**).

  To undo it, open Device Manager, right-click the screen, choose **Uninstall
  device** and tick the option that deletes the driver.
- **Turing USB panels in desktop mode** use Windows' HID driver: nothing to
  install. See [Supported screens](devices.md#desktop-mode).
- **Sensors:** CPU temperature, fans and power come from the bundled hardware
  sensor reader. Setup configures it (the only step that asks for administrator
  approval); see [Sensors](sensors.md#the-hardware-sensor-reader).

Only one program can use a screen at a time. If Bezel says the screen is in use,
quit the other program first: [Troubleshooting](troubleshooting.md#the-screen-is-in-use-access-denied).
