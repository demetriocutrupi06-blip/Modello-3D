import Link from "next/link";
import { getOven } from "@/features/oven-profile/server";
import { getActiveOvenId } from "@/features/recipe-adapt/server";
import { PowerConverterTool } from "@/features/power-converter/components/PowerConverterTool";

export const dynamic = "force-dynamic";

export default async function PowerPage() {
  const id = await getActiveOvenId();
  const oven = id ? await getOven(id) : null;
  const levels = oven?.profile?.powerLevels ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Convertitore di potenza</h1>
      <p className="text-stone-600 dark:text-stone-400">
        Hai un&apos;indicazione per un altro microonde (es. sulla confezione)? Inserisci potenza e tempo: calcolo il tempo per il tuo forno.
      </p>
      {levels.length > 0 ? (
        <PowerConverterTool levels={levels} ovenName={oven!.nickname} />
      ) : (
        <div className="card">
          Per usare il convertitore serve un forno con i livelli di potenza.{" "}
          <Link href={oven ? `/forni/${oven.id}` : "/forni/nuovo"} className="underline">
            {oven ? "Completa il profilo" : "Aggiungi un forno"}
          </Link>
        </div>
      )}
    </div>
  );
}
