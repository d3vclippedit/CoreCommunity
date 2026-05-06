interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(
  resendApiKey: string,
  { to, subject, html, from = "CORE <noreply@corecommunity.app>" }: SendEmailOptions,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

export function verificationEmailHtml(verifyUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0C;font-family:Inter,system-ui,sans-serif;color:#F5F5F7">
  <div style="max-width:480px;margin:40px auto;padding:32px;background:#111114;border:1px solid #222227;border-radius:10px">
    <p style="font-size:24px;font-weight:700;letter-spacing:-0.02em;margin:0 0 8px">CORE</p>
    <p style="color:#A1A1AA;font-size:13px;margin:0 0 32px">Communities for creators who actually run them.</p>
    <h1 style="font-size:18px;font-weight:600;margin:0 0 12px">Verify your email</h1>
    <p style="color:#A1A1AA;font-size:14px;line-height:1.6;margin:0 0 24px">
      Click the button below to verify your email address and activate your account.
      This link expires in 24 hours.
    </p>
    <a href="${verifyUrl}" style="display:inline-block;background:#F5F5F7;color:#0A0A0C;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:6px">
      Verify email
    </a>
    <p style="color:#6B6B73;font-size:12px;margin:24px 0 0">
      If you didn't create a CORE account, you can ignore this email.
    </p>
  </div>
</body>
</html>`;
}

export function passwordResetEmailHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0C;font-family:Inter,system-ui,sans-serif;color:#F5F5F7">
  <div style="max-width:480px;margin:40px auto;padding:32px;background:#111114;border:1px solid #222227;border-radius:10px">
    <p style="font-size:24px;font-weight:700;letter-spacing:-0.02em;margin:0 0 8px">CORE</p>
    <p style="color:#A1A1AA;font-size:13px;margin:0 0 32px">Communities for creators who actually run them.</p>
    <h1 style="font-size:18px;font-weight:600;margin:0 0 12px">Reset your password</h1>
    <p style="color:#A1A1AA;font-size:14px;line-height:1.6;margin:0 0 24px">
      Click the button below to reset your password. This link expires in 1 hour.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background:#F5F5F7;color:#0A0A0C;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:6px">
      Reset password
    </a>
    <p style="color:#6B6B73;font-size:12px;margin:24px 0 0">
      If you didn't request a password reset, you can ignore this email.
    </p>
  </div>
</body>
</html>`;
}
