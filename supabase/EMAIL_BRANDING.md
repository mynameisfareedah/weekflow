# WeekFlow authentication email branding

The HTML sources in `supabase/email-templates/` are intended for the Supabase Dashboard email templates. They keep Supabase Auth as the authentication provider and use Supabase-generated `{{ .ConfirmationURL }}` links.

## Repository behavior

- Signup passes `emailRedirectTo` as the current application origin (`/`).
- Password reset passes a redirect built from the current application origin (`/reset-password`).
- No production hostname is hard-coded because this repository does not define one.
- No token, password, service-role key, SMTP credential, or publishable key is added to the templates or documentation.

## Supabase Dashboard setup

Configure these settings in the Supabase project used by WeekFlow:

1. Go to **Authentication -> URL Configuration -> Site URL** and set it to the deployed WeekFlow origin, for example `https://your-real-weekflow-domain.example`.
2. Under **Authentication -> URL Configuration -> Redirect URLs**, allow the deployed origin and the reset route, for example:
   - `https://your-real-weekflow-domain.example/`
   - `https://your-real-weekflow-domain.example/reset-password`
   - the local development origin used by the team, when needed
3. Go to **Authentication -> Email Templates -> Confirm signup**. Use the subject `Welcome to WeekFlow — Confirm your account` and paste `supabase/email-templates/confirm-signup.html` as the body.
4. Go to **Authentication -> Email Templates -> Reset password**. Use the subject `Reset your WeekFlow password` and paste `supabase/email-templates/reset-password.html` as the body.
5. Set the sender name to `WeekFlow` in the project email settings.
6. For production sender identity and reliable delivery, configure **Authentication -> SMTP / email provider** with a verified sending domain. Do not put SMTP credentials in this repository or in any `VITE_` variable.

The exact custom domain must be supplied by the deployment owner. Do not use the example hostname above as a real configuration value.

## Link behavior

The email CTA remains a secure Supabase-generated URL. Supabase verifies the token and redirects to the configured WeekFlow origin. Confirmation returns to `/`; password recovery returns to `/reset-password`, where the existing WeekFlow reset flow handles the authenticated password update.
