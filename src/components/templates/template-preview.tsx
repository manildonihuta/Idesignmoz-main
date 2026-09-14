import type { AiTemplate } from "@/lib/ai-templates";

type Props = {
  name: string;
  colors: AiTemplate["colors"];
  image?: string;
};

/**
 * Miniaturas de landing page geradas a partir das cores do template —
 * mostram a imagem real do modelo (banco de imagens) quando disponível.
 */
export function TemplatePreview({ name, colors, image }: Props) {
  return (
    <div
      className="relative h-full w-full overflow-hidden select-none"
      style={{ background: colors.to }}
    >
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${colors.from}40 0%, transparent 55%)` }}
      />
      <div
        className="absolute -right-10 -top-14 h-36 w-36 rounded-full opacity-30 blur-2xl"
        style={{ background: colors.accent }}
      />

      {/* browser chrome */}
      <div className="relative flex items-center gap-1.5 border-b border-white/15 bg-black/25 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
        <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
        <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        <span className="ml-2 h-2.5 flex-1 rounded-full bg-white/25" />
      </div>

      {/* navbar */}
      <div className="relative flex items-center justify-between px-4 py-2.5">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: colors.from }} />
          <span className="h-1.5 w-9 rounded-full bg-white/50" />
        </span>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="h-1.5 w-7 rounded-full bg-white/40" />
          <span className="h-1.5 w-7 rounded-full bg-white/40" />
          <span className="h-1.5 w-7 rounded-full bg-white/40" />
        </div>
        <span
          className="rounded-full px-2 py-1 text-[6px] font-bold uppercase tracking-[0.14em] text-white shadow-sm"
          style={{ background: colors.accent }}
        >
          {name}
        </span>
      </div>

      {/* hero */}
      <div className="relative flex items-start justify-between gap-3 px-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <span className="block h-2 w-4/5 rounded-full" style={{ background: colors.from }} />
          <span className="block h-2 w-2/3 rounded-full bg-white/60" />
          <span className="block h-2 w-full rounded-full bg-white/40" />
          <span className="block h-2 w-3/5 rounded-full bg-white/40" />
          <div className="flex items-center gap-1.5 pt-1.5">
            <span className="h-4 w-11 rounded-md shadow-sm" style={{ background: colors.accent }} />
            <span className="h-4 w-11 rounded-md border border-white/45" />
          </div>
        </div>
        {image ? (
          <img src={image} alt="" className="relative h-14 w-14 flex-none rounded-lg border border-white/30 object-cover shadow-lg" loading="lazy" />
        ) : (
          <span className="relative h-14 w-14 flex-none rounded-2xl border border-white/20 bg-white/15 shadow-lg" />
        )}
      </div>

      {/* cards */}
      <div className="relative mt-3 flex items-stretch gap-2 px-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-8 flex-1 rounded-lg border border-white/15 bg-white/10"
            style={i === 1 ? { backgroundColor: `${colors.accent}55` } : undefined}
          />
        ))}
      </div>
    </div>
  );
}