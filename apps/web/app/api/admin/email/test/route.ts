import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const EMAIL_SETTINGS_KEY = "email-settings";

type ChannelKey = "otp" | "welcome";

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

function isValidEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function renderWelcomeTemplate(template: string) {
  return template
    .replace(/{{first_name}}/g, "Test")
    .replace(/{{last_name}}/g, "User")
    .replace(/{{email}}/g, "test.user@example.com")
    .replace(/{{handle}}/g, "test-user");
}

function formatSmtpError(err: unknown) {
  if (!(err instanceof Error)) return "Failed to send test email";

  const anyErr = err as Error & {
    code?: string;
    command?: string;
    response?: string;
    responseCode?: number;
  };

  const parts = ["SMTP test failed"];
  if (anyErr.code) parts.push(`code=${anyErr.code}`);
  if (typeof anyErr.responseCode === "number") parts.push(`status=${anyErr.responseCode}`);
  if (anyErr.command) parts.push(`command=${anyErr.command}`);
  if (anyErr.message) parts.push(anyErr.message);
  if (anyErr.response) parts.push(anyErr.response);

  return parts.join(" | ");
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const body = (await request.json()) as { channel?: string; to?: string };
  const channel = body.channel as ChannelKey | undefined;
  const to = (body.to ?? "").trim();

  if (channel !== "otp" && channel !== "welcome") {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  if (!to || !isValidEmail(to)) {
    return NextResponse.json({ error: "Valid recipient email is required" }, { status: 400 });
  }

  const setting = await prisma.siteSetting.findUnique({ where: { key: EMAIL_SETTINGS_KEY } });
  if (!setting?.value) {
    return NextResponse.json({ error: "Email settings not configured" }, { status: 400 });
  }

  let parsed: EmailSettings;
  try {
    parsed = JSON.parse(setting.value) as EmailSettings;
  } catch {
    return NextResponse.json({ error: "Email settings are invalid" }, { status: 400 });
  }

  const config = parsed[channel];
  if (!config?.fromEmail || !config.password || !config.smtpHost || !config.smtpPort) {
    return NextResponse.json({ error: "SMTP credentials are incomplete" }, { status: 400 });
  }

  const parsedPort = Number(config.smtpPort);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    return NextResponse.json({ error: "SMTP port must be a valid positive number" }, { status: 400 });
  }

  // Common default: port 465 requires secure=true. Keep explicit toggle, but auto-fix this mismatch.
  const secure = config.smtpSecure || parsedPort === 465;

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: parsedPort,
    secure,
    auth: {
      user: config.fromEmail,
      pass: config.password,
    },
  });

  const fromName = config.fromName?.trim() || "MyPixelPage";

  const subject = channel === "otp"
    ? "MyPixelPage OTP Test"
    : (parsed.welcome.subject?.trim() || "MyPixelPage Welcome Email Test");

  const text = channel === "otp"
    ? "This is a test OTP email from your MyPixelPage admin settings."
    : renderWelcomeTemplate(parsed.welcome.template || "Welcome to MyPixelPage, {{first_name}} {{last_name}}.");

  const html = text
    .split("\n")
    .map((line) => line.trim() ? `<p>${line}</p>` : "<br />")
    .join("");

  try {
    await transporter.verify();

    await transporter.sendMail({
      from: `${fromName} <${config.fromEmail}>`,
      to,
      subject,
      text,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: formatSmtpError(err) }, { status: 500 });
  }
}
