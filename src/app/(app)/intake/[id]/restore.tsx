"use client";
import { useRouter } from "next/navigation";
import { restoreIntake } from "@/app/actions";
import { Button } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";

export function RestoreIntake({ id }: { id: string }) {
  const { pending, error, run } = useAction();
  const router = useRouter();
  return (
    <div className="mt-3">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => restoreIntake(id), () => router.refresh())}>
        Restore to queue
      </Button>
      <ErrorText error={error} className="mt-2" />
    </div>
  );
}
