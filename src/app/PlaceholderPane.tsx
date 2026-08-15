export function PlaceholderPane({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center">
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">Coming in {phase}.</p>
    </div>
  );
}
