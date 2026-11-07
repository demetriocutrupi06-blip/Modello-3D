import Link from "next/link";
import { getOven, hasApiKey } from "@/features/oven-profile/server";
import { getActiveOvenId } from "@/features/recipe-adapt/server";
import { RecipeInputForm } from "@/features/recipe-adapt/components/RecipeInputForm";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  const id = await getActiveOvenId();
  const oven = id ? await getOven(id) : null;
  if (!oven) {
    return (
      <div className="card">
        Prima configura il tuo forno.{" "}
        <Link href="/forni/nuovo" className="underline">
          Aggiungi un forno
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Adatta una ricetta</h1>
      <p className="text-stone-600 dark:text-stone-400">
        Per il forno <strong>{oven.nickname}</strong> ({oven.brand} {oven.model}).
      </p>
      <RecipeInputForm hasApiKey={hasApiKey()} />
    </div>
  );
}
