function Pulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-panel-hover ${className}`} />;
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-10">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-[68px]" />
        ))}
      </section>
      <Pulse className="h-32" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Pulse key={i} className="aspect-[4/5]" />
        ))}
      </div>
    </div>
  );
}
