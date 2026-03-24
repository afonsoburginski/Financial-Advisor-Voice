import { Router, type IRouter } from "express";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const router: IRouter = Router();

router.get("/agenda", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, titulo, descricao, data_hora, categoria, prioridade, concluido, criado_em
       FROM agenda_items ORDER BY concluido ASC, criado_em DESC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch agenda items" });
  }
});

router.post("/agenda", async (req, res) => {
  const { titulo, descricao = "", data_hora = null, categoria = "Geral", prioridade = "media" } = req.body ?? {};
  if (!titulo) {
    res.status(400).json({ error: "titulo is required" });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO agenda_items (titulo, descricao, data_hora, categoria, prioridade)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, titulo, descricao, data_hora, categoria, prioridade, concluido, criado_em`,
      [titulo, descricao, data_hora, categoria, prioridade]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to create agenda item" });
  }
});

router.patch("/agenda/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const fields = req.body ?? {};
  const allowed = ["titulo", "descricao", "data_hora", "categoria", "prioridade", "concluido"];
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      updates.push(`${key} = $${values.length + 1}`);
      values.push(value);
    }
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  values.push(id);
  try {
    const result = await pool.query(
      `UPDATE agenda_items SET ${updates.join(", ")} WHERE id = $${values.length}
       RETURNING id, titulo, descricao, data_hora, categoria, prioridade, concluido, criado_em`,
      values
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update agenda item" });
  }
});

router.delete("/agenda/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await pool.query("DELETE FROM agenda_items WHERE id = $1", [id]);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete agenda item" });
  }
});

export default router;
