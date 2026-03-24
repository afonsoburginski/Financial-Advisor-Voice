import { Router, type IRouter } from "express";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const router: IRouter = Router();

router.get("/decisoes", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, data, titulo, valor::float, categoria FROM decisoes ORDER BY data DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch decisoes" });
  }
});

router.post("/decisoes", async (req, res) => {
  const { titulo, valor, categoria } = req.body;
  if (!titulo || valor === undefined || !categoria) {
    res.status(400).json({ error: "titulo, valor, and categoria are required" });
    return;
  }
  try {
    const result = await pool.query(
      "INSERT INTO decisoes (titulo, valor, categoria) VALUES ($1, $2, $3) RETURNING id, data, titulo, valor::float, categoria",
      [titulo, valor, categoria]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create decisao" });
  }
});

router.delete("/decisoes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM decisoes WHERE id = $1", [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete decisao" });
  }
});

export default router;
