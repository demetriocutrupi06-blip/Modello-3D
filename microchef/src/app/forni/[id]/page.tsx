import { notFound } from "next/navigation";
import { getOven } from "@/features/oven-profile/server";
import { ProfileEditor } from "@/features/oven-profile/components/ProfileEditor";
import { ManualSections } from "@/features/oven-profile/components/ManualSections";
import { emptyProfile } from "@/features/oven-profile/schema";

export const dynamic = "force-dynamic";

export default async function OvenPage({ params }: { params: Promise<{ id: string }> }) {
  const oven = await getOven((await params).id);
  if (!oven) notFound();
  const sections = oven.manual?.sections ?? [];

  return (
    <div className="space-y-6">
      {!oven.confirmed && (
        <div className="card border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <p className="font-semibold">Controlla il profilo prima di salvarlo</p>
          <p className="text-sm">
            I dati sono stati ricavati automaticamente dal manuale. Verifica soprattutto potenze, modalità e accessori, e completa
            ciò che manca: ogni dato riporta la sezione del manuale da cui proviene, e in fondo trovi il testo completo.
          </p>
        </div>
      )}
      {oven.profileIssues.length > 0 && (
        <div className="card border-red-300 text-sm text-red-700">Il profilo salvato non è valido: è stato azzerato. Ricompilalo.</div>
      )}
      <ProfileEditor
        ovenId={oven.id}
        initialNickname={oven.nickname}
        initialProfile={oven.profile ?? emptyProfile()}
        confirmed={oven.confirmed}
        sections={sections.map((s) => ({ slug: s.slug, title: s.title, pageFrom: s.pageFrom }))}
      />
      {oven.manual && (
        <ManualSections fileName={oven.manual.fileName} source={oven.manual.source} pageCount={oven.manual.pageCount} sections={sections} />
      )}
    </div>
  );
}
