const express = require("express");
const router = express.Router();
const pool = require("../db");

// Save onboarding
router.post("/onboarding", async (req, res) => {
  try {
    const {
      auth0_id,
      email,
      first_name,
      last_name,
      company_name,
      company_size,
      job_title,
      document_volume,
      industry,
      phone_number,
      country
    } = req.body;

    const result = await pool.query(
      `INSERT INTO users 
       (auth0_id, email, first_name, last_name, company_name, company_size, job_title, document_volume, industry, phone_number, country)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        auth0_id,
        email,
        first_name,
        last_name,
        company_name,
        company_size,
        job_title,
        document_volume,
        industry,
        phone_number,
        country
      ]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB Insert Fail" });
  }
});

module.exports = router;
