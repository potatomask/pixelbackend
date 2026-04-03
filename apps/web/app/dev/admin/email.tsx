"use client";

import React, { useCallback, useEffect, useState } from "react";

const P = {
  card: "#13131f",
  cardBorder: "#1e1e2e",
  panel: "#0f0f18",
  accent: "#6c5ce7",
  accentSoft: "#6c5ce722",
  green: "#00cec9",
  rose: "#fd79a8",
  text: "#e0e0e0",
  textDim: "#999",
  textMuted: "#555",
};

const EMAIL_SETTINGS_KEY = "email-settings";

type EmailChannelSettings = {
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  password: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: string;
  imapSecure: boolean;
};

type EmailSettings = {
  otp: EmailChannelSettings;
  welcome: EmailChannelSettings & {
    subject: string;
    previewText: string;
    template: string;
  };
};

const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  otp: {
    enabled: false,
    fromName: "MyPixelPage OTP",
    fromEmail: "",
    password: "",
    smtpHost: "",
    smtpPort: "587",
    smtpSecure: false,
    imapHost: "",
    imapPort: "993",
    imapSecure: true,
  },
  welcome: {
    enabled: false,
    fromName: "MyPixelPage",
    fromEmail: "",
    password: "",
    smtpHost: "",
    smtpPort: "587",
    smtpSecure: false,
    imapHost: "",
    imapPort: "993",
    imapSecure: true,
    subject: "Welcome to MyPixelPage, {{first_name}}",
    previewText: "Your page is ready to build.",
    template: [
      "Hi {{first_name}} {{last_name}},",
      "",
      "Welcome to MyPixelPage.",
      "",
      "Your public handle is {{handle}} and your signup email is {{email}}.",
      "",
      "Start building your page whenever you are ready.",
      "",
      "- MyPixelPage",
    ].join("\n"),
  },
};

type ChannelKey = keyof EmailSettings;

