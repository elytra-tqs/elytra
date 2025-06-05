#!/bin/sh

# Replace environment variables in the template
cat > /etc/alertmanager/alertmanager.yml << EOF
global:
  resolve_timeout: 5m
  smtp_from: "${SMTP_FROM}"
  smtp_smarthost: "smtp.gmail.com:587"
  smtp_auth_username: "${SMTP_FROM}"
  smtp_auth_password: "${SMTP_AUTH_PASSWORD}"
  smtp_auth_identity: "${SMTP_FROM}"
  smtp_require_tls: true

route:
  group_by: ["alertname"]
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: "email-notifications"
  routes:
    - match:
        severity: critical
      receiver: "email-notifications"
      group_wait: 0s
      repeat_interval: 5m

receivers:
  - name: "email-notifications"
    email_configs:
      - to: "${NOTIFICATION_EMAIL}"
        send_resolved: true
        headers:
          subject: "Elytra Alert: {{ .GroupLabels.alertname }}"
        html: |
          {{ range .Alerts }}
          <h2 style="color: {{ if eq .Labels.severity "critical" }}#ff0000{{ else }}#ffa500{{ end }}">
            Container: {{ .Labels.id }}
          </h2>
          <h3>Alert: {{ .Annotations.summary }}</h3>
          <p><strong>Description:</strong> {{ .Annotations.description }}</p>
          <p><strong>Severity:</strong> {{ .Labels.severity }}</p>
          <hr>
          {{ end }}
EOF

# Start alertmanager
exec /bin/alertmanager --config.file=/etc/alertmanager/alertmanager.yml --storage.path=/alertmanager