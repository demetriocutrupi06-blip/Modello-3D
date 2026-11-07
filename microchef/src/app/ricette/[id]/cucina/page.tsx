import { notFound } from "next/navigation";
import { getAdaptation } from "@/features/recipe-adapt/server";
import { CookingMode } from "@/features/cooking-mode/components/CookingMode";

export const dynamic = "force-dynamic";

export default async function CookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ porzioni?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const a = await getAdaptation(id);
  if (!a) notFound();
  const n = Number(sp.porzioni);
  const servings = Number.isInteger(n) && n >= 1 && n <= 50 ? n : a.data.servings;
  return <CookingMode id={a.id} data={a.data} servings={servings} />;
}
