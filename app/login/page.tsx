import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    redirect("/login?error=1");
  }

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <form
        action={login}
        className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8 flex flex-col gap-4"
      >
        <h1 className="text-xl font-black text-center">
          Content<span className="text-gold">Pilot</span>
        </h1>
        <p className="text-sm text-neutral-400 text-center">
          Ingresa la contraseña para continuar
        </p>
        {error && (
          <p className="text-sm text-red-400 text-center">Contraseña incorrecta</p>
        )}
        <input
          type="password"
          name="password"
          placeholder="Contraseña"
          autoFocus
          required
          className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-gold focus:outline-none"
        />
        <button className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-black hover:bg-gold-light">
          Entrar
        </button>
      </form>
    </div>
  );
}
