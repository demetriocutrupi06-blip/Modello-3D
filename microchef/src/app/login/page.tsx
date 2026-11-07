import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ da?: string }> }) {
  const { da } = await searchParams;
  // si torna solo a percorsi interni
  const next = da && da.startsWith("/") && !da.startsWith("//") ? da : "/";
  return (
    <div className="mx-auto max-w-sm space-y-4 pt-8">
      <h1 className="text-2xl font-bold">Accedi a MicroChef</h1>
      <p className="text-stone-600 dark:text-stone-400">Inserisci la password della famiglia. Su questo dispositivo te la chiederà una volta sola.</p>
      <LoginForm next={next} />
    </div>
  );
}
