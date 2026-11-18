"use client";
import { useState } from "react";
import { attestAccessReview } from "@/app/actions";
import { Button } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";

export function AccessReview({ users }: { users: { id: string; name: string; role: string; scope: string; privilege: string }[] }) {
  const [keep, setKeep] = useState<Record<string, boolean>>(() => Object.fromEntries(users.map((u) => [u.id, true])));
  const [done, setDone] = useState(false);
  const { pending, error, run } = useAction();
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <caption className="sr-only">Privileged access review</caption>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Scope</th>
              <th>What this access allows</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td>{u.role}</td>
                <td className="text-[13px]">{u.scope}</td>
                <td className="text-[13px]">{u.privilege}</td>
                <td>
                  <fieldset className="flex gap-3 text-[13px]">
                    <legend className="sr-only">Decision for {u.name}</legend>
                    <label className="flex items-center gap-1">
                      <input type="radio" name={`k-${u.id}`} checked={keep[u.id]} onChange={() => setKeep({ ...keep, [u.id]: true })} /> Still needed
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="radio" name={`k-${u.id}`} checked={!keep[u.id]} onChange={() => setKeep({ ...keep, [u.id]: false })} /> Remove
                    </label>
                  </fieldset>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-line flex items-center gap-3">
        <Button disabled={pending} onClick={() => run(() => attestAccessReview(users.map((u) => ({ userId: u.id, keep: keep[u.id] }))), () => setDone(true))}>
          Attest review
        </Button>
        <span className="text-[12.5px] text-muted">Attestation and any removal requests are written to the audit log. Removals go to the HR Director for sign-off.</span>
        {done && (
          <span role="status" className="text-[12.5px] text-ok">
            ✓ Recorded
          </span>
        )}
        <ErrorText error={error} />
      </div>
    </div>
  );
}
