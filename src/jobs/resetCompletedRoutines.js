import cron from "node-cron";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Corre cada hora: rutinas con is_completed = true y completed_at hace más de 24h → reset
export const startResetCompletedRoutinesJob = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = await prisma.routines.updateMany({
        where: {
          is_completed: true,
          completed_at: {
            lte: cutoff,
          },
          deleted_at: null,
        },
        data: {
          is_completed: false,
        },
      });

      if (result.count > 0) {
        console.log(`[ResetJob] ${result.count} rutina(s) reseteadas a is_completed: false`);
      }
    } catch (error) {
      console.error("[ResetJob] Error al resetear rutinas completadas:", error);
    }
  });

  console.log("[ResetJob] Cron job de reset de rutinas iniciado (cada hora)");
};
