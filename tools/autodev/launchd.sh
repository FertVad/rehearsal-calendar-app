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
# until allowed: System Settings → Privacy & Security → Full Disk Access → node.
# Without it the supervisor's log says "Operation not permitted".
#
# The log itself is not on the Desktop: launchd opens the stdout path before
# node starts, and launchd cannot be allowed a folder. From macOS 27 (27.11.2026)
# a log there stopped every start with exit 78, "Unable to open stdout path ...
# Operation not permitted", and nothing in the log to say so. It lives in
# ~/Library/Logs; AUTODEV/.state/supervisor.log is a link to it.
set -euo pipefail

LABEL=com.rehearsly.autodev
REPO=${0:A:h:h:h}
NODE=${AUTODEV_NODE:-$HOME/.nvm/versions/node/v26.13.0/bin/node}
PLIST=$HOME/Library/LaunchAgents/$LABEL.plist
LOG=$HOME/Library/Logs/rehearsly-autodev.log
LINK=$REPO/AUTODEV/.state/supervisor.log

case ${1:-status} in
  install)
    mkdir -p "$REPO/AUTODEV/.state" "${PLIST:h}" "${LOG:h}"
    # The log of the days before it moved goes with it.
    if [[ -f $LINK && ! -L $LINK ]]; then cat "$LINK" >> "$LOG"; rm "$LINK"; fi
    ln -sfn "$LOG" "$LINK"
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
