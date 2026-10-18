import type { ReactNode } from "react";
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="status" className="mx-auto max-w-xl py-24 text-center">
      <h2 className="text-3xl">{title}</h2>
      {children && <p className="mx-auto mt-4 text-muted">{children}</p>}
      {action && <div className="mt-8 flex justify-center">{action}</div>}
    </div>
  );
}
