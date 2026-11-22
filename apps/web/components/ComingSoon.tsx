export default function ComingSoon({ label }: { label: string }) {
  return (
    <main className="min-h-screen p-6 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-green">{label}</h1>
        <p className="mt-2 text-charcoal/70">Coming soon</p>
      </div>
    </main>
  );
}
