import { Banner, Icon } from "@/components/ui";
import { loginAction } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-ground px-4">
      <div className="card w-full max-w-sm p-7">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-lake text-white"><Icon name="boat" size={22} /></div>
          <div>
            <div className="font-display text-xl font-semibold">Mayaleen</div>
            <div className="text-xs text-ink-muted">Staff sign-in</div>
          </div>
        </div>
        <Banner>{error}</Banner>
        <form action={loginAction} className="mt-4 flex flex-col gap-4">
          <label className="label">Mobile<input name="mobile" required inputMode="tel" autoComplete="username" placeholder="01XXXXXXXXX" className="input h-11" /></label>
          <label className="label">Password<input name="password" type="password" required autoComplete="current-password" className="input h-11" /></label>
          <label className="label">Code from authenticator app<span className="text-xs font-normal text-ink-muted">Only if two-step sign-in is on</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input h-11" /></label>
          <button className="btn h-11">Sign in</button>
        </form>
      </div>
    </main>
  );
}
