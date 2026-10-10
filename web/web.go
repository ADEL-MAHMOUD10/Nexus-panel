package web

import (
	"embed"
	"io/fs"
	"net/http"
)

// DistFS embeds the entire web directory including HTML, CSS, and JS components
//
//go:embed index.html assets
var DistFS embed.FS

// FileServerHandler returns an http.Handler serving the embedded assets
func FileServerHandler() http.Handler {
	return http.FileServer(http.FS(DistFS))
}

// GetIndexHTML returns index.html raw bytes
func GetIndexHTML() ([]byte, error) {
	return fs.ReadFile(DistFS, "index.html")
}
