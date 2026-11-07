import { UploadManualForm } from "@/features/oven-profile/components/UploadManualForm";

export default function NewOvenPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Aggiungi un forno</h1>
      <p className="text-stone-600 dark:text-stone-400">
        Carica il manuale d&apos;uso in PDF, oppure le foto delle pagine. Dopo l&apos;analisi potrai controllare e correggere il
        profilo prima di salvarlo.
      </p>
      <UploadManualForm />
    </div>
  );
}
