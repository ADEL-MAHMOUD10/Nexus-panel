package xray

import (
	"testing"
)

func TestExtractAccessEmailAndIP(t *testing.T) {
	cases := []struct {
		name      string
		line      string
		wantEmail string
		wantIP    string
	}{
		{
			name:      "Standard Xray accepted tcp",
			line:      "2024/01/02 15:04:05.123456 from 1.2.3.4:555 accepted tcp:example.com:443 [inbound-tag >> outbound-tag] email: alice@example.com",
			wantEmail: "alice@example.com",
			wantIP:    "1.2.3.4",
		},
		{
			name:      "Standard Xray accepted udp",
			line:      "2026/10/28 03:40:00 from 156.204.1.50:54321 accepted udp:1.1.1.1:53 [in-2053 >> direct] email: user_5573",
			wantEmail: "user_5573",
			wantIP:    "156.204.1.50",
		},
		{
			name:      "IPv6 client address",
			line:      "2026/10/28 03:40:00 from [2001:db8::1]:1234 accepted tcp:google.com:443 [in >> out] email: user_9112",
			wantEmail: "user_9112",
			wantIP:    "2001:db8::1",
		},
		{
			name:      "Localhost ignored",
			line:      "2026/10/28 03:40:00 from 127.0.0.1:54321 accepted tcp:google.com:443 email: admin@test.com",
			wantEmail: "admin@test.com",
			wantIP:    "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotEmail, gotIP := extractAccessEmailAndIP(tc.line)
			if gotEmail != tc.wantEmail {
				t.Errorf("extractAccessEmailAndIP() email = %q, want %q", gotEmail, tc.wantEmail)
			}
			if gotIP != tc.wantIP {
				t.Errorf("extractAccessEmailAndIP() ip = %q, want %q", gotIP, tc.wantIP)
			}
		})
	}
}
