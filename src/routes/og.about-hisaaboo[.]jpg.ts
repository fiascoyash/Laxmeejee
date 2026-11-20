import { createFileRoute } from "@tanstack/react-router";
import { aboutOgImageBase64 } from "@/lib/aboutOgImage";

// Serves the About page share image at /og/about-hisaaboo.jpg from embedded text,
// so the image survives GitHub exports that drop binary files.
export const Route = createFileRoute("/og/about-hisaaboo.jpg")({
  server: {
    handlers: {
      GET: async () => {
        const binary = atob(aboutOgImageBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Response(bytes, {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
