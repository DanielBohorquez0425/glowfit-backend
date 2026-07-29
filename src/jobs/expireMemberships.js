import cron from "node-cron";
import prisma from "../config/prismaClient.js";
import { todayInGymTz } from "../utils/planDates.js";

/**
 * Corre todos los días a las 00:10 (hora del servidor): membresías ACTIVE cuya
 * vigencia ya pasó → EXPIRED.
 *
 * Solo toca ACTIVE. SUSPENDED y CANCELLED son decisiones manuales del gym y el
 * job no las puede pisar.
 *
 * Las membresías con `end_date` nulo son membresías sin vencimiento (socios
 * previos a los planes) y quedan fuera del filtro.
 */
export const startExpireMembershipsJob = () => {
  cron.schedule("10 0 * * *", async () => {
    try {
      const today = todayInGymTz();

      const result = await prisma.gym_memberships.updateMany({
        where: {
          status: "ACTIVE",
          end_date: { not: null, lt: today },
        },
        data: { status: "EXPIRED" },
      });

      if (result.count > 0) {
        console.log(`[ExpireJob] ${result.count} membresía(s) marcadas como EXPIRED`);
      }
    } catch (error) {
      console.error("[ExpireJob] Error al expirar membresías vencidas:", error);
    }
  });

  console.log("[ExpireJob] Cron job de expiración de membresías iniciado (diario 00:10)");
};
