import { Router, type IRouter } from "express";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const router: IRouter = Router();

router.get("/user-profile", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome, cidade, estado, profissao, meta_nome, meta_valor, notas, atualizado_em
       FROM user_profile LIMIT 1`
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.get("/tommy-memoria", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, categoria, chave, valor, criado_em FROM tommy_memoria ORDER BY criado_em DESC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch memoria" });
  }
});

router.post("/tommy-memoria", async (req, res) => {
  const { categoria = "Geral", chave, valor } = req.body ?? {};
  if (!chave || !valor) {
    res.status(400).json({ error: "chave and valor are required" });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO tommy_memoria (categoria, chave, valor) VALUES ($1, $2, $3)
       RETURNING *`,
      [categoria, chave, valor]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to store memoria" });
  }
});

export default router;
