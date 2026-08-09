import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const PLATFORMS = ["instagram", "facebook", "youtube"] as const;

async function updateBusiness(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const platforms = PLATFORMS.filter((p) => formData.get(`platform-${p}`) === "on");

  await prisma.business.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? ""),
      tagline: String(formData.get("tagline") ?? ""),
      description: String(formData.get("description") ?? ""),
      instagram: String(formData.get("instagram") ?? ""),
      facebook: String(formData.get("facebook") ?? ""),
      website: String(formData.get("website") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      ctaText: String(formData.get("ctaText") ?? ""),
      platformsJson: JSON.stringify(platforms),
      active: formData.get("active") === "on",
    },
  });
  revalidatePath("/businesses");
}

export default async function Businesses() {
  const businesses = await prisma.business.findMany({ orderBy: { name: "asc" } });

  const input =
    "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-gold focus:outline-none";
  const label = "text-xs font-semibold uppercase tracking-wider text-neutral-400";

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-black">Negocios</h1>
      {businesses.map((b) => {
        const platforms: string[] = JSON.parse(b.platformsJson || "[]");
        return (
          <form
            key={b.id}
            action={updateBusiness}
            className="rounded-2xl border border-line bg-panel p-6 grid gap-4 md:grid-cols-2"
          >
            <input type="hidden" name="id" value={b.id} />
            <div className="md:col-span-2 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gold-light">{b.name}</h2>
              <span className="text-xs text-neutral-500">slug: {b.slug}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className={label}>Nombre</span>
              <input name="name" defaultValue={b.name} className={input} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={label}>Tagline</span>
              <input name="tagline" defaultValue={b.tagline} className={input} />
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <span className={label}>Descripción (la usa la IA para las ideas)</span>
              <textarea name="description" defaultValue={b.description} rows={3} className={input} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={label}>Instagram</span>
              <input name="instagram" defaultValue={b.instagram} className={input} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={label}>Página de Facebook</span>
              <input name="facebook" defaultValue={b.facebook} className={input} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={label}>Sitio web</span>
              <input name="website" defaultValue={b.website} className={input} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={label}>Teléfono / WhatsApp</span>
              <input name="phone" defaultValue={b.phone} className={input} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={label}>Llamado a la acción</span>
              <input name="ctaText" defaultValue={b.ctaText} className={input} />
            </div>

            <div className="flex items-end gap-6 pb-1">
              {PLATFORMS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm capitalize">
                  <input
                    type="checkbox"
                    name={`platform-${p}`}
                    defaultChecked={platforms.includes(p)}
                    className="accent-[#f2b705]"
                  />
                  {p}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={b.active} className="accent-[#f2b705]" />
                Activo
              </label>
            </div>

            <div className="md:col-span-2">
              <button className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-black hover:bg-gold-light">
                Guardar cambios
              </button>
            </div>
          </form>
        );
      })}
      <p className="text-xs text-neutral-500">
        Para agregar un negocio nuevo: duplica un bloque en scripts/seed.ts con su slug, marca y
        temas, corre <code className="text-neutral-300">npm run seed</code> y coloca su logo en{" "}
        <code className="text-neutral-300">assets/brands/&lt;slug&gt;/logo.png</code>.
      </p>
    </div>
  );
}
