import { pgTable, serial, text, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const decisoesTable = pgTable("decisoes", {
  id: serial("id").primaryKey(),
  data: timestamp("data").defaultNow().notNull(),
  titulo: text("titulo").notNull(),
  valor: decimal("valor", { precision: 10, scale: 2 }).notNull(),
  categoria: text("categoria").notNull(),
});

export const insertDecisaoSchema = createInsertSchema(decisoesTable).omit({ id: true, data: true });
export type InsertDecisao = z.infer<typeof insertDecisaoSchema>;
export type Decisao = typeof decisoesTable.$inferSelect;
