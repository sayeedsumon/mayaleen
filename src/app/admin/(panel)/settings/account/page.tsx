import { Banner, Card, Chip } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { otpauthUri } from "@/server/auth/totp";
import { changePasswordAction, twoFactorAction } from "../../../_actions/settings";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const pending = !user.twoFaOn && !!user.totpSecret;
  const secretGroups = user.totpSecret?.match(/.{1,4}/g)?.join(" ");
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <Card title="Change password">
        <form action={changePasswordAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="label">Current password<input type="password" name="current" required autoComplete="current-password" className="input" /></label>
          <label className="label">New password<input type="password" name="next" required minLength={10} autoComplete="new-password" className="input" /></label>
          <label className="label">New password again<input type="password" name="confirm" required minLength={10} autoComplete="new-password" className="input" /></label>
          <p className="text-xs text-ink-muted sm:col-span-2">At least 10 characters. A short sentence is easy to remember and hard to guess.</p>
          <button className="btn">Change password</button>
        </form>
      </Card>
      <Card title="Two-step sign-in" action={user.twoFaOn ? <Chip tone="leaf">On</Chip> : <Chip tone="amber">Off</Chip>}>
        {user.twoFaOn ? (
          <form action={twoFactorAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="step" value="disable" />
            <p className="w-full text-sm text-ink-2">Each sign-in asks for the 6-digit code from your authenticator app.</p>
            <label className="label">Password to turn it off<input type="password" name="password" required className="input w-64" /></label>
            <button className="btn-danger">Turn off</button>
          </form>
        ) : pending ? (
          <div className="flex flex-col gap-3">
            <ol className="list-decimal pl-5 text-sm leading-6 text-ink-2">
              <li>Open Google Authenticator, Microsoft Authenticator or similar on your phone.</li>
              <li>Add an account by entering this setup key (time-based):</li>
            </ol>
            <code className="rounded-lg bg-sand px-3 py-2.5 text-center font-mono text-base tracking-wider">{secretGroups}</code>
            <a href={otpauthUri(user.totpSecret!, user.mobile)} className="text-[13px]">On this phone? Tap to open your authenticator app</a>
            <form action={twoFactorAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="step" value="confirm" />
              <label className="label">3. Enter the 6-digit code it shows<input name="code" required inputMode="numeric" maxLength={6} className="input w-40 text-center tracking-widest" /></label>
              <button className="btn">Turn on</button>
            </form>
          </div>
        ) : (
          <form action={twoFactorAction} className="flex flex-col gap-3">
            <input type="hidden" name="step" value="start" />
            <p className="text-sm text-ink-2">Protect your sign-in with a code from an authenticator app, so a stolen password alone is not enough. The PRD asks every staff member to turn this on.</p>
            <button className="btn self-start">Set up two-step sign-in</button>
          </form>
        )}
      </Card>
    </div>
  );
}
