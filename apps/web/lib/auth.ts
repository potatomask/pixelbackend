import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import nodemailer from "nodemailer";

const EMAIL_SETTINGS_KEY = "email-settings";

type EmailChannelSettings = {
  fromName?: string;
  fromEmail?: string;
  password?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpSecure?: boolean;
};

type EmailSettings = {
  otp?: EmailChannelSettings;
};

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadOtpEmailConfig() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: EMAIL_SETTINGS_KEY } });
  if (!setting?.value) return null;

  try {
    const parsed = JSON.parse(setting.value) as EmailSettings;
    const otp = parsed?.otp;
    if (!otp?.fromEmail || !otp?.password || !otp?.smtpHost || !otp?.smtpPort) return null;
    return otp;
  } catch {
    return null;
  }
}

async function sendVerificationMail(toEmail: string, toName: string | null | undefined, verifyUrl: string) {
  const config = await loadOtpEmailConfig();
  if (!config) {
    throw new Error("OTP email configuration is missing in admin settings");
  }

  const parsedPort = Number(config.smtpPort);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error("Invalid OTP SMTP port configuration");
  }

  const secure = Boolean(config.smtpSecure) || parsedPort === 465;

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: parsedPort,
    secure,
    auth: {
      user: config.fromEmail,
      pass: config.password,
    },
  });

  const recipientName = toName?.trim() || "there";
  const safeName = escapeHtml(recipientName);
  const safeUrl = escapeHtml(verifyUrl);

  await transporter.sendMail({
    from: `${config.fromName?.trim() || "MyPixelPage"} <${config.fromEmail}>`,
    to: toEmail,
    subject: "Verify your email for MyPixelPage",
    text: `Hi ${recipientName},\n\nPlease verify your email by opening this link:\n${verifyUrl}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>Hi ${safeName},</p><p>Please verify your email by opening this link:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    autoSignIn: false,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationMail(user.email, user.name, url);
    },
  },
  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh session token every 24 hours
  },
  user: {
    additionalFields: {
      handle: { type: "string", required: false, input: true },
      displayName: { type: "string", required: false, input: true },
      bio: { type: "string", required: false },
      isAdmin: { type: "boolean", defaultValue: false },
      tier: { type: "string", defaultValue: "FREE" },
      tierExpiresAt: { type: "date", required: false },
      paidSince: { type: "date", required: false },
    },
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
});

export type Session = typeof auth.$Infer.Session;
