package sshutil

import (
	"fmt"
	"io/ioutil"
	"time"

	"golang.org/x/crypto/ssh"

	"github.com/devatadev/ytlive/ops/backend/models"
	"github.com/devatadev/ytlive/ops/backend/utils/crypto"
)

// DialWithServer opens an SSH connection to the given server using either
// a private-key (preferred) or password authentication. The password is stored
// encrypted in DB and must be decrypted with the provided encryptionKey.
func DialWithServer(s *models.Server, encryptionKey string) (*ssh.Client, error) {
	var auth ssh.AuthMethod

	// Prefer key if path specified and file exists
	if s.SSHKeyPath != "" {
		keyBytes, err := ioutil.ReadFile(s.SSHKeyPath)
		if err == nil {
			signer, err := ssh.ParsePrivateKey(keyBytes)
			if err == nil {
				auth = ssh.PublicKeys(signer)
			}
		}
	}

	// Fall back to password
	if auth == nil {
		if s.SSHPasswordEnc == "" {
			return nil, fmt.Errorf("no SSH auth method available for server %s", s.ID)
		}
		pwd, err := crypto.DecryptString(encryptionKey, s.SSHPasswordEnc)
		if err != nil {
			return nil, fmt.Errorf("decrypt ssh password: %w", err)
		}
		auth = ssh.Password(pwd)
	}

	if s.SSHPort == 0 {
		s.SSHPort = 22
	}

	cfg := &ssh.ClientConfig{
		User:            s.SSHUser,
		Auth:            []ssh.AuthMethod{auth},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // TODO: replace with known_host verification
		Timeout:         10 * time.Second,
	}

	return ssh.Dial("tcp", fmt.Sprintf("%s:%d", s.Address, s.SSHPort), cfg)
}

// RunCommand executes cmd on the remote host and returns combined output.
func RunCommand(client *ssh.Client, cmd string) (string, error) {
	session, err := client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	out, err := session.CombinedOutput(cmd)
	return string(out), err
}
