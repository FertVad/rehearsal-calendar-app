#!/bin/zsh
# Keeps the supervisor running in the background: started at login, restarted
# if it stops (launchd KeepAlive). It survives reboots and its own crashes; a
# subscription limit it waits out itself.
#
#   tools/autodev/launchd.sh install     start now and at every login
#   tools/autodev/launchd.sh uninstall   stop and remove
#   tools/autodev/launchd.sh status
#
# The repository is on the Desktop, which macOS keeps from background processes
# until allowed: System Settings → Privacy & Security → Files and Folders (or
# Full Disk Access) → node. Without it the supervisor's log says
# "Operation not permitted".
set -euo pipefail

LABEL=com.rehearsly.autodev
REPO=${0:A:h:h:h}
NODE=${AUTODEV_NODE:-$HOME/.nvm/versions/node/v22.16.0/bin/node}
PLIST=$HOME/Library/LaunchAgents/$LABEL.plist
LOG=$REPO/AUTODEV/.state/supervisor.log

case ${1:-status} in
  install)
    mkdir -p "$REPO/AUTODEV/.state" "${PLIST:h}"
    cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$REPO/tools/autodev/supervisor.mjs</string></array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
    launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$UID" "$PLIST"
    echo "installed; log: $LOG"
    ;;
  uninstall)
    launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "removed"
    ;;
  status)
    launchctl print "gui/$UID/$LABEL" 2>/dev/null | grep -E "state =|pid =|last exit" || echo "not installed"
    [[ -f $LOG ]] && tail -5 "$LOG"
    ;;
  *) echo "usage: $0 install|uninstall|status"; exit 2 ;;
esac
