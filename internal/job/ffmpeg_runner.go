package job

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"syscall"

	"github.com/shirou/gopsutil/v3/process"
)

func GetProcessExitStatus(pid int) (string, error) {
	// First check if process exists and get its status
	proc, err := process.NewProcess(int32(pid))
	if err != nil {
		return "not_running", nil
	}

	status, err := proc.Status()
	if err != nil {
		return "", fmt.Errorf("could not get process status: %v", err)
	}

	// If process is still running
	isZombieOrDead := false
	for _, s := range status {
		if s == "Z" || s == "X" {
			isZombieOrDead = true
			break
		}
	}

	if !isZombieOrDead {
		return "running", nil
	}

	// For zombie or dead processes, check how they died
	cmd := exec.Command("ps", "-o", "stat,command", "-p", strconv.Itoa(pid))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to get process status: %v", err)
	}

	// Check if process was terminated by a signal
	lines := strings.Split(string(out), "\n")
	if len(lines) > 1 {
		// The status is the first character of the first line
		statusLine := strings.TrimSpace(lines[1])
		if len(statusLine) > 0 {
			statusCode := statusLine[0]
			if statusCode == 'T' {
				return "stopped", nil
			} else if statusCode == 'Z' {
				return "zombie", nil
			} else if statusCode == 'X' || statusCode == 'x' {
				return "dead", nil
			}
		}
	}

	// If we get here, check the exit code
	var waitStat syscall.WaitStatus
	rpid, err := syscall.Wait4(pid, &waitStat, syscall.WNOHANG, nil)
	if err != nil {
		return "", fmt.Errorf("wait4 failed: %v", err)
	}

	if rpid == pid {
		if waitStat.Exited() {
			if waitStat.ExitStatus() == 0 {
				return "exited_normally", nil
			}
			return fmt.Sprintf("exited_with_code_%d", waitStat.ExitStatus()), nil
		}

		if waitStat.Signaled() {
			return fmt.Sprintf("killed_by_signal_%d", waitStat.Signal()), nil
		}
	}

	return "unknown", nil
}
