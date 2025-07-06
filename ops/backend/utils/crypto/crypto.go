package crypto

import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "encoding/base64"
    "errors"
    "io"
)

// EncryptString encrypts plaintext using a base64-encoded AES-256 key (32 bytes).
// Returns ciphertext encoded in base64.
func EncryptString(keyB64, plaintext string) (string, error) {
    keyBytes, err := base64.StdEncoding.DecodeString(keyB64)
    if err != nil {
        return "", err
    }
    if len(keyBytes) != 32 {
        return "", errors.New("encryption key must be 32 bytes (base64-encoded)")
    }

    block, err := aes.NewCipher(keyBytes)
    if err != nil {
        return "", err
    }
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }

    nonce := make([]byte, gcm.NonceSize())
    if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }
    ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptString decrypts base64-encoded ciphertext using base64-encoded AES-256 key.
func DecryptString(keyB64, cipherB64 string) (string, error) {
    keyBytes, err := base64.StdEncoding.DecodeString(keyB64)
    if err != nil {
        return "", err
    }
    if len(keyBytes) != 32 {
        return "", errors.New("encryption key must be 32 bytes (base64-encoded)")
    }

    data, err := base64.StdEncoding.DecodeString(cipherB64)
    if err != nil {
        return "", err
    }

    block, err := aes.NewCipher(keyBytes)
    if err != nil {
        return "", err
    }
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }
    if len(data) < gcm.NonceSize() {
        return "", errors.New("ciphertext too short")
    }
    nonce, ciphertext := data[:gcm.NonceSize()], data[gcm.NonceSize():]
    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return "", err
    }
    return string(plaintext), nil
}
