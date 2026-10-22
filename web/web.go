package web

import (
	"embed"
	"io/fs"
	"net/http"
)

// DistFS embeds the compiled React frontend from dist/
//
//go:embed dist/*
var embeddedDist embed.FS

// FileServerHandler returns an http.Handler serving the embedded assets
func FileServerHandler() http.Handler {
	sub, err := fs.Sub(embeddedDist, "dist")
	if err != nil {
		return http.FileServer(http.FS(embeddedDist))
	}
	return http.FileServer(http.FS(sub))
}

// GetIndexHTML returns index.html raw bytes from compiled dist
func GetIndexHTML() ([]byte, error) {
	sub, err := fs.Sub(embeddedDist, "dist")
	if err != nil {
		return fs.ReadFile(embeddedDist, "dist/index.html")
	}
	return fs.ReadFile(sub, "index.html")
}
