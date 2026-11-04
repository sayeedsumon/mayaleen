import { loginAction } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto mt-24 max-w-sm rounded-xl bg-white p-6 shadow">
      <h1 className="text-xl font-semibold">Mayaleen staff sign-in</h1>
      {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <form action={loginAction} className="mt-4 space-y-3">
        <label className="block text-sm">
          Mobile
          <input name="mobile" required autoComplete="username" className="mt-1 w-full rounded border p-2" />
        </label>
        <label className="block text-sm">
          Password
          <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded border p-2" />
        </label>
        <label className="block text-sm">
          2FA code (if enabled)
          <input name="code" inputMode="numeric" autoComplete="one-time-code" className="mt-1 w-full rounded border p-2" />
        </label>
        <button className="w-full rounded bg-slate-900 p-2 text-white">Sign in</button>
      </form>
    </main>
  );
}
