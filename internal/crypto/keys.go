package crypto

import (
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
)

// RealityKeyPair contains X25519 private and public keys encoded in base64 URL format
type RealityKeyPair struct {
	PrivateKey string `json:"privateKey"`
	PublicKey  string `json:"publicKey"`
}

// GenerateRealityKeyPair generates a Curve25519 (X25519) keypair for REALITY protocol
func GenerateRealityKeyPair() (*RealityKeyPair, error) {
	curve := ecdh.X25519()
	privKey, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate X25519 private key: %w", err)
	}

	pubKey := privKey.PublicKey()

	return &RealityKeyPair{
		PrivateKey: base64.RawURLEncoding.EncodeToString(privKey.Bytes()),
		PublicKey:  base64.RawURLEncoding.EncodeToString(pubKey.Bytes()),
	}, nil
}

// GenerateShortID generates a random hex short ID of the specified byte length (default 8 bytes = 16 hex chars)
func GenerateShortID(byteLength int) (string, error) {
	if byteLength <= 0 {
		byteLength = 8
	}
	bytes := make([]byte, byteLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

// WireGuardKeyPair contains standard Base64-encoded WireGuard private and public keys
type WireGuardKeyPair struct {
	PrivateKey string `json:"privateKey"`
	PublicKey  string `json:"publicKey"`
}

// GenerateWireGuardKeyPair generates a Curve25519 keypair for WireGuard
func GenerateWireGuardKeyPair() (*WireGuardKeyPair, error) {
	curve := ecdh.X25519()
	privKey, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate WireGuard private key: %w", err)
	}

	pubKey := privKey.PublicKey()

	return &WireGuardKeyPair{
		PrivateKey: base64.StdEncoding.EncodeToString(privKey.Bytes()),
		PublicKey:  base64.StdEncoding.EncodeToString(pubKey.Bytes()),
	}, nil
}

// GenerateShadowsocksKey generates a random base64 key for Shadowsocks 2022 (16 or 32 bytes)
func GenerateShadowsocksKey(byteLength int) (string, error) {
	if byteLength != 16 && byteLength != 32 {
		byteLength = 16
	}
	bytes := make([]byte, byteLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return base64.StdEncoding.EncodeToString(bytes), nil
}
