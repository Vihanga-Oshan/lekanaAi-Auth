const pool = require("../db");

/**
 * Ensure user exists after Auth0 login.
 * Called manually in saveOnboarding() and getOnboarding().
 */
async function findOrCreateUser(auth0User) {
  const auth0_id = auth0User.sub;
  const email = auth0User.email;
  const name = auth0User.name || auth0User.nickname || null;

  // 1) Check if exists
  const existing = await pool.query(
    "SELECT * FROM users WHERE auth0_id = $1 LIMIT 1",
    [auth0_id]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // 2) Create new user
  const inserted = await pool.query(
    `
    INSERT INTO users (auth0_id, email, name, onboarding_completed)
    VALUES ($1, $2, $3, FALSE)
    RETURNING *
    `,
    [auth0_id, email, name]
  );

  return inserted.rows[0];
}

/**
 * POST /api/onboarding/save
 */
exports.saveOnboarding = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.oidc || !req.oidc.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const {
      accountType, // "individual" | "team"
      name,
      companyName,
      role,
      teamEmails,
      planId,
      billingCycle
    } = req.body;

    await client.query("BEGIN");

    // 1) Ensure user exists
    const user = await findOrCreateUser(req.oidc.user);

    // 2) Upsert workspace
    let workspace = null;

    const wsRes = await client.query(
      `SELECT * FROM workspaces WHERE owner_user_id = $1 LIMIT 1`,
      [user.id]
    );

    if (wsRes.rows.length > 0) {
      // Update
      const updated = await client.query(
        `
        UPDATE workspaces
        SET account_type = $1,
            name = $2,
            company_name = $3,
            role = $4,
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
        `,
        [accountType, name, companyName, role, wsRes.rows[0].id]
      );
      workspace = updated.rows[0];
    } else {
      // Insert
      const inserted = await client.query(
        `
        INSERT INTO workspaces (owner_user_id, account_type, name, company_name, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [user.id, accountType, name, companyName, role]
      );
      workspace = inserted.rows[0];
    }

    // 3) Replace collaborators
    await client.query(
      `DELETE FROM collaborators WHERE workspace_id = $1`,
      [workspace.id]
    );

    let collaborators = [];

    if (Array.isArray(teamEmails)) {
      for (const email of teamEmails) {
        const trimmed = (email || "").trim();
        if (!trimmed) continue;

        const c = await client.query(
          `
          INSERT INTO collaborators (workspace_id, email)
          VALUES ($1, $2)
          RETURNING *
          `,
          [workspace.id, trimmed]
        );
        collaborators.push(c.rows[0]);
      }
    }

    // 4) Upsert subscription
    let subscription = null;

    if (planId && billingCycle) {
      const subRes = await client.query(
        `
        SELECT * FROM subscriptions
        WHERE user_id = $1 AND workspace_id = $2
        LIMIT 1
        `,
        [user.id, workspace.id]
      );

      if (subRes.rows.length > 0) {
        const updatedSub = await client.query(
          `
          UPDATE subscriptions
          SET plan_id = $1,
              billing_cycle = $2,
              updated_at = NOW()
          WHERE id = $3
          RETURNING *
          `,
          [planId, billingCycle, subRes.rows[0].id]
        );
        subscription = updatedSub.rows[0];
      } else {
        const insertedSub = await client.query(
          `
          INSERT INTO subscriptions (user_id, workspace_id, plan_id, billing_cycle)
          VALUES ($1, $2, $3, $4)
          RETURNING *
          `,
          [user.id, workspace.id, planId, billingCycle]
        );
        subscription = insertedSub.rows[0];
      }
    }

    // 5) Mark onboarding complete
    const updatedUser = await client.query(
      `
      UPDATE users
      SET onboarding_completed = TRUE,
          name = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [user.id, name]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      user: updatedUser.rows[0],
      workspace,
      collaborators,
      subscription
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Onboarding save error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

/**
 * GET /api/onboarding/me
 */
exports.getOnboarding = async (req, res) => {
  try {
    if (!req.oidc || !req.oidc.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const user = await findOrCreateUser(req.oidc.user);

    // Workspace
    const wsRes = await pool.query(
      `SELECT * FROM workspaces WHERE owner_user_id = $1 LIMIT 1`,
      [user.id]
    );
    const workspace = wsRes.rows[0] || null;

    // Collaborators
    let collaborators = [];
    if (workspace) {
      const c = await pool.query(
        `SELECT * FROM collaborators WHERE workspace_id = $1`,
        [workspace.id]
      );
      collaborators = c.rows;
    }

    // Subscription
    let subscription = null;
    if (workspace) {
      const s = await pool.query(
        `
        SELECT * FROM subscriptions
        WHERE user_id = $1 AND workspace_id = $2
        LIMIT 1
        `,
        [user.id, workspace.id]
      );
      subscription = s.rows[0] || null;
    }

    return res.json({
      success: true,
      onboardingCompleted: user.onboarding_completed,
      user,
      workspace,
      collaborators,
      subscription
    });
  } catch (err) {
    console.error("Onboarding get error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
