# Support and Contact email notifications

Support and Contact submissions remain stored in `public.support_requests`. After a successful insert, the browser invokes the `notify-support-request` Supabase Edge Function. The function sends a plain-text notification to `bezanirsolutions@gmail.com` through Brevo's transactional email API and uses the submitter's email as `Reply-To`.

## Configure the Edge Function

Brevo's SMTP credential and its transactional HTTP API credential are separate. The existing Supabase Auth SMTP configuration must remain unchanged, and its SMTP credential must not be repurposed for this function. Create or use a Brevo API key for transactional API access, then deploy `supabase/functions/notify-support-request` with Supabase CLI and configure these server-side secrets:

```text
BREVO_API_KEY=<Brevo transactional API key>
BREVO_FROM_EMAIL=<verified Brevo sender email>
```

`BREVO_API_KEY` is a Brevo transactional API key, not an SMTP username, SMTP password, or SMTP key. `BREVO_FROM_EMAIL` must be an email address for a sender verified in Brevo. These values belong in Supabase Edge Function secrets only. Do not add them to `.env`, `VITE_*` variables, React code, or the repository.

Deploy the function after configuring the secrets:

```bash
supabase functions deploy notify-support-request
```

The Edge Function's default JWT verification should remain enabled so the public application can invoke it with the Supabase publishable client token. It only sends to the fixed WeekFlow destination and accepts the two existing submission sources: `support` and `contact`.

## Failure behavior

The database insert happens before notification. If Brevo is unavailable or not configured, the stored submission is kept and the function logs only the delivery status. The client does not expose provider errors or credentials.

## Testing

After deployment and secret configuration, submit a clearly identified test Support message from `/support` and a clearly identified test Contact message from `/contact`. Confirm that each record is stored in `public.support_requests` and that the corresponding notification arrives at `bezanirsolutions@gmail.com`. Support and Contact notifications use different subjects and source labels; replies go to the submitted email address.

Email delivery cannot be confirmed locally until the function is deployed and the two Supabase secrets are configured. Do not run the deployment or send production test messages until the deployment owner has reviewed the configuration.
