export default function DashboardSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ label: string; value: string; meta?: string }>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-muted">{description}</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-sm text-muted">
          Nada aqui por agora. A informação aparece quando houver dados
          ligados à sua conta.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3"
            >
              <div>
                <p className="font-medium">{item.label}</p>
                {item.meta ? (
                  <p className="text-sm text-muted">{item.meta}</p>
                ) : null}
              </div>
              <p className="text-sm text-muted">{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}