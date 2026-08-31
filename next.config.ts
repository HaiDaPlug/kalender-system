import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next blockerar som standard dev-resurser som begärs från en annan origin än
  // localhost. Utan detta laddas JavaScript aldrig när man öppnar dev-servern
  // från en telefon på samma wifi (http://<datorns-ip>:3000) — sidan renderas
  // men hydrerar aldrig, så inget går att klicka på.
  // Gäller endast `next dev`; påverkar inte produktionsbygget.
  allowedDevOrigins: ['192.168.0.*', '192.168.1.*'],
};

export default nextConfig;