export function EmailTab() {
  const [settings, setSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<ChannelKey | null>(null);
  const [testingSection, setTestingSection] = useState<ChannelKey | null>(null);
  const [testRecipient, setTestRecipient] = useState<Record<ChannelKey, string>>({ otp: "", welcome: "" });
  const [testStatus, setTestStatus] = useState<Record<ChannelKey, string>>({ otp: "", welcome: "" });
  const [testError, setTestError] = useState<Record<ChannelKey, string>>({ otp: "", welcome: "" });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const fetchEmailSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/settings?key=${EMAIL_SETTINGS_KEY}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.value) {
        setSettings(DEFAULT_EMAIL_SETTINGS);
        return;
      }

      const parsed = typeof json.value === "string" ? JSON.parse(json.value) : json.value;
      setSettings({
        otp: {
          ...DEFAULT_EMAIL_SETTINGS.otp,
          ...(parsed?.otp ?? {}),
        },
        welcome: {
          ...DEFAULT_EMAIL_SETTINGS.welcome,
          ...(parsed?.welcome ?? {}),
        },
      });
    } catch {
      setError("Failed to load email settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmailSettings(); }, [fetchEmailSettings]);

  const updateChannelField = <K extends keyof EmailChannelSettings>(channel: ChannelKey, key: K, value: EmailSettings[ChannelKey][K]) => {
    setSettings((current) => ({
      ...current,
      [channel]: {
        ...current[channel],
        [key]: value,
      },
    }));
    setError("");
    setStatus("");
  };

  const updateWelcomeField = <K extends keyof EmailSettings["welcome"]>(key: K, value: EmailSettings["welcome"][K]) => {
    setSettings((current) => ({
      ...current,
      welcome: {
        ...current.welcome,
        [key]: value,
      },
    }));
    setError("");
    setStatus("");
  };

  const validateChannel = (channel: ChannelKey) => {
    const config = settings[channel];

    if (!config.fromEmail.trim()) return "Email address is required.";
    if (!config.password.trim()) return "Mailbox password is required.";
    if (!config.smtpHost.trim() || !config.smtpPort.trim()) return "SMTP host and port are required.";
    if (!config.imapHost.trim() || !config.imapPort.trim()) return "IMAP host and port are required.";

    if (channel === "welcome") {
      if (!settings.welcome.subject.trim()) return "Welcome email subject is required.";
      if (!settings.welcome.template.trim()) return "Welcome email template is required.";
    }

    return null;
  };

  const saveChannel = async (channel: ChannelKey) => {
    const validationError = validateChannel(channel);
    if (validationError) {
      setError(validationError);
      setStatus("");
      return;
    }

    setSavingSection(channel);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: EMAIL_SETTINGS_KEY, value: settings }),
      });

      if (!res.ok) {
        throw new Error("save_failed");
      }

      setStatus(channel === "otp" ? "OTP email settings saved." : "Welcome email settings saved.");
    } catch {
      setError("Failed to save email settings.");
    } finally {
      setSavingSection(null);
    }
  };

  const setChannelTestRecipient = (channel: ChannelKey, value: string) => {
    setTestRecipient((current) => ({ ...current, [channel]: value }));
    setTestError((current) => ({ ...current, [channel]: "" }));
    setTestStatus((current) => ({ ...current, [channel]: "" }));
  };

  const sendTestEmail = async (channel: ChannelKey) => {
    const recipient = testRecipient[channel].trim();
    if (!/^\S+@\S+\.\S+$/.test(recipient)) {
      setTestError((current) => ({ ...current, [channel]: "Enter a valid recipient email." }));
      setTestStatus((current) => ({ ...current, [channel]: "" }));
      return;
    }

    setTestingSection(channel);
    setTestError((current) => ({ ...current, [channel]: "" }));
    setTestStatus((current) => ({ ...current, [channel]: "" }));
    try {
      const res = await fetch("/api/admin/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, to: recipient }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Failed to send test email.");
      }

      setTestStatus((current) => ({
        ...current,
        [channel]: channel === "otp" ? "OTP test email sent." : "Welcome test email sent.",
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send test email.";
      setTestError((current) => ({ ...current, [channel]: message }));
    } finally {
      setTestingSection(null);
    }
  };

  const fieldLabelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 600,
    color: P.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "#1e1e2e",
    border: `1px solid ${P.cardBorder}`,
    borderRadius: 8,
    color: P.text,
    fontSize: 13,
    outline: "none",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: 220,
    resize: "vertical",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    lineHeight: 1.6,
  };

  const panelStyle: React.CSSProperties = {
    background: P.panel,
    border: `1px solid ${P.cardBorder}`,
    borderRadius: 12,
    padding: 18,
  };

  const renderTransportFields = (channel: ChannelKey, title: string, subtitle: string) => {
    const config = settings[channel];

    return (
      <div style={{ background: P.card, border: `1px solid ${P.cardBorder}`, borderRadius: 12, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.text }}>{title}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: P.textDim, lineHeight: 1.5 }}>{subtitle}</p>
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: P.textDim }}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => updateChannelField(channel, "enabled", e.target.checked)}
            />
            {channel === "otp" ? "OTP emails on" : "Welcome emails on"}
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={fieldLabelStyle}>From Name</label>
            <input type="text" value={config.fromName} onChange={(e) => updateChannelField(channel, "fromName", e.target.value)} style={inputStyle} placeholder="MyPixelPage" />
          </div>
          <div>
            <label style={fieldLabelStyle}>Email Address</label>
            <input type="email" value={config.fromEmail} onChange={(e) => updateChannelField(channel, "fromEmail", e.target.value)} style={inputStyle} placeholder="no-reply@mypixel.page" />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={fieldLabelStyle}>Mailbox Password</label>
          <input type="password" value={config.password} onChange={(e) => updateChannelField(channel, "password", e.target.value)} style={inputStyle} placeholder="Mailbox or app password" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 16 }}>
          <div style={panelStyle}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: P.text }}>SMTP</div>
              <div style={{ marginTop: 4, fontSize: 12, color: P.textDim }}>Outgoing server for this email flow.</div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={fieldLabelStyle}>Host</label>
                <input type="text" value={config.smtpHost} onChange={(e) => updateChannelField(channel, "smtpHost", e.target.value)} style={inputStyle} placeholder="smtp.hostinger.com" />
              </div>
              <div>
                <label style={fieldLabelStyle}>Port</label>
                <input type="text" value={config.smtpPort} onChange={(e) => updateChannelField(channel, "smtpPort", e.target.value)} style={inputStyle} placeholder="587" />
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: P.textDim }}>
                <input type="checkbox" checked={config.smtpSecure} onChange={(e) => updateChannelField(channel, "smtpSecure", e.target.checked)} />
                Use secure SMTP/TLS
              </label>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: P.text }}>IMAP</div>
              <div style={{ marginTop: 4, fontSize: 12, color: P.textDim }}>Stored separately for inbox-based automation and mailbox checks.</div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={fieldLabelStyle}>Host</label>
                <input type="text" value={config.imapHost} onChange={(e) => updateChannelField(channel, "imapHost", e.target.value)} style={inputStyle} placeholder="imap.hostinger.com" />
              </div>
              <div>
                <label style={fieldLabelStyle}>Port</label>
                <input type="text" value={config.imapPort} onChange={(e) => updateChannelField(channel, "imapPort", e.target.value)} style={inputStyle} placeholder="993" />
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: P.textDim }}>
                <input type="checkbox" checked={config.imapSecure} onChange={(e) => updateChannelField(channel, "imapSecure", e.target.checked)} />
                Use secure IMAP/SSL
              </label>
            </div>
          </div>
        </div>

        {channel === "welcome" && (
          <div style={{ display: "grid", gap: 16, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <div>
                <label style={fieldLabelStyle}>Subject</label>
                <input type="text" value={settings.welcome.subject} onChange={(e) => updateWelcomeField("subject", e.target.value)} style={inputStyle} placeholder="Welcome to MyPixelPage, {{first_name}}" />
              </div>
              <div>
                <label style={fieldLabelStyle}>Preview Text</label>
                <input type="text" value={settings.welcome.previewText} onChange={(e) => updateWelcomeField("previewText", e.target.value)} style={inputStyle} placeholder="Short inbox preview text" />
              </div>
            </div>

            <div>
              <label style={fieldLabelStyle}>Welcome Template</label>
              <textarea value={settings.welcome.template} onChange={(e) => updateWelcomeField("template", e.target.value)} style={textareaStyle} placeholder="Write the welcome email body here..." />
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["{{first_name}}", "{{last_name}}", "{{email}}", "{{handle}}"].map((token) => (
                  <span key={token} style={{ padding: "4px 8px", borderRadius: 999, background: P.accentSoft, color: "#a78bfa", fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>
                    {token}
                  </span>
                ))}
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 12, color: P.textDim, lineHeight: 1.6 }}>
                These placeholders will be replaced when the welcome email is sent after signup.
              </p>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10 }}>
            <input
              type="email"
              value={testRecipient[channel]}
              onChange={(e) => setChannelTestRecipient(channel, e.target.value)}
              style={inputStyle}
              placeholder="Test recipient email"
            />
            <button
              onClick={() => sendTestEmail(channel)}
              disabled={testingSection !== null || loading}
              style={{
                padding: "9px 14px",
                background: "#1e1e2e",
                border: `1px solid ${P.cardBorder}`,
                borderRadius: 8,
                color: P.text,
                fontSize: 13,
                fontWeight: 600,
                cursor: testingSection !== null || loading ? "not-allowed" : "pointer",
                opacity: testingSection !== null || loading ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {testingSection === channel ? "Sending test..." : channel === "otp" ? "Send OTP Test" : "Send Welcome Test"}
            </button>
          </div>
          {testError[channel] && <div style={{ fontSize: 12, color: P.rose }}>{testError[channel]}</div>}
          {!testError[channel] && testStatus[channel] && <div style={{ fontSize: 12, color: P.green }}>{testStatus[channel]}</div>}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: P.textMuted, maxWidth: 560 }}>
            {channel === "otp" ? "Dedicated mailbox config for verification and OTP delivery." : "Dedicated mailbox config and template for post-signup welcome messages."}
          </div>
          <button
            onClick={() => saveChannel(channel)}
            disabled={savingSection !== null || loading}
            style={{
              padding: "9px 16px",
              background: P.accent,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: savingSection !== null || loading ? "not-allowed" : "pointer",
              opacity: savingSection !== null || loading ? 0.5 : 1,
            }}
          >
            {savingSection === channel ? "Saving…" : channel === "otp" ? "Save OTP Email" : "Save Welcome Email"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: P.text }}>Email</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: P.textDim }}>
          Configure separate mailboxes and transport settings for OTP delivery and welcome emails.
        </p>
      </div>

      {loading ? (
        <div style={{ color: P.textDim, fontSize: 13 }}>Loading email settings…</div>
      ) : (
        <div style={{ display: "grid", gap: 16, maxWidth: 980 }}>
          {renderTransportFields("otp", "OTP Email", "Used only for verification, one-time codes, and account confirmation flows.")}
          {renderTransportFields("welcome", "Welcome Email", "Used only for signup welcome emails with customizable template variables.")}

          {(error || status) && (
            <div style={{ background: P.card, border: `1px solid ${error ? P.rose + "55" : P.green + "55"}`, borderRadius: 12, padding: 16, color: error ? P.rose : P.green, fontSize: 13 }}>
              {error || status}
            </div>
          )}
        </div>
      )}
    </div>
  );
}