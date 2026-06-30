import { Card } from "./Card";

type StatCardProps = {
  label: string;
  value: number | string;
};

export function StatCard({ label, value }: StatCardProps) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
    </Card>
  );
}
