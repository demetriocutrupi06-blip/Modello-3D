import { notFound } from "next/navigation";
import { getAdaptation } from "@/features/recipe-adapt/server";
import { RecipeView } from "@/features/recipe-adapt/components/RecipeView";

export const dynamic = "force-dynamic";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const a = await getAdaptation((await params).id);
  if (!a) notFound();
  return (
    <RecipeView
      id={a.id}
      data={a.data}
      oven={a.oven}
      sourceUrl={a.recipe.sourceUrl}
      sections={a.sectionTitles}
    />
  );
}
