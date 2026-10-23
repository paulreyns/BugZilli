import type { ReactNode } from "react";

export function TabEmpty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="tab-empty">
      {icon}
      <span>{text}</span>
    </div>
  );
}
